const logger = require('../logger');

function errorMiddleware(err, _req, res, _next) {
  if (!err.statusCode) {
    if (err.code === '23505') {
      err.statusCode = 409;
      err.message = 'Ya existe un registro con esos datos';
    } else if (err.code === '23503') {
      err.statusCode = 400;
      err.message = 'Referencia invalida: el registro relacionado no existe';
    } else if (err.code === '23514') {
      err.statusCode = 400;
      err.message = 'Valor fuera del rango permitido';
    } else if (err.code === '22P02') {
      err.statusCode = 400;
      err.message = 'Formato de dato invalido';
    }
  }

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