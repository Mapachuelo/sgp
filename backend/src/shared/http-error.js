class HttpError extends Error {
  constructor(statusCode, message, detalles = null) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
    if (detalles) this.detalles = detalles;
  }
}

module.exports = HttpError;
