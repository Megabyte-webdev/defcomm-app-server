import { Router } from "express";
import config from "../config.js";
import cacheService from "../services/cache.js";

const router = Router();

router.get("/health", async (req, res) => {
  const cacheStats = cacheService.getStats();

  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    services: {
      cache:
        cacheStats.redisEnabled && cacheStats.redisConnected
          ? "healthy"
          : cacheStats.redisEnabled && !cacheStats.redisConnected
            ? "degraded"
            : "memory",
      cacheDetails: {
        type:
          cacheStats.redisEnabled && cacheStats.redisConnected
            ? "redis"
            : "memory",
        memoryEntries: cacheStats.memoryCacheSize,
      },
    },
  };

  // Test cache functionality
  try {
    const testKey = "health-check";
    await cacheService.set(testKey, "ok", 10);
    const value = await cacheService.get(testKey);

    if (value !== "ok") {
      health.services.cache = "degraded";
      health.status = "degraded";
    }
  } catch (error) {
    health.services.cache = "unhealthy";
    health.status = "degraded";
    health.error = error.message;
  }

  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get("/ready", (req, res) => {
  const cacheStats = cacheService.getStats();
  res.status(200).json({
    status: "ready",
    cache: cacheStats.redisConnected ? "redis" : "memory",
  });
});

router.get("/stats", (req, res) => {
  const cacheStats = cacheService.getStats();
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cacheStats,
    github: {
      owner: config.github.owner,
      hasToken: !!config.github.token,
    },
    nodeVersion: process.version,
    environment: config.nodeEnv,
  });
});

export default router;
