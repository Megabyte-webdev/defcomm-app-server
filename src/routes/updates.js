import { Router } from "express";
import updaterService from "../services/updater.js";
import { authenticateApiKey } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import axios from "axios";
import config from "../config.js";

const router = Router();

// Main update check endpoint
router.get(
  "/:appId/:target/:arch/:currentVersion",
  authenticateApiKey,
  async (req, res, next) => {
    try {
      const { appId, target, arch, currentVersion } = req.params;
      const channel = req.query.channel || "stable";

      const update = await updaterService.checkForUpdate(
        appId,
        target,
        arch,
        currentVersion,
        channel,
      );

      if (!update) {
        return res.status(204).send();
      }

      // For Tauri updater, return flat structure
      let platformData;
      if (target === "windows") {
        platformData =
          update.platforms?.["windows-x86_64-nsis"] ||
          update.platforms?.["windows-x86_64"] ||
          update.platforms?.["windows-x86_64-msi"];
      } else if (target === "darwin") {
        platformData =
          update.platforms?.[`darwin-${arch}`] ||
          update.platforms?.[`darwin-${arch}-app`];
      } else {
        const platformKey = `${target}-${arch}`;
        platformData = update.platforms?.[platformKey];
      }

      if (!platformData) {
        logger.error("No platform data found", {
          target,
          arch,
          available: Object.keys(update.platforms || {}),
        });
        return res.status(404).json({ error: "No binary for this platform" });
      }

      // Return URL pointing to OUR proxy endpoint
      const proxyUrl = `https://defcomm-app-server.onrender.com/api/updates/${appId}/download/${target}/${arch}/${update.version}`;

      res.json({
        version: update.version,
        notes: update.notes,
        pub_date: update.pub_date,
        url: proxyUrl,
        signature: platformData.signature,
      });
    } catch (error) {
      logger.error("Update check failed:", error.message);
      next(error);
    }
  },
);

// Proxy download endpoint
// Proxy download endpoint
router.get(
  "/:appId/download/:target/:arch/:version",
  authenticateApiKey,
  async (req, res, next) => {
    try {
      const { appId, target, arch, version } = req.params;

      logger.info(`Download request: ${appId} ${target} ${arch} ${version}`);

      const update = await updaterService.getAllLatestReleases(appId);

      if (!update) {
        return res.status(404).json({ error: "Version not found" });
      }

      // 🔍 DEBUG: Log ALL available platform keys
      logger.info(
        "Available platform keys:",
        Object.keys(update.platforms || {}),
      );

      // Find the platform data - use EXACT keys from the platforms object
      let platformData;

      // Try all possible key variations
      const possibleKeys = [
        `${target}-${arch}`,
        `${target}-${arch}-nsis`,
        `${target}-${arch}-msi`,
        `${target}-${arch}-app`,
        `${target}-${arch}-appimage`,
        `${target}-${arch}-deb`,
        `${target}-${arch}-rpm`,
      ];

      for (const key of possibleKeys) {
        if (update.platforms?.[key]) {
          platformData = update.platforms[key];
          logger.info(`Found platform data with key: ${key}`);
          break;
        }
      }

      if (!platformData?.url) {
        logger.error("No platform URL found", {
          target,
          arch,
          tried: possibleKeys,
          available: Object.keys(update.platforms || {}),
        });
        return res.status(404).json({
          error: "Binary not found",
          available: Object.keys(update.platforms || {}),
        });
      }

      logger.info(`Proxying download from: ${platformData.url}`);

      // Stream the file from GitHub
      const response = await axios({
        method: "GET",
        url: platformData.url,
        headers: {
          Authorization: `Bearer ${config.github.token}`,
          Accept: "application/octet-stream",
          "User-Agent": "Tauri-Update-Server",
        },
        responseType: "stream",
        timeout: 300000,
        maxRedirects: 5,
      });

      const filename =
        platformData.name || `${appId}_${version}_${target}_${arch}`;
      res.setHeader("Content-Type", "application/octet-stream");
      if (response.headers["content-length"]) {
        res.setHeader("Content-Length", response.headers["content-length"]);
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      response.data.pipe(res);

      response.data.on("error", (err) => {
        logger.error("Stream error:", err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Stream failed" });
        }
      });
    } catch (error) {
      logger.error("Download proxy failed:", {
        message: error.message,
        status: error.response?.status,
      });

      if (error.response?.status === 404) {
        return res.status(404).json({ error: "File not found on GitHub" });
      }

      res.status(500).json({
        error: "Download failed",
        details: error.message,
      });
    }
  },
);

// Get all platforms
router.get("/:appId/latest", authenticateApiKey, async (req, res, next) => {
  try {
    const { appId } = req.params;
    const channel = req.query.channel || "stable";

    const allPlatforms = await updaterService.getAllLatestReleases(
      appId,
      channel,
    );

    if (!allPlatforms) {
      return res.status(404).json({ error: "No releases found" });
    }

    res.json(allPlatforms);
  } catch (error) {
    next(error);
  }
});

export default router;
