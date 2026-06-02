const { WebSocketServer } = require('ws');
const url = require('url');
const logger = require('../../shared/logger');

let wss = null;

function setupWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const params = url.parse(req.url, true).query;
    logger.info({ params }, 'Cliente WebSocket conectado');

    ws.send(
      JSON.stringify({
        tipo: 'conexion',
        mensaje: 'Conectado a SGP',
      })
    );

    ws.on('message', (data) => {
      try {
        const mensaje = JSON.parse(data);
        logger.info({ mensaje }, 'Mensaje WebSocket recibido');
      } catch {
        logger.warn('Mensaje WebSocket no es JSON valido');
      }
    });

    ws.on('close', () => {
      logger.info('Cliente WebSocket desconectado');
    });
  });

  logger.info('Servidor WebSocket iniciado en /ws');
}

function broadcast(tipo, datos) {
  if (!wss) return;
  const mensaje = JSON.stringify({ tipo, ...datos });
  wss.clients.forEach((cliente) => {
    if (cliente.readyState === 1) {
      cliente.send(mensaje);
    }
  });
}

function emitDisponibilidadActualizada(empleado_id, fecha) {
  broadcast('disponibilidad.actualizada', { empleado_id, fecha });
}

function emitReservaActualizada(reserva_id, estado) {
  broadcast('reserva.actualizada', { reserva_id, estado });
}

module.exports = setupWebSocket;
module.exports.emitDisponibilidadActualizada = emitDisponibilidadActualizada;
module.exports.emitReservaActualizada = emitReservaActualizada;
