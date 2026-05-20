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
import logsRouter from "./routes/logs.js";

// Configuration validation: Just log the error, do NOT use process.exit
try {
  config.validate();
} catch (error) {
  logger.error("Configuration error:", error.message);
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

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy is required for Vercel
app.set("trust proxy", 1);

// Logging
app.use(requestLogger);

// Rate limiting (API only)
app.use("/api", rateLimiter);

// Routes
app.use("/api/updates", updatesRouter);
app.use("/health", healthRouter);
app.use("/logs", logsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler
app.use(errorLogger);

// Note: No startServer(), no app.listen()

export default app;
