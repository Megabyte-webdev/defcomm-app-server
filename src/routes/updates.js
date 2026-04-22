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
      const platformKey = `${target}-${arch}`;

      // Prefer NSIS for Windows
      let platformData;
      if (target === "windows") {
        platformData =
          update.platforms?.["windows-x86_64-nsis"] ||
          update.platforms?.["windows-x86_64"];
      } else {
        platformData = update.platforms?.[platformKey];
      }

      if (!platformData) {
        return res.status(404).json({ error: "No binary for this platform" });
      }

      // Return URL pointing to OUR proxy endpoint, not GitHub directly
      const proxyUrl = `${req.protocol}://${req.get("host")}/api/updates/${appId}/download/${target}/${arch}/${update.version}`;

      res.json({
        version: update.version,
        notes: update.notes,
        pub_date: update.pub_date,
        url: proxyUrl, // Point to our proxy!
        signature: platformData.signature,
      });
    } catch (error) {
      next(error);
    }
  },
);

// NEW: Proxy download endpoint (streams from GitHub with auth)
router.get(
  "/:appId/download/:target/:arch/:version",
  authenticateApiKey,
  async (req, res, next) => {
    try {
      const { appId, target, arch, version } = req.params;

      // Get the actual GitHub URL
      const update = await updaterService.checkForUpdate(
        appId,
        target,
        arch,
        "0.0.0",
      );

      if (!update) {
        return res.status(404).json({ error: "Version not found" });
      }

      const platformKey = `${target}-${arch}`;
      let platformData;
      if (target === "windows") {
        platformData =
          update.platforms?.["windows-x86_64-nsis"] ||
          update.platforms?.["windows-x86_64"];
      } else {
        platformData = update.platforms?.[platformKey];
      }

      if (!platformData?.url) {
        return res.status(404).json({ error: "Binary not found" });
      }

      // Stream the file from GitHub with authentication
      const response = await axios({
        method: "GET",
        url: platformData.url,
        headers: {
          Authorization: `Bearer ${config.github.token}`,
          Accept: "application/octet-stream",
        },
        responseType: "stream",
      });

      // Set appropriate headers
      res.setHeader("Content-Type", response.headers["content-type"]);
      res.setHeader("Content-Length", response.headers["content-length"]);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${platformData.name || "update"}"`,
      );

      // Pipe the file to the client
      response.data.pipe(res);
    } catch (error) {
      logger.error("Download proxy failed:", error.message);
      res.status(500).json({ error: "Download failed" });
    }
  },
);

export default router;
