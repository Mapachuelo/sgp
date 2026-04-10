function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";

  res.status(status).json({
    ok: false,
    error: message,
    message,
    details: error.details || null
  });
}

module.exports = { errorHandler };
