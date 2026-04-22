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

    // The repo name is the app ID (e.g., "defcomm-chat-app" -> repo: "Defcomm-chat-app")
    const repo = appId;

    // Check cache
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

      // Find signature (optional)
      const sigAsset = await github.findSignatureAsset(release, asset);
      let signature = null;

      if (sigAsset) {
        try {
          signature = await github.getAssetContent(sigAsset.url);
        } catch (sigError) {
          logger.warn("Failed to load signature", { error: sigError.message });
        }
      }

      const updateResponse = {
        version: latestVersion,
        notes: release.body || `Update to version ${latestVersion}`,
        pub_date: release.published_at,
        platforms: {
          [`${target}-${arch}`]: {
            url: asset.browser_download_url,
            signature: signature?.trim() || undefined,
          },
        },
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

  // NEW: Get all platform releases at once
  async getAllLatestReleases(appId, channel = "stable") {
    const repo = appId;

    // Check cache first
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

      // Find assets for all platforms
      const platforms = {};
      const targets = ["windows", "darwin", "linux"];
      const archs = ["x86_64", "aarch64"];

      for (const target of targets) {
        for (const arch of archs) {
          // Skip invalid combinations
          if (target === "linux" && arch === "aarch64") continue;

          const asset = github.findAsset(release, target, arch);
          if (asset) {
            const platformKey = `${target}-${arch}`;

            // Try to find signature
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

      // Cache for 5 minutes
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
