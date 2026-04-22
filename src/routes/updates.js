import { Router } from "express";
import updaterService from "../services/updater.js";
import { authenticateApiKey } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = Router();

// Main update check endpoint - Now with :appId parameter
router.get(
  "/:appId/:target/:arch/:currentVersion",
  authenticateApiKey,
  async (req, res, next) => {
    try {
      const { appId, target, arch, currentVersion } = req.params;

      const update = await updaterService.checkForUpdate(
        appId,
        target,
        arch,
        currentVersion,
      );

      if (!update) {
        return res.status(204).send();
      }

      // For dynamic endpoint, return flat structure
      const platformKey = `${target}-${arch}`;
      const platformData =
        update.platforms?.[platformKey] ||
        Object.values(update.platforms || {}).find((p) => p.url);

      if (!platformData) {
        return res.status(404).json({ error: "No binary for this platform" });
      }

      // Return flat structure that Tauri expects
      res.json({
        version: update.version,
        notes: update.notes,
        pub_date: update.pub_date,
        url: platformData.url,
        signature: platformData.signature,
      });
    } catch (error) {
      next(error);
    }
  },
);

// NEW: Get all latest releases for an app (all platforms)
router.get("/:appId/latest", authenticateApiKey, async (req, res, next) => {
  try {
    const { appId } = req.params;
    const channel = req.query.channel || "stable";

    logger.info("Latest releases request", {
      appId,
      channel,
      userAgent: req.headers["user-agent"],
    });

    const allPlatforms = await updaterService.getAllLatestReleases(
      appId,
      channel,
    );

    if (!allPlatforms || Object.keys(allPlatforms.platforms).length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "No releases found for this app",
      });
    }

    res.json(allPlatforms);
  } catch (error) {
    next(error);
  }
});

// Download endpoint (proxy)
router.get(
  "/:appId/download/:target/:arch/:version",
  authenticateApiKey,
  async (req, res, next) => {
    try {
      const { appId, target, arch, version } = req.params;
      const channel = req.query.channel || "stable";

      // If version is "latest", get the latest release
      let requestedVersion = version;
      if (version === "latest") {
        const latest = await updaterService.getLatestVersion(appId, channel);
        requestedVersion = latest;
      }

      const update = await updaterService.checkForUpdate(
        appId,
        target,
        arch,
        "0.0.0",
        channel,
      );

      if (!update) {
        return res.status(404).json({ error: "Version not found" });
      }

      const platformKey = `${target}-${arch}`;
      const platformData = update.platforms[platformKey];

      if (!platformData?.url) {
        return res.status(404).json({ error: "Binary not found" });
      }

      res.redirect(platformData.url);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
