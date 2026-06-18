const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./shared/logger');
const initDatabase = require('./config/database-init');
const setupWebSocket = require('./integrations/realtime/ws-hub');

const server = http.createServer(app);

setupWebSocket(server);

initDatabase()
  .then(() => {
    server.listen(env.port, () => {
      logger.info(`Servidor SGP iniciado en puerto ${env.port}`);
      console.log(`Servidor SGP iniciado en puerto ${env.port}`);
    });
  })
  .catch((err) => {
    logger.error({ err }, 'Error fatal al iniciar el servidor');
    process.exit(1);
  });
