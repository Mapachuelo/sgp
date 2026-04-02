const jwt = require("jsonwebtoken");
const { env } = require("../../config/env");
const { HttpError } = require("../httpError");

function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Token de autenticacion requerido"));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.auth = payload;
    return next();
  } catch (_error) {
    return next(new HttpError(401, "Token invalido o expirado"));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth) {
      return next(new HttpError(401, "No autenticado"));
    }

    if (!roles.includes(req.auth.role)) {
      return next(new HttpError(403, "No autorizado para este recurso"));
    }

    return next();
  };
}

module.exports = { requireAuth, requireRole };
