const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const HttpError = require('../http-error');

function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new HttpError(401, 'Token de autenticacion requerido');
    }

    const token = header.split(' ')[1];
    const payload = jwt.verify(token, env.jwtSecret);
    req.usuario = payload;
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      return next(err);
    }
    if (err.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Token expirado, inicie sesion nuevamente'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new HttpError(401, 'Token invalido'));
    }
    next(new HttpError(401, 'Error de autenticacion'));
  }
}

function authorize(...roles) {
  return function (req, _res, next) {
    if (!req.usuario) {
      return next(new HttpError(401, 'Autenticacion requerida'));
    }
    if (!roles.includes(req.usuario.rol)) {
      return next(new HttpError(403, 'No tiene permisos para esta accion'));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
