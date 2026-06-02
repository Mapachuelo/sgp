const checkinModel = require('./checkin.model');
const HttpError = require('../../shared/http-error');

const checkinService = {
  async validar(data, usuarioId) {
    const { qr_token, monto } = data;

    if (!qr_token) {
      throw new HttpError(400, 'qr_token es requerido');
    }

    const reserva = await checkinModel.findReservaByQrToken(qr_token);
    if (!reserva) {
      throw new HttpError(404, 'QR no valido: reserva no encontrada');
    }

    if (reserva.estado === 'cancelada') {
      throw new HttpError(409, 'La reserva esta cancelada');
    }

    if (reserva.estado === 'cobrado') {
      throw new HttpError(409, 'La reserva ya fue cobrada');
    }

    if (reserva.estado === 'en_curso') {
      throw new HttpError(409, 'La reserva ya esta en curso');
    }

    const ahora = new Date();
    const inicio = new Date(reserva.inicia_en);
    const diffMin = (ahora - inicio) / (1000 * 60);

    if (diffMin < -120 || diffMin > 120) {
      throw new HttpError(400, 'Fuera de la ventana de validacion (+-120 minutos)');
    }

    const metodo = monto > 0 ? 'fisico' : 'online';

    await checkinModel.updateReservaEstado(reserva.id, 'en_curso');

    await checkinModel.registrarCobro(reserva.id, monto || 0, metodo, usuarioId);

    return {
      reserva_id: reserva.id,
      estado: 'en_curso',
      metodo,
    };
  },
};

module.exports = checkinService;
