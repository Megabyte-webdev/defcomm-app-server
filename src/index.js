import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import config from "./config.js";
import logger from "./utils/logger.js";
import rateLimiter from "./middleware/rateLimit.js";
import { requestLogger, errorLogger } from "./middleware/logging.js";

// Routes
import updatesRouter from "./routes/updates.js";
import healthRouter from "./routes/health.js";

// Validate configuration
try {
  config.validate();
} catch (error) {
  logger.error("Configuration error:", error.message);
  process.exit(1);
}

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin.startsWith("tauri://") ||
        origin.startsWith("https://tauri.localhost")
      ) {
        callback(null, true);
      } else if (config.nodeEnv === "development") {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  }),
);

// Compression
app.use(compression());

// Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy
app.set("trust proxy", 1);

// Logging
app.use(requestLogger);

// Rate limiting
app.use(rateLimiter);

// Routes
app.use("/api/updates", updatesRouter);
app.use("/", healthRouter);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "Tauri Update Server",
    version: "1.0.0",
    owner: config.github.owner,
    status: "operational",
    apps: "Dynamic - Uses app ID from URL as repo name",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler
app.use(errorLogger);

// Start server
const server = app.listen(config.port, () => {
  logger.info(`🚀 Update server running on port ${config.port}`, {
    environment: config.nodeEnv,
    owner: config.github.owner,
    url: `http://localhost:${config.port}`,
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

export default app;
