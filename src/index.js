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

// ✅ FIX: Proper CORS configuration
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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposedHeaders: ["X-API-Key"],
  }),
);

// Handle preflight requests
app.options("*", cors());

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
app.use("/api", rateLimiter);

// Routes
app.use("/api/updates", updatesRouter);
app.use("/", healthRouter);

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
