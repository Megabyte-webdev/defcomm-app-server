import { Router } from "express";
import updaterService from "../services/updater.js";
import { authenticateApiKey } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import axios from "axios";
import config from "../config.js";
import GitHubService from "../services/github.js";

const router = Router();

// Main update check endpoint - Returns PROXY URL for Tauri
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

      // For Tauri updater, return flat structure with PROXY URL
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
        return res.status(404).json({ error: "No binary for this platform" });
      }

      // Return PROXY URL - no token exposed!
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

// SINGLE DOWNLOAD ENDPOINT - Works for both Tauri and Dashboard
router.get(
  "/:appId/download/:target/:arch/:version",
  async (req, res, next) => {
    try {
      const { appId, target, arch, version } = req.params;

      logger.info(`Download request: ${appId} ${target} ${arch} ${version}`);

      // Get the raw GitHub release data (bypass cache or use fresh)
      const github = new GitHubService(
        config.github.token,
        config.github.owner,
        appId,
      );

      const release = await github.getLatestRelease();

      if (!release) {
        return res.status(404).json({ error: "Release not found" });
      }

      // Find the asset
      let asset = null;
      const targets = [target];
      const archs = [arch];

      for (const t of targets) {
        for (const a of archs) {
          asset = github.findAsset(release, t, a);
          if (asset) break;
        }
        if (asset) break;
      }

      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Use the GitHub API URL (asset.url) - works with token!
      const downloadUrl = asset.url;

      logger.info(`Streaming from GitHub API: ${downloadUrl}`);

      // Stream the file
      const response = await axios({
        method: "GET",
        url: downloadUrl,
        headers: {
          Authorization: `Bearer ${config.github.token}`,
          Accept: "application/octet-stream",
          "User-Agent": "Tauri-Update-Server",
        },
        responseType: "stream",
        timeout: 300000,
        maxRedirects: 5,
      });

      const filename = asset.name || `${appId}_${version}_${target}_${arch}`;
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
      logger.error("Download failed:", error.message);
      res.status(500).json({ error: "Download failed" });
    }
  },
);

// Dashboard endpoint - Returns PROXY URLs instead of direct GitHub URLs
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

    // Replace direct GitHub URLs with PROXY URLs for dashboard
    const proxyPlatforms = {};
    for (const [key, platform] of Object.entries(
      allPlatforms.platforms || {},
    )) {
      const [target, arch] = key.split("-");
      proxyPlatforms[key] = {
        ...platform,
        // Override URL with proxy URL
        url: `https://defcomm-app-server.onrender.com/api/updates/${appId}/download/${target}/${arch}/${allPlatforms.version}`,
        // Keep original URL if needed
        directUrl: platform.url,
      };
    }

    res.json({
      ...allPlatforms,
      platforms: proxyPlatforms,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
