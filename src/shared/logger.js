const pino = require("pino");
const { env } = require("../config/env");

const isDevelopment = env.nodeEnv === "development";

const logger = pino({
  level: isDevelopment ? "debug" : "info",
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      }
    : undefined,
  base: {
    env: env.nodeEnv,
    timezone: env.appTimezone
  },
  redact: {
    paths: ["req.headers.authorization", "res.headers.authorization"],
    remove: true
  }
});

function logRequest(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration_ms: duration,
        ip: req.ip,
        userAgent: req.get("user-agent")
      },
      "HTTP Request"
    );
  });

  next();
}

function logError(error, req) {
  logger.error(
    {
      err: {
        message: error.message,
        stack: error.stack,
        status: error.status
      },
      method: req?.method,
      url: req?.originalUrl,
      ip: req?.ip
    },
    "Error no manejado"
  );
}

module.exports = { logger, logRequest, logError };
