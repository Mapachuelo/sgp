const { logError } = require("../logger");

function errorHandler(error, req, res, _next) {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";

  if (status >= 500) {
    logError(error, req);
  }

  res.status(status).json({
    ok: false,
    error: message,
    message,
    details: error.details || null
  });
}

module.exports = { errorHandler };
