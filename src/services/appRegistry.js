import config from "../config.js";
import logger from "../utils/logger.js";
import GitHubService from "./github.js";

class AppRegistry {
  constructor() {
    this.apps = new Map();
    this.loadApps();
  }

  loadApps() {
    // Load from environment variables with pattern: APP_*_TOKEN
    // Example: APP_DEFCOMM_TOKEN, APP_CHATAPP_TOKEN

    Object.keys(process.env).forEach((key) => {
      const match = key.match(/^APP_([A-Z0-9_]+)_TOKEN$/);
      if (match) {
        const appId = match[1].toLowerCase().replace(/_/g, "-");
        const token = process.env[key];
        const owner = process.env[`APP_${match[1]}_OWNER`];
        const repo = process.env[`APP_${match[1]}_REPO`];

        if (token && owner && repo) {
          this.registerApp(appId, {
            name: appId,
            token,
            owner,
            repo,
            publicKey: process.env[`APP_${match[1]}_PUBLIC_KEY`],
            channels: ["stable", "beta"],
          });

          logger.info(`Registered app: ${appId} (${owner}/${repo})`);
        }
      }
    });

    // Also support config.js apps
    if (config.apps) {
      Object.entries(config.apps).forEach(([appId, appConfig]) => {
        this.registerApp(appId, appConfig);
      });
    }
  }

  registerApp(appId, appConfig) {
    this.apps.set(appId.toLowerCase(), {
      id: appId.toLowerCase(),
      ...appConfig,
    });
  }

  getApp(appId) {
    return this.apps.get(appId?.toLowerCase());
  }

  async validateApp(appId) {
    const app = this.getApp(appId);
    if (app) return app;

    // If not in registry, try to validate dynamically
    return await this.tryDynamicValidation(appId);
  }

  async tryDynamicValidation(appId) {
    // Option 1: Check if GitHub repo exists
    // Option 2: Check against a database
    // Option 3: Check a validation endpoint

    logger.info(`Attempting dynamic validation for: ${appId}`);

    // Example: Parse appId format "owner/repo" or "app-name"
    // For now, return null (not found)
    return null;
  }

  getAllApps() {
    return Array.from(this.apps.values()).map((app) => ({
      id: app.id,
      name: app.name,
      owner: app.owner,
      repo: app.repo,
    }));
  }
}

export default new AppRegistry();
