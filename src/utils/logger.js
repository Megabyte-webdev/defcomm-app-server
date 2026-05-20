import winston from "winston";
import config from "../config.js";

// Define the base format for all logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Define transports based on environment
const transports = [];

if (config.nodeEnv === "production") {
  // In production (Vercel), we MUST use Console.
  // Vercel automatically captures console output and displays it in your logs tab.
  transports.push(
    new winston.transports.Console({
      format: logFormat,
    }),
  );
} else {
  // Local development: keep your file logging if you prefer
  transports.push(
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

const logger = winston.createLogger({
  level: config.logLevel || "info",
  format: logFormat,
  defaultMeta: { service: "tauri-update-server" },
  transports: transports,
});

// Create a stream for Morgan
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

export default logger;
