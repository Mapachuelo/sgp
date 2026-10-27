const checkinModel = require('./checkin.model');
const HttpError = require('../../shared/http-error');
const { withTransaction } = require('../../config/db');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS_CERRADOS = new Set(['cancelada', 'cobrado']);

function validarAcceso(reserva, usuario) {
  if (usuario?.rol !== 'empleado') return;
  if (reserva.empleado_id === usuario.id) return;
  if (Array.isArray(reserva.empleados_ids) && reserva.empleados_ids.includes(usuario.id)) return;
  throw new HttpError(403, 'La reserva pertenece a otro empleado');
}

function validarQr(qr_token) {
  if (!qr_token || typeof qr_token !== 'string' || !UUID_REGEX.test(qr_token.trim())) {
    throw new HttpError(400, 'qr_token es requerido y debe ser un UUID valido');
  }
  return qr_token.trim();
}

function validarReservaId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'reserva_id es requerido y debe ser un numero valido');
  }
  return id;
}

function parsearMonto(valor) {
  const monto = valor === undefined || valor === null || valor === '' ? 0 : Number(valor);
  if (!Number.isFinite(monto) || monto < 0) {
    throw new HttpError(400, 'monto debe ser un numero mayor o igual a 0');
  }
  return monto;
}

function resumen(reserva, pagoAprobado, ultimoPago, cobro) {
  const total = Number(reserva.precio_total) * Number(reserva.cantidad_personas || 1);
  const pagoMonto = pagoAprobado ? Number(pagoAprobado.monto) : ultimoPago ? Number(ultimoPago.monto) : null;
  const monto = cobro ? Number(cobro.monto) : pagoAprobado ? Number(pagoAprobado.monto) : total;
  const pagado = Boolean(pagoAprobado || cobro);
  const pagadoAntes =
    cobro?.pagado_antes ??
    (pagoAprobado?.actualizado_en
      ? new Date(pagoAprobado.actualizado_en) < new Date(reserva.inicia_en)
      : false);

  return {
    reserva_id: reserva.id,
    estado: reserva.estado,
    cliente_nombre: `${reserva.cliente_nombre || ''} ${reserva.cliente_apellido || ''}`.trim(),
    servicio_nombre: reserva.servicio_nombre,
    inicia_en: reserva.inicia_en,
    termina_en: reserva.termina_en,
    cantidad_personas: reserva.cantidad_personas,
    precio_total: Number(reserva.precio_total),
    precio_base: Number(reserva.precio_total),
    total,
    llego_en: reserva.llego_en,
    inicio_servicio: reserva.inicio_servicio,
    fin_servicio: reserva.fin_servicio,
    pago_id: pagoAprobado?.id || cobro?.pago_id || null,
    pago_estado: pagoAprobado ? 'aprobado' : ultimoPago?.estado || null,
    pago_metodo: pagoAprobado?.metodo || ultimoPago?.metodo || null,
    pago_monto: pagoMonto,
    pago_transaction_id: pagoAprobado?.transaction_id || ultimoPago?.transaction_id || null,
    pagado,
    pagado_online: Boolean(pagoAprobado),
    pagado_antes: Boolean(pagadoAntes),
    cobro_id: cobro?.id || null,
    cobro_metodo: cobro?.metodo || null,
    monto,
    metodo: cobro?.metodo || (pagoAprobado ? 'online' : null),
    metodo_pago: cobro?.metodo || (pagoAprobado ? 'online' : null),
    puede_iniciar: pagado && !ESTADOS_CERRADOS.has(reserva.estado),
    ya_atendido: reserva.estado === 'cobrado',
  };
}

async function cargarResumen(reserva, db) {
  const [pagoAprobado, ultimoPago, cobro] = await Promise.all([
    checkinModel.findPagoAprobado(reserva.id, db),
    checkinModel.findUltimoPago(reserva.id, db),
    checkinModel.findCobroByReservaId(reserva.id, db),
  ]);
  return resumen(reserva, pagoAprobado, ultimoPago, cobro);
}

async function asegurarCobroOnline(reserva, pagoAprobado, db) {
  if (!pagoAprobado) return null;
  const existente = await checkinModel.findCobroByReservaId(reserva.id, db);
  if (existente) return existente;
  const pagadoAntes = new Date(pagoAprobado.actualizado_en) < new Date(reserva.inicia_en);
  return checkinModel.registrarCobro(
    reserva.id,
    Number(pagoAprobado.monto),
    'online',
    null,
    pagoAprobado.id,
    pagadoAntes,
    db
  );
}

