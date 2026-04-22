import axios from "axios";
import config from "../config.js";
import logger from "../utils/logger.js";

class GitHubService {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.client = axios.create({
      baseURL: config.githubApiUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Tauri-Update-Server/1.0",
      },
      timeout: 30000, // Increased to 30 seconds
    });
  }

  async getLatestRelease(channel = "stable") {
    try {
      // Strategy: Try /latest first (fast)
      try {
        const latestResponse = await this.client.get(
          `/repos/${this.owner}/${this.repo}/releases/latest`,
        );
        const release = latestResponse.data;

        // If looking for beta, check if latest is prerelease
        if (channel === "beta" && !release.prerelease) {
          // Fall through to list all releases to find beta
          throw new Error("Latest is not beta, checking all releases");
        }

        return release;
      } catch (latestError) {
        // If /latest fails (404) or we need beta, fetch recent releases
        if (latestError.response?.status === 404 || channel === "beta") {
          logger.debug(
            "Fetching releases list (latest not available or beta needed)",
          );

          // Only fetch first page (30 releases) - enough for most cases
          const releasesResponse = await this.client.get(
            `/repos/${this.owner}/${this.repo}/releases`,
            { params: { per_page: 30, page: 1 } },
          );

          const releases = releasesResponse.data;

          if (!releases || releases.length === 0) {
            logger.warn("No releases found");
            return null;
          }

          // Filter by channel
          if (channel === "beta") {
            const betaRelease = releases.find((r) => r.prerelease);
            return betaRelease || releases[0]; // Fallback to latest
          }

          // Return first (latest) release
          return releases[0];
        }

        throw latestError;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn("No releases found for this repository", {
          owner: this.owner,
          repo: this.repo,
        });
        return null;
      }

      if (error.response?.status === 403) {
        logger.error("GitHub API: Access forbidden", {
          owner: this.owner,
          repo: this.repo,
          message: error.response.data?.message,
        });
      } else if (error.code === "ECONNABORTED") {
        logger.error("GitHub API timeout - check network or increase timeout", {
          owner: this.owner,
          repo: this.repo,
        });
      } else {
        logger.error(`GitHub API error: ${error.message}`, {
          owner: this.owner,
          repo: this.repo,
          status: error.response?.status,
        });
      }

      throw error;
    }
  }

  async getReleaseByTag(tag) {
    try {
      const response = await this.client.get(
        `/repos/${this.owner}/${this.repo}/releases/tags/${tag}`,
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn(`Release tag not found: ${tag}`);
        return null;
      }
      throw error;
    }
  }

  async getAssetContent(assetUrl) {
    try {
      const response = await axios.get(assetUrl, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/octet-stream",
        },
        responseType: "text",
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch asset: ${assetUrl}`, {
        error: error.message,
      });
      throw error;
    }
  }

  findAsset(release, target, arch) {
    if (!release?.assets) return null;

    const patterns = this.#getAssetPatterns(target, arch);

    for (const pattern of patterns) {
      const asset = release.assets.find((a) =>
        a.name.toLowerCase().includes(pattern.toLowerCase()),
      );
      if (asset) return asset;
    }

    logger.debug("No matching asset found", {
      target,
      arch,
      availableAssets: release.assets.map((a) => a.name),
    });

    return null;
  }

  #getAssetPatterns(target, arch) {
    const patterns = {
      windows: [
        ".exe",
        ".msi",
        "-setup.exe",
        "_x64-setup.exe",
        "_x64_en-US.msi",
      ],
      darwin:
        arch === "aarch64"
          ? [
              "aarch64.app.tar.gz",
              "arm64.app.tar.gz",
              "aarch64.dmg",
              "arm64.dmg",
            ]
          : ["x64.app.tar.gz", "x86_64.app.tar.gz", "x64.dmg", "intel.dmg"],
      linux: [
        ".AppImage",
        ".AppImage.tar.gz",
        "_amd64.deb",
        "_amd64.rpm",
        "amd64.AppImage",
      ],
    };

    return patterns[target] || [];
  }

  async findSignatureAsset(release, binaryAsset) {
    if (!binaryAsset) return null;

    const sigPatterns = [
      `${binaryAsset.name}.sig`,
      `${binaryAsset.name}.signature`,
      binaryAsset.name.replace(
        /\.(exe|msi|tar\.gz|dmg|deb|rpm|AppImage)$/,
        ".sig",
      ),
    ];

    for (const pattern of sigPatterns) {
      const sigAsset = release.assets.find((a) => a.name === pattern);
      if (sigAsset) return sigAsset;
    }

    return null;
  }

  async checkReleaseExists(version) {
    try {
      // Try v0.2.5 format
      const response = await this.client.get(
        `/repos/${this.owner}/${this.repo}/releases/tags/v${version}`,
      );
      return response.data;
    } catch (error) {
      // Try without 'v' prefix
      try {
        const response = await this.client.get(
          `/repos/${this.owner}/${this.repo}/releases/tags/${version}`,
        );
        return response.data;
      } catch {
        return null;
      }
    }
  }
}

export default GitHubService;
