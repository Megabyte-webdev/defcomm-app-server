import dotenv from "dotenv";

dotenv.config();

const config = {
  // Server config
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  // Security
  apiKey: process.env.API_KEYS || "defcomm@secret",

  // GitHub (single token for all apps)
  github: {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
  },

  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL,
    enabled: !!process.env.REDIS_URL,
  },

  // Cache TTL in seconds
  cacheTTL: parseInt(process.env.CACHE_TTL) || 300,

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",

  // GitHub API
  githubApiUrl: "https://api.github.com",

  validate() {
    const errors = [];

    if (!this.github.token) errors.push("Missing GITHUB_TOKEN");
    if (!this.github.owner) errors.push("Missing GITHUB_OWNER");
    if (!this.apiKey) errors.push("Missing API_KEYS");

    if (errors.length > 0) {
      throw new Error(`Configuration errors:\n${errors.join("\n")}`);
    }

    return true;
  },
};

export default config;
