const pino = require('pino');
const path = require('path');

const actividadStream = pino.destination({
  dest: path.join(__dirname, '..', '..', 'logs.txt'),
  sync: false,
});

const erroresStream = pino.destination({
  dest: path.join(__dirname, '..', '..', 'errores.txt'),
  sync: false,
});

const logger = pino(
  {
    level: 'info',
  },
  pino.multistream([
    { level: 'info', stream: actividadStream },
    { level: 'warn', stream: erroresStream },
  ])
);

module.exports = logger;
