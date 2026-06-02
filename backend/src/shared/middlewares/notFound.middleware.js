function notFoundMiddleware(_req, res) {
  res.status(404).json({
    ok: false,
    error: 'Ruta no encontrada',
  });
}

module.exports = notFoundMiddleware;
