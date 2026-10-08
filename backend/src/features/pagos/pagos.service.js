const crypto = require('crypto');
const pagosModel = require('./pagos.model');
const wompi = require('../../integrations/pagos/wompi');
const env = require('../../config/env');
const HttpError = require('../../shared/http-error');
const { withTransaction } = require('../../config/db');

const MAPA_ESTADOS_WOMPI = {
  APPROVED: 'aprobado',
  DECLINED: 'declinado',
  ERROR: 'error',
  VOIDED: 'anulado',
  PENDING: 'pendiente',
};

const ESTADOS_FINALES = new Set(['aprobado', 'declinado', 'error', 'anulado']);

function mapearEstadoWompi(estado) {
  return MAPA_ESTADOS_WOMPI[estado] || 'error';
}

function generarReferencia(reservaId) {
  return `SGP-${reservaId}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function formatear(pago) {
  return {
    pago_id: pago.id,
    reserva_id: pago.reserva_id,
    referencia: pago.referencia,
    transaction_id: pago.transaction_id,
    estado: pago.estado,
    metodo: pago.metodo,
    monto: Number(pago.monto),
    moneda: pago.moneda,
    actualizado_en: pago.actualizado_en,
  };
}

async function sincronizarPago(pagoId, transaccion) {
  return withTransaction(async (client) => {
    const pago = await pagosModel.findByIdForUpdate(pagoId, client);
    if (!pago) {
      throw new HttpError(404, 'Pago no encontrado');
    }
    if (ESTADOS_FINALES.has(pago.estado)) {
      return { ...formatear(pago), reserva_estado: pago.reserva_estado, idempotente: true };
    }

    const estado = mapearEstadoWompi(transaccion.status);
    const metodo =
      transaccion.payment_method_type || transaccion.payment_method?.type || null;

    const actualizado = await pagosModel.actualizarPago(
      pago.id,
      { estado, transaction_id: transaccion.id, metodo, payload: transaccion },
      client
    );

    let reservaEstado = pago.reserva_estado;
    if (estado === 'aprobado') {
      const confirmada = await pagosModel.confirmarReservaSiPendiente(pago.reserva_id, client);
      if (confirmada) reservaEstado = 'confirmada';
    }

    return { ...formatear(actualizado), reserva_estado: reservaEstado };
  });
}

const pagosService = {
  async crearIntencion({ reserva_id }, usuario) {
    const reservaId = Number(reserva_id);
    if (!Number.isInteger(reservaId) || reservaId <= 0) {
      throw new HttpError(400, 'reserva_id es requerido y debe ser un numero valido');
    }

    const reserva = await pagosModel.findReservaParaPago(reservaId);
    if (!reserva) {
      throw new HttpError(404, 'Reserva no encontrada');
    }
    if (reserva.cliente_id !== usuario.id) {
      throw new HttpError(403, 'No puede pagar una reserva de otro cliente');
    }
    if (reserva.estado === 'cancelada') {
      throw new HttpError(409, 'La reserva esta cancelada');
    }
    if (reserva.estado === 'cobrado') {
      throw new HttpError(409, 'La reserva ya fue cobrada');
    }

    const aprobado = await pagosModel.findAprobadoByReservaId(reservaId);
    if (aprobado) {
      throw new HttpError(409, 'La reserva ya tiene un pago aprobado');
    }

    const monto = Number(reserva.precio_base) * Number(reserva.cantidad_personas || 1);
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new HttpError(400, 'El monto de la reserva no es valido');
    }
    const montoEnCentavos = Math.round(monto * 100);
    const referencia = generarReferencia(reservaId);

    const pago = await pagosModel.crearPago({
      reserva_id: reservaId,
      referencia,
      monto,
      moneda: 'COP',
    });

    const firma = wompi.firmaIntegridad({ referencia, montoEnCentavos, moneda: 'COP' });

    return {
      pago_id: pago.id,
      reserva_id: reservaId,
      referencia,
      monto,
      monto_en_centavos: montoEnCentavos,
      moneda: 'COP',
      llave_publica: env.wompiPublicKey,
      firma_integridad: firma,
      redirect_url: env.wompiRedirectUrl || null,
      customer_data: {
        email: reserva.cliente_email,
        full_name: `${reserva.cliente_nombre} ${reserva.cliente_apellido || ''}`.trim(),
      },
    };
  },

  async obtenerPago(pagoId, usuario) {
    const id = Number(pagoId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'pago_id invalido');
    }
    const pago = await pagosModel.findById(id);
    if (!pago) {
      throw new HttpError(404, 'Pago no encontrado');
    }
    if (usuario.rol === 'cliente' && pago.cliente_id !== usuario.id) {
      throw new HttpError(403, 'No tiene acceso a este pago');
    }
    return formatear(pago);
  },

  async verificarPago(pagoId, { transaction_id }, usuario) {
    const id = Number(pagoId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'pago_id invalido');
    }
    if (!transaction_id || typeof transaction_id !== 'string') {
      throw new HttpError(400, 'transaction_id es requerido');
    }

    const pago = await pagosModel.findById(id);
    if (!pago) {
      throw new HttpError(404, 'Pago no encontrado');
    }
    if (usuario.rol === 'cliente' && pago.cliente_id !== usuario.id) {
      throw new HttpError(403, 'No tiene acceso a este pago');
    }
    if (ESTADOS_FINALES.has(pago.estado)) {
      return formatear(pago);
    }

    const transaccion = await wompi.consultarTransaccion(transaction_id.trim());
    if (!transaccion) {
      throw new HttpError(404, 'Transaccion no encontrada en Wompi');
    }
    if (transaccion.reference !== pago.referencia) {
      throw new HttpError(400, 'La transaccion no corresponde a este pago');
    }
    if (Number(transaccion.amount_in_cents) !== Math.round(Number(pago.monto) * 100)) {
      throw new HttpError(400, 'El monto de la transaccion no coincide con el pago');
    }

    return sincronizarPago(pago.id, transaccion);
  },

  async procesarEvento(evento) {
    if (!wompi.validarChecksumEvento(evento)) {
      throw new HttpError(401, 'Firma del evento invalida');
    }

    const transaccion = evento?.data?.transaction;
    if (!transaccion || !transaccion.reference) {
      return { ignorado: true };
    }

    const pago = await pagosModel.findByReferencia(transaccion.reference);
    if (!pago) {
      return { ignorado: true, referencia: transaccion.reference };
    }
    if (ESTADOS_FINALES.has(pago.estado)) {
      return { ...formatear(pago), idempotente: true };
    }

    return sincronizarPago(pago.id, transaccion);
  },
};

module.exports = pagosService;
module.exports.mapearEstadoWompi = mapearEstadoWompi;
module.exports.sincronizarPago = sincronizarPago;
