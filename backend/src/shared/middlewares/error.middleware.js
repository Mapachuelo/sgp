const logger = require('../logger');

function errorMiddleware(err, _req, res, _next) {
  if (!err.statusCode) {
    logger.error({ err }, 'Error interno del servidor');
    err.statusCode = 500;
    err.message = 'Error interno del servidor';
  }

  res.status(err.statusCode).json({
    ok: false,
    error: err.message,
  });
}

module.exports = errorMiddleware;
