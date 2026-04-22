import semver from "semver";
import GitHubService from "./github.js";
import cacheService from "./cache.js";
import config from "../config.js";
import logger from "../utils/logger.js";

class UpdaterService {
  async checkForUpdate(
    appId,
    target,
    arch,
    currentVersion,
    channel = "stable",
  ) {
    // Clean version string
    const cleanCurrentVersion = currentVersion.replace(/^v/, "");

    // The repo name is the app ID
    const repo = appId;

    // Check cache first
    const cacheKey = cacheService.generateKey(
      appId,
      target,
      arch,
      cleanCurrentVersion,
      channel,
    );

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug("Cache hit", { appId, currentVersion: cleanCurrentVersion });
      return cached;
    }

    // Create GitHub service once
    const github = new GitHubService(
      config.github.token,
      config.github.owner,
      repo,
    );

    try {
      // Get latest release
      const release = await github.getLatestRelease(channel);

      if (!release) {
        logger.info("No releases found", { appId, repo });
        return null;
      }

      // Check for latest.json asset first (hybrid approach)
      const jsonAsset = release.assets.find((a) => a.name === "latest.json");

      if (jsonAsset) {
        try {
          const jsonContent = await github.getAssetContent(jsonAsset.url);
          const latestJson = JSON.parse(jsonContent);

          const platformKey = `${target}-${arch}`;
          const platformData = latestJson.platforms?.[platformKey];

          if (platformData) {
            const updateResponse = {
              version: latestJson.version,
              notes: latestJson.notes,
              pub_date: latestJson.pub_date,
              url: platformData.url,
              signature: platformData.signature,
            };

            await cacheService.set(cacheKey, updateResponse, config.cacheTTL);

            logger.info("✅ Update available (from latest.json)", {
              appId,
              version: latestJson.version,
            });

            return updateResponse;
          }
        } catch (jsonError) {
          logger.warn("Failed to parse latest.json, falling back to manual", {
            error: jsonError.message,
          });
        }
      }

      // Fallback: Build response from release assets
      const latestVersion = release.tag_name.replace(/^v/, "");

      logger.info("Version check", {
        appId,
        current: cleanCurrentVersion,
        latest: latestVersion,
      });

      // Validate versions
      if (!semver.valid(cleanCurrentVersion) || !semver.valid(latestVersion)) {
        logger.warn("Invalid semver", {
          appId,
          current: cleanCurrentVersion,
          latest: latestVersion,
        });
        return null;
      }

      // Check if update needed
      if (semver.gte(cleanCurrentVersion, latestVersion)) {
        logger.info("Already latest", { appId, current: cleanCurrentVersion });
        await cacheService.set(cacheKey, null, 60);
        return null;
      }

      // Find asset
      const asset = github.findAsset(release, target, arch);
      if (!asset) {
        logger.warn("No matching asset", { appId, target, arch });
        return null;
      }

      // Find signature
      const sigAsset = await github.findSignatureAsset(release, asset);
      let signature = null;

      if (sigAsset) {
        try {
          signature = await github.getAssetContent(sigAsset.url);
        } catch (sigError) {
          logger.warn("Failed to load signature", { error: sigError.message });
        }
      }

      // Tauri expects flat structure for updater
      const updateResponse = {
        version: latestVersion,
        notes: release.body || `Update to version ${latestVersion}`,
        pub_date: release.published_at,
        url: asset.browser_download_url,
        signature: signature?.trim() || undefined,
      };

      await cacheService.set(cacheKey, updateResponse, config.cacheTTL);

      logger.info("✅ Update available", {
        appId,
        current: cleanCurrentVersion,
        latest: latestVersion,
        target,
        arch,
      });

      return updateResponse;
    } catch (error) {
      logger.error("Update check failed", {
        appId,
        error: error.message,
      });
      throw error;
    }
  }

  async getLatestVersion(appId, channel = "stable") {
    const repo = appId;

    const github = new GitHubService(
      config.github.token,
      config.github.owner,
      repo,
    );

    try {
      const release = await github.getLatestRelease(channel);

      if (!release) {
        return null;
      }

      return release.tag_name.replace(/^v/, "");
    } catch (error) {
      logger.error("Failed to get latest version", {
        appId,
        error: error.message,
      });
      throw error;
    }
  }

  async getAllLatestReleases(appId, channel = "stable") {
    const repo = appId;

    const cacheKey = `all-platforms:${appId}:${channel}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug("Cache hit for all platforms", { appId });
      return cached;
    }

    const github = new GitHubService(
      config.github.token,
      config.github.owner,
      repo,
    );

    try {
      const release = await github.getLatestRelease(channel);

      if (!release) {
        logger.warn("No release found", { appId });
        return null;
      }

      const latestVersion = release.tag_name.replace(/^v/, "");

      const platforms = {};
      const targets = ["windows", "darwin", "linux"];
      const archs = ["x86_64", "aarch64"];

      for (const target of targets) {
        for (const arch of archs) {
          if (target === "linux" && arch === "aarch64") continue;

          const asset = github.findAsset(release, target, arch);
          if (asset) {
            const platformKey = `${target}-${arch}`;
            const sigAsset = await github.findSignatureAsset(release, asset);
            let signature = null;

            if (sigAsset) {
              try {
                signature = await github.getAssetContent(sigAsset.url);
              } catch (sigError) {
                logger.warn("Failed to load signature", {
                  platform: platformKey,
                  error: sigError.message,
                });
              }
            }

            platforms[platformKey] = {
              url: asset.browser_download_url,
              signature: signature?.trim() || undefined,
              size: asset.size,
              name: asset.name,
              download_count: asset.download_count,
            };
          }
        }
      }

      const allReleases = {
        appId,
        version: latestVersion,
        notes: release.body || `Release ${latestVersion}`,
        pub_date: release.published_at,
        channel,
        html_url: release.html_url,
        platforms,
      };

      await cacheService.set(cacheKey, allReleases, 300);

      logger.info("Retrieved all platform releases", {
        appId,
        version: latestVersion,
        platformCount: Object.keys(platforms).length,
      });

      return allReleases;
    } catch (error) {
      logger.error("Failed to get all releases", {
        appId,
        error: error.message,
      });
      throw error;
    }
  }
}

export default new UpdaterService();
