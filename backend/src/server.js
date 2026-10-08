const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./shared/logger');
const initDatabase = require('./config/database-init');
const setupWebSocket = require('./integrations/realtime/ws-hub');
const { purgarNoVerificados } = require('./features/auth/purga.service');
const { verificarCredencialesBrevo } = require('./integrations/email/mailer');
const { verificarCredencialesWompi } = require('./integrations/pagos/wompi');

const server = http.createServer(app);

setupWebSocket(server);

initDatabase()
  .then(() => {
    purgarNoVerificados().catch((err) =>
      logger.error({ err }, 'Error al purgar registros sin verificar')
    );
    const purgaPeriodica = setInterval(() => {
      purgarNoVerificados().catch((err) =>
        logger.error({ err }, 'Error al purgar registros sin verificar')
      );
    }, 60000);
    purgaPeriodica.unref();

    verificarCredencialesBrevo()
      .then((estado) => {
        if (estado.estado === 'ok') {
          logger.info('Brevo OK: credenciales de correo validas');
        } else {
          logger.warn(
            { estado: estado.estado, detalle: estado.detalle },
            'Brevo no disponible: los correos OTP no se enviaran'
          );
        }
      })
      .catch((err) => logger.error({ err }, 'Error al validar credenciales de Brevo'));

    verificarCredencialesWompi()
      .then((estado) => {
        if (estado.estado === 'ok') {
          logger.info('Wompi OK: credenciales de pago validas');
        } else {
          logger.warn(
            { estado: estado.estado, detalle: estado.detalle },
            'Wompi no disponible: los pagos en linea no se procesaran'
          );
        }
      })
      .catch((err) => logger.error({ err }, 'Error al validar credenciales de Wompi'));

    server.listen(env.port, () => {
      logger.info(`Servidor SGP iniciado en puerto ${env.port}`);
      console.log(`Servidor SGP iniciado en puerto ${env.port}`);
    });
  })
  .catch((err) => {
    logger.error({ err }, 'Error fatal al iniciar el servidor');
    process.exit(1);
  });
