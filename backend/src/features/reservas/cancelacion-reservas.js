const reservasModel = require('./reservas.model');
const pagosModel = require('../pagos/pagos.model');
const wompi = require('../../integrations/pagos/wompi');
const { enviarCorreoCancelacion } = require('../../integrations/email/mailer');
const env = require('../../config/env');
const logger = require('../../shared/logger');

function fechaBogota(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

async function cancelarReservasConReembolso(reservas, motivo, fechaComun = null) {
  const resultados = [];
  for (const reserva of reservas) {
    const reservaId = reserva.reserva_id || reserva.id;
    const cancelada = await reservasModel.cancelarReservaEmpleado(reservaId, motivo);
    if (!cancelada) continue;

    let reembolso = 'no_aplica';
    if (reserva.pago_id && reserva.pago_estado === 'aprobado') {
      const metodo = String(reserva.pago_metodo || '').toUpperCase();
      if (metodo === 'CARD' && reserva.pago_transaction_id && env.wompiPrivateKey) {
        try {
          await wompi.anularTransaccion(reserva.pago_transaction_id);
          await pagosModel.actualizarReembolso(reserva.pago_id, 'procesado');
          await pagosModel.marcarCobroReembolsado(reservaId);
          reembolso = 'procesado';
        } catch (error) {
          logger.warn({ error, pago_id: reserva.pago_id }, 'No se pudo anular el pago en Wompi');
          await pagosModel.actualizarReembolso(reserva.pago_id, 'pendiente');
          reembolso = 'pendiente';
        }
      } else {
        await pagosModel.actualizarReembolso(reserva.pago_id, 'pendiente');
        reembolso = 'pendiente';
      }
    }

    const fecha = fechaComun || fechaBogota(reserva.inicia_en);
    try {
      await enviarCorreoCancelacion({
        email: reserva.cliente_email,
        nombre: `${reserva.cliente_nombre || ''} ${reserva.cliente_apellido || ''}`.trim(),
        fecha,
        motivo,
        reembolso,
      });
    } catch (error) {
      logger.warn({ error, reserva_id: reservaId }, 'No se pudo enviar el correo de cancelacion');
    }

    resultados.push({
      reserva_id: reservaId,
      cliente_id: reserva.cliente_id,
      cliente_email: reserva.cliente_email,
      pago_id: reserva.pago_id || null,
      reembolso,
    });
  }
  return resultados;
}

module.exports = { cancelarReservasConReembolso, fechaBogota };
