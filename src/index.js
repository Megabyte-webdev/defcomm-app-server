import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import config from "./config.js";
import logger from "./utils/logger.js";
import rateLimiter from "./middleware/rateLimit.js";
import { requestLogger, errorLogger } from "./middleware/logging.js";

// Routes
import updatesRouter from "./routes/updates.js";
import healthRouter from "./routes/health.js";

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
app.use("/", healthRouter);

// ============================================
// LOG DOWNLOAD ENDPOINTS (No Render upgrade needed!)
// ============================================

// Get list of available log files
app.get("/logs", (req, res) => {
  try {
    const logsDir = path.join(__dirname, "../logs");

    if (!fs.existsSync(logsDir)) {
      return res.json({ logs: [], message: "No logs directory found" });
    }

    const files = fs
      .readdirSync(logsDir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => ({
        name: f,
        size: fs.statSync(path.join(logsDir, f)).size,
        modified: fs.statSync(path.join(logsDir, f)).mtime,
      }));

    res.json({ logs: files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download specific log file
app.get("/logs/:filename", (req, res) => {
  try {
    const { filename } = req.params;

    // Security: prevent directory traversal
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const logsDir = path.join(__dirname, "../logs");
    const filepath = path.join(logsDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "Log file not found" });
    }

    // Stream the file
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(filepath);
    stream.pipe(res);

    stream.on("error", (err) => {
      logger.error("Stream error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream failed" });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent logs (last N lines) - useful for quick debugging
app.get("/logs/:filename/tail", (req, res) => {
  try {
    const { filename } = req.params;
    const lines = parseInt(req.query.lines) || 100;

    // Security: prevent directory traversal
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const logsDir = path.join(__dirname, "../logs");
    const filepath = path.join(logsDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "Log file not found" });
    }

    // Read last N lines
    const content = fs.readFileSync(filepath, "utf8");
    const allLines = content.split("\n").filter((l) => l.trim());
    const lastLines = allLines.slice(-lines);

    res.json({
      filename,
      totalLines: allLines.length,
      lines: lastLines,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get combined recent logs from all files
app.get("/logs/recent", (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 50;
    const logsDir = path.join(__dirname, "../logs");

    if (!fs.existsSync(logsDir)) {
      return res.json({ logs: [], message: "No logs directory found" });
    }

    const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".log"));

    const recentEntries = [];

    for (const file of files) {
      const filepath = path.join(logsDir, file);
      const content = fs.readFileSync(filepath, "utf8");
      const logLines = content
        .split("\n")
        .filter((l) => l.trim())
        .slice(-lines)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        });

      recentEntries.push({
        file,
        entries: logLines,
      });
    }

    res.json({ recent: recentEntries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    dashboard: `http://localhost:${config.port}/dashboard`,
    logs: `http://localhost:${config.port}/logs`,
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
