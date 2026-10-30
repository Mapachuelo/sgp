const reservasModel = require('./reservas.model');
const pagosModel = require('../pagos/pagos.model');
const notificacionesModel = require('../notificaciones/notificaciones.model');
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

function horaBogota(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function textoReembolso(reembolso) {
  if (reembolso === 'procesado') return ' El reembolso ya fue procesado.';
  if (reembolso === 'pendiente') return ' El reembolso queda pendiente de gestión.';
  return '';
}

function fechaTexto(fecha) {
  if (!fecha) return '';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha))
    ? `${fecha}T12:00:00-05:00`
    : fecha;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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
    const hora = horaBogota(reserva.inicia_en);
    if (reserva.cliente_id) {
      try {
        await notificacionesModel.create({
          usuario_id: reserva.cliente_id,
          reserva_id: reservaId,
          tipo: 'reserva_cancelada',
          titulo: 'Tu cita fue cancelada',
          mensaje: `La cita del ${fechaTexto(fecha)}${hora ? ` a las ${hora}` : ''} fue cancelada. Motivo: ${motivo}.${textoReembolso(reembolso)}`,
          metadata: { motivo, reembolso, fecha, hora },
        });
      } catch (error) {
        logger.warn({ error, reserva_id: reservaId }, 'No se pudo guardar la notificacion de cancelacion');
      }
    }

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

async function cancelarReservasPorIds(ids, motivo) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const reservas = await reservasModel.findReservasParaCancelacion(ids);
  return cancelarReservasConReembolso(reservas, motivo);
}

module.exports = { cancelarReservasConReembolso, cancelarReservasPorIds, fechaBogota };
