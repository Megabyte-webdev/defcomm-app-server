import { createClient } from "redis";
import config from "../config.js";
import logger from "../utils/logger.js";

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.client = null;
    this.redisEnabled = config.redis.enabled;
    this.connectionAttempted = false;
    this.connectionFailed = false;

    // Only try Redis if explicitly enabled and URL is provided
    if (this.redisEnabled && config.redis.url) {
      this.#initRedis();
    } else {
      logger.info("Using in-memory cache (Redis not configured)");
    }
  }

  async #initRedis() {
    // Prevent multiple connection attempts
    if (this.connectionAttempted) return;
    this.connectionAttempted = true;

    try {
      this.client = createClient({
        url: config.redis.url,
        socket: {
          reconnectStrategy: (retries) => {
            // Stop reconnecting after 3 attempts in development
            if (config.nodeEnv === "development" && retries > 3) {
              logger.warn(
                "Redis connection failed in development, using memory cache",
              );
              this.connectionFailed = true;
              this.redisEnabled = false;
              return false; // Stop reconnecting
            }
            // In production, keep trying with exponential backoff
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on("error", (err) => {
        if (!this.connectionFailed) {
          logger.warn("Redis connection error, falling back to memory cache", {
            error: err.message,
          });
          this.connectionFailed = true;
          this.redisEnabled = false;
        }
      });

      this.client.on("connect", () => {
        logger.info("Redis connected successfully");
        this.connectionFailed = false;
        this.redisEnabled = true;
      });

      this.client.on("ready", () => {
        logger.info("Redis client ready");
      });

      await this.client.connect();
    } catch (error) {
      logger.warn("Redis connection failed, using in-memory cache", {
        error: error.message,
      });
      this.connectionFailed = true;
      this.redisEnabled = false;
      this.client = null;
    }
  }

  async get(key) {
    try {
      // Try Redis first if enabled and connected
      if (this.redisEnabled && this.client && this.client.isReady) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      }

      // Fall back to memory cache
      const item = this.memoryCache.get(key);
      if (item && item.expiry > Date.now()) {
        return item.value;
      }

      // Clean up expired items
      if (item) {
        this.memoryCache.delete(key);
      }

      return null;
    } catch (error) {
      logger.error("Cache get error", { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = config.cacheTTL) {
    try {
      const serialized = JSON.stringify(value);

      // Try Redis first if enabled and connected
      if (this.redisEnabled && this.client && this.client.isReady) {
        await this.client.setEx(key, ttl, serialized);
        return;
      }

      // Fall back to memory cache
      this.memoryCache.set(key, {
        value,
        expiry: Date.now() + ttl * 1000,
      });

      // Clean up old memory cache entries periodically
      this.#cleanupMemoryCache();
    } catch (error) {
      logger.error("Cache set error", { key, error: error.message });
      // Still try memory cache as last resort
      this.memoryCache.set(key, {
        value,
        expiry: Date.now() + ttl * 1000,
      });
    }
  }

  #cleanupMemoryCache() {
    // Clean up if cache gets too large (> 1000 entries)
    if (this.memoryCache.size > 1000) {
      const now = Date.now();
      for (const [key, item] of this.memoryCache.entries()) {
        if (item.expiry <= now) {
          this.memoryCache.delete(key);
        }
      }
    }
  }

  async delete(key) {
    try {
      if (this.redisEnabled && this.client && this.client.isReady) {
        await this.client.del(key);
      }
      this.memoryCache.delete(key);
    } catch (error) {
      logger.error("Cache delete error", { key, error: error.message });
      this.memoryCache.delete(key);
    }
  }

  async clear() {
    try {
      if (this.redisEnabled && this.client && this.client.isReady) {
        await this.client.flushAll();
      }
      this.memoryCache.clear();
    } catch (error) {
      logger.error("Cache clear error", { error: error.message });
      this.memoryCache.clear();
    }
  }

  generateKey(appId, target, arch, version, channel = "stable") {
    return `update:${appId}:${target}:${arch}:${version}:${channel}`;
  }

  // Get cache stats
  getStats() {
    return {
      redisEnabled: this.redisEnabled,
      redisConnected: this.client?.isReady || false,
      memoryCacheSize: this.memoryCache.size,
      connectionFailed: this.connectionFailed,
    };
  }
}

export default new CacheService();
