import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";
import logger from "./utils/logger.js";
import rateLimiter from "./middleware/rateLimit.js";
import { requestLogger, errorLogger } from "./middleware/logging.js";
import cacheService from "./services/cache.js";

// Routes
import updatesRouter from "./routes/updates.js";
import healthRouter from "./routes/health.js";
import logsRouter from "./routes/logs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
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
    origin: [
      "http://localhost:1420",
      "http://localhost:1421",
      "http://localhost:3000",
      "tauri://localhost",
      "https://tauri.localhost",
      "https://defcomm-app-server.onrender.com",
    ],
    credentials: true,
    allowedHeaders: ["X-API-Key", "Content-Type", "Authorization"],
    methods: ["GET", "OPTIONS"],
  }),
);

// Compression
app.use(compression());

// Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy
app.set("trust proxy", 1);

// Static files (Dashboard)
app.use(express.static(path.join(__dirname, "../public")));

// Logging
app.use(requestLogger);

// Rate limiting (skip for dashboard assets)
app.use("/api", rateLimiter);

// Routes
app.use("/api/updates", updatesRouter);
app.use("/health", healthRouter);
app.use("/logs", logsRouter);

// Dashboard route
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Root endpoint
app.get("/", (req, res) => {
  res.redirect("/dashboard");
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

// ============================================
// START SERVER WITH CACHE CLEAR
// ============================================

// Async startup function
async function startServer() {
  // Clear cache on startup (optional - comment out if not needed)
  try {
    await cacheService.clear();
    console.log("✅ Cache cleared on startup");
  } catch (error) {
    console.warn("⚠️ Failed to clear cache:", error.message);
  }

  const server = app.listen(config.port, () => {
    console.log(`\n=================================`);
    console.log(`🚀 Server running on port ${config.port}`);
    console.log(`📋 Logs: http://localhost:${config.port}/logs`);
    console.log(`🏥 Health: http://localhost:${config.port}/health`);
    console.log(`📊 Dashboard: http://localhost:${config.port}/dashboard`);
    console.log(`=================================\n`);

    logger.info(`🚀 Update server running on port ${config.port}`, {
      environment: config.nodeEnv,
      owner: config.github.owner,
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
}

// Start the server
startServer();

export default app;
