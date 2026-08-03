const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    ok: false,
    error: 'Demasiados intentos. Intente nuevamente en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const verificacionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    ok: false,
    error: 'Demasiados reenvios. Intente nuevamente en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, verificacionLimiter };
