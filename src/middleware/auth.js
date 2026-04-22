import config from "../config.js";
import logger from "../utils/logger.js";

export function authenticateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.query.api_key;

  if (!apiKey) {
    logger.warn("Missing API key", { ip: req.ip, path: req.path });
    return res.status(401).json({
      error: "Unauthorized",
      message: "API key required",
    });
  }

  // Check if API key matches (supports multiple keys comma-separated)
  const validKeys = config.apiKey.split(",").map((k) => k.trim());

  if (!validKeys.includes(apiKey)) {
    logger.warn("Invalid API key", {
      ip: req.ip,
      path: req.path,
      key: apiKey.substring(0, 8) + "...",
    });
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid API key",
    });
  }

  next();
}
