import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Get list of available log files
router.get("/", (req, res) => {
  try {
    const logsDir = path.join(__dirname, "../../logs");
    console.log("📁 Logs directory:", logsDir);
    console.log("📁 Directory exists:", fs.existsSync(logsDir));

    if (!fs.existsSync(logsDir)) {
      // Create the directory if it doesn't exist
      fs.mkdirSync(logsDir, { recursive: true });
      return res.json({
        logs: [],
        message: "Logs directory created. No logs yet.",
      });
    }

    const files = fs
      .readdirSync(logsDir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => {
        const filePath = path.join(logsDir, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          modified: stats.mtime,
        };
      });

    res.json({
      logs: files,
      directory: logsDir,
      count: files.length,
    });
  } catch (error) {
    logger.error("Error reading logs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Download specific log file
router.get("/:filename", (req, res) => {
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

    const logsDir = path.join(__dirname, "../../logs");
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

// Get recent logs (last N lines)
router.get("/:filename/tail", (req, res) => {
  try {
    const { filename } = req.params;
    const lines = parseInt(req.query.lines) || 100;

    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const logsDir = path.join(__dirname, "../../logs");
    const filepath = path.join(logsDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "Log file not found" });
    }

    const content = fs.readFileSync(filepath, "utf8");
    const allLines = content.split("\n").filter((l) => l.trim());
    const lastLines = allLines.slice(-lines);

    res.json({
      filename,
      totalLines: allLines.length,
      requestedLines: lines,
      lines: lastLines,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get combined recent logs from all files
router.get("/combined/recent", (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 50;
    const logsDir = path.join(__dirname, "../../logs");

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

// Helper function
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default router;
