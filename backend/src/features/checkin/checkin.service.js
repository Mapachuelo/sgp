const checkinModel = require('./checkin.model');
const HttpError = require('../../shared/http-error');
const { withTransaction } = require('../../config/db');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const checkinService = {
  async validar(data, usuarioId) {
    const { qr_token } = data;

    if (!qr_token || typeof qr_token !== 'string' || !UUID_REGEX.test(qr_token.trim())) {
      throw new HttpError(400, 'qr_token es requerido y debe ser un UUID valido');
    }

    const montoBruto = data.monto;
    const monto =
      montoBruto === undefined || montoBruto === null || montoBruto === ''
        ? 0
        : Number(montoBruto);

    if (!Number.isFinite(monto) || monto < 0) {
      throw new HttpError(400, 'monto debe ser un numero mayor o igual a 0');
    }

    const resultado = await withTransaction(async (client) => {
      const reserva = await checkinModel.findReservaByQrTokenForUpdate(
        qr_token.trim(),
        client
      );
      if (!reserva) {
        throw new HttpError(404, 'QR no valido: reserva no encontrada');
      }

      if (reserva.estado === 'cancelada') {
        throw new HttpError(409, 'La reserva esta cancelada');
      }

      if (reserva.estado === 'cobrado') {
        throw new HttpError(409, 'La reserva ya fue cobrada');
      }

      const ahora = new Date();
      const inicio = new Date(reserva.inicia_en);
      const diffMin = (ahora - inicio) / (1000 * 60);

      if (diffMin < -120 || diffMin > 120) {
        throw new HttpError(400, 'Fuera de la ventana de validacion (+-120 minutos)');
      }

      const pagoAprobado = await checkinModel.findPagoAprobado(reserva.id, client);
      const montoFinal = pagoAprobado ? Number(pagoAprobado.monto) : monto;
      const metodo = pagoAprobado ? 'online' : monto > 0 ? 'fisico' : 'online';
      const cobro = await checkinModel.registrarCobro(
        reserva.id,
        montoFinal,
        metodo,
        usuarioId,
        client
      );
      if (!cobro) {
        throw new HttpError(409, 'La reserva ya fue cobrada');
      }

      await checkinModel.updateReservaEstado(reserva.id, 'cobrado', client);

      return {
        reserva_id: reserva.id,
        estado: 'cobrado',
        metodo,
        metodo_pago: metodo,
        monto: montoFinal,
        pago_id: pagoAprobado ? pagoAprobado.id : null,
        pagado_online: Boolean(pagoAprobado),
        cliente_nombre: `${reserva.cliente_nombre} ${reserva.cliente_apellido || ''}`.trim(),
        servicio_nombre: reserva.servicio_nombre,
        inicia_en: reserva.inicia_en,
      };
    });

    return resultado;
  },
};

module.exports = checkinService;