const checkinService = {
  async consultar(data, usuario) {
    const qr_token = validarQr(data?.qr_token);
    const reserva = await checkinModel.findReservaByQrToken(qr_token);
    if (!reserva) {
      throw new HttpError(404, 'QR no valido: reserva no encontrada');
    }
    validarAcceso(reserva, usuario);
    return cargarResumen(reserva);
  },

  async llegada(data, usuario) {
    const qr_token = validarQr(data?.qr_token);
    return withTransaction(async (client) => {
      const reserva = await checkinModel.findReservaByQrTokenForUpdate(qr_token, client);
      if (!reserva) {
        throw new HttpError(404, 'QR no valido: reserva no encontrada');
      }
      validarAcceso(reserva, usuario);
      if (reserva.estado === 'cancelada') {
        throw new HttpError(409, 'La reserva esta cancelada');
      }
      await checkinModel.registrarLlegada(reserva.id, client);
      const actualizada = { ...reserva, llego_en: reserva.llego_en || new Date() };
      return cargarResumen(actualizada, client);
    });
  },

  async cobroEfectivo(data, usuario) {
    const reservaId = validarReservaId(data?.reserva_id);
    const monto = parsearMonto(data?.monto);
    if (monto <= 0) {
      throw new HttpError(400, 'monto debe ser mayor a 0 para un cobro en efectivo');
    }

    return withTransaction(async (client) => {
      const reserva = await checkinModel.findReservaByIdForUpdate(reservaId, client);
      if (!reserva) throw new HttpError(404, 'Reserva no encontrada');
      validarAcceso(reserva, usuario);
      if (reserva.estado === 'cancelada') throw new HttpError(409, 'La reserva esta cancelada');
      if (reserva.estado === 'cobrado') throw new HttpError(409, 'La reserva ya fue atendida');

      const [cobro, pagoAprobado] = await Promise.all([
        checkinModel.findCobroByReservaId(reserva.id, client),
        checkinModel.findPagoAprobado(reserva.id, client),
      ]);
      if (cobro) throw new HttpError(409, 'La reserva ya tiene un cobro registrado');
      if (pagoAprobado) throw new HttpError(409, 'La reserva ya tiene un pago en linea aprobado');

      await checkinModel.registrarCobro(reserva.id, monto, 'fisico', usuario.id, null, false, client);
      return cargarResumen(reserva, client);
    });
  },

  async iniciar(data, usuario) {
    const reservaId = validarReservaId(data?.reserva_id);
    return withTransaction(async (client) => {
      const reserva = await checkinModel.findReservaByIdForUpdate(reservaId, client);
      if (!reserva) throw new HttpError(404, 'Reserva no encontrada');
      validarAcceso(reserva, usuario);
      if (reserva.estado === 'cancelada') throw new HttpError(409, 'La reserva esta cancelada');
      if (reserva.estado === 'cobrado') throw new HttpError(409, 'La reserva ya fue atendida');

      const [cobro, pagoAprobado] = await Promise.all([
        checkinModel.findCobroByReservaId(reserva.id, client),
        checkinModel.findPagoAprobado(reserva.id, client),
      ]);
      if (!cobro && pagoAprobado) {
        await asegurarCobroOnline(reserva, pagoAprobado, client);
      }
      if (!cobro && !pagoAprobado) {
        throw new HttpError(409, 'Pago pendiente: registra el pago antes de iniciar el servicio');
      }

      if (reserva.estado !== 'en_curso') {
        await checkinModel.iniciarServicio(reserva.id, client);
      }
      const actualizada = await checkinModel.findReservaByIdForUpdate(reserva.id, client);
      return cargarResumen(actualizada, client);
    });
  },

  async finalizar(data, usuario) {
    const reservaId = validarReservaId(data?.reserva_id);
    return withTransaction(async (client) => {
      const reserva = await checkinModel.findReservaByIdForUpdate(reservaId, client);
      if (!reserva) throw new HttpError(404, 'Reserva no encontrada');
      validarAcceso(reserva, usuario);
      if (reserva.estado === 'cancelada') throw new HttpError(409, 'La reserva esta cancelada');

      const [cobro, pagoAprobado] = await Promise.all([
        checkinModel.findCobroByReservaId(reserva.id, client),
        checkinModel.findPagoAprobado(reserva.id, client),
      ]);
      if (!cobro && pagoAprobado) {
        await asegurarCobroOnline(reserva, pagoAprobado, client);
      }
      if (!cobro && !pagoAprobado) {
        throw new HttpError(409, 'Pago pendiente: registra el pago antes de finalizar el servicio');
      }

      if (reserva.estado !== 'cobrado') {
        await checkinModel.finalizarServicio(reserva.id, client);
      }
      const actualizada = await checkinModel.findReservaByIdForUpdate(reserva.id, client);
      return cargarResumen(actualizada, client);
    });
  },

  async validar(data, usuario) {
    const qr_token = validarQr(data?.qr_token);
    const monto = parsearMonto(data?.monto);

    return withTransaction(async (client) => {
      const reserva = await checkinModel.findReservaByQrTokenForUpdate(qr_token, client);
      if (!reserva) throw new HttpError(404, 'QR no valido: reserva no encontrada');
      validarAcceso(reserva, usuario);
      if (reserva.estado === 'cancelada') throw new HttpError(409, 'La reserva esta cancelada');
      if (reserva.estado === 'cobrado') throw new HttpError(409, 'La reserva ya fue cobrada');

      const total = Number(reserva.precio_total) * Number(reserva.cantidad_personas || 1);
      const ahora = new Date();
      const inicio = new Date(reserva.inicia_en);
      const diffMin = (ahora - inicio) / (1000 * 60);
      if (diffMin < -120 || diffMin > 120) {
        throw new HttpError(400, 'Fuera de la ventana de validacion (+-120 minutos)');
      }

      const pagoAprobado = await checkinModel.findPagoAprobado(reserva.id, client);
      let cobro = await checkinModel.findCobroByReservaId(reserva.id, client);

      if (pagoAprobado) {
        if (!cobro) {
          cobro = await asegurarCobroOnline(reserva, pagoAprobado, client);
        }
      } else {
        if (monto <= 0 && total > 0) {
          throw new HttpError(409, 'No hay un pago en linea aprobado. Registra el monto en efectivo o genera el pago QR.');
        }
        if (!cobro) {
          cobro = await checkinModel.registrarCobro(reserva.id, monto, 'fisico', usuario.id, null, false, client);
        }
      }

      if (!cobro) {
        throw new HttpError(409, 'No se pudo registrar el cobro');
      }

      await checkinModel.finalizarServicio(reserva.id, client);
      const actualizada = await checkinModel.findReservaByIdForUpdate(reserva.id, client);
      return cargarResumen(actualizada, client);
    });
  },
};

module.exports = checkinService;
module.exports.resumen = resumen;
