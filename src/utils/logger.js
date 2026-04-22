import winston from "winston";
import config from "../config.js";

// Create transports array
const transports = [
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: "logs/combined.log",
    maxsize: 10485760,
    maxFiles: 5,
  }),
];

// Add console transport immediately for development
if (config.nodeEnv !== "production") {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "tauri-update-server" },
  transports: transports, // Use the transports array
});

// Create a stream for Morgan
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

export default logger;
