const QRCode = require('qrcode');
const reservasModel = require('./reservas.model');
const HttpError = require('../../shared/http-error');

const reservasService = {
  async getServicios() {
    return reservasModel.findAllServicios();
  },

  async createServicio(data) {
    if (!data.nombre || data.precio_base == null || data.duracion_base_minutos == null) {
      throw new HttpError(400, 'nombre, precio_base y duracion_base_minutos son requeridos');
    }
    return reservasModel.createServicio(data);
  },

  async updateServicio(id, data) {
    const servicio = await reservasModel.findServicioById(id);
    if (!servicio) throw new HttpError(404, 'Servicio no encontrado');
    return reservasModel.updateServicio(id, data);
  },

  async deleteServicio(id) {
    const servicio = await reservasModel.findServicioById(id);
    if (!servicio) throw new HttpError(404, 'Servicio no encontrado');
    return reservasModel.deleteServicio(id);
  },

  async getDisponibilidad({ fecha, empleado_id, ubicacion_id }) {
    if (!fecha || !empleado_id || !ubicacion_id) {
      throw new HttpError(400, 'fecha, empleado_id y ubicacion_id son requeridos');
    }

    const diaSemana = new Date(fecha).getUTCDay();
    const diaMapeado = diaSemana === 0 ? 7 : diaSemana;

    const jornada = await reservasModel.findJornada(ubicacion_id, fecha);
    const slotsOcupados = await reservasModel.findSlotsOcupados(fecha, empleado_id);
    const disponibilidadEmpleado = await reservasModel.findEmpleadoDisponibilidadDia(empleado_id, ubicacion_id, diaMapeado);

    return {
      fecha,
      empleado_id,
      ubicacion_id,
      dia_semana: diaMapeado,
      jornada: jornada || null,
      slots_ocupados: slotsOcupados,
      disponibilidad_empleado: disponibilidadEmpleado || null,
    };
  },

  async getJornada(ubicacion_id) {
    return reservasModel.findJornadas(ubicacion_id);
  },

  async updateJornada(ubicacion_id, items) {
    await reservasModel.upsertJornada(ubicacion_id, items);
    return { actualizado: true };
  },

  async getEmpleadoTiemposServicio(empleado_id) {
    if (empleado_id) {
      return reservasModel.findEmpleadoTiemposServicio(empleado_id);
    }
    return reservasModel.findAllEmpleadoTiemposServicio();
  },

  async updateEmpleadoTiemposServicio(empleado_id, items) {
    await reservasModel.upsertEmpleadoTiempoServicio(empleado_id, items);
    return { actualizado: true };
  },

  async createReserva(cliente_id, data) {
    const { empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas } = data;

    if (!empleado_id || !servicio_id || !ubicacion_id || !inicia_en || !termina_en) {
      throw new HttpError(400, 'empleado_id, servicio_id, ubicacion_id, inicia_en y termina_en son requeridos');
    }

    const ahora = new Date();
    const fechaReserva = new Date(inicia_en);
    const diffMin = (fechaReserva - ahora) / (1000 * 60);

    if (diffMin < 60) {
      throw new HttpError(400, 'La reserva debe hacerse con al menos 60 minutos de anticipacion');
    }

    const activas = await reservasModel.findReservasActivasPorCliente(cliente_id);
    if (activas >= 5) {
      throw new HttpError(409, 'Maximo 5 reservas activas por cliente');
    }

    const qty = cantidad_personas || 1;
    if (qty < 1 || qty > 5) {
      throw new HttpError(400, 'cantidad_personas debe estar entre 1 y 5');
    }

    const reserva = await reservasModel.createReserva({
      cliente_id,
      empleado_id,
      servicio_id,
      ubicacion_id,
      inicia_en,
      termina_en,
      cantidad_personas: qty,
      qr_data_url: null,
    });

    const qrPayload = JSON.stringify({
      id: reserva.id,
      qr_token: reserva.qr_token,
      cliente_id,
      inicia_en,
    });

    const qr_data_url = await QRCode.toDataURL(qrPayload);

    await reservasModel.updateReservaQr(reserva.id, qr_data_url);
    await reservasModel.updateReservaEstado(reserva.id, 'pendiente');

    const updated = await reservasModel.findReservaById(reserva.id);

    return updated;
  },

  async getReservasByCliente(cliente_id) {
    return reservasModel.findReservasByCliente(cliente_id);
  },

  async cancelReserva(id, cliente_id) {
    const reserva = await reservasModel.findReservaById(id);
    if (!reserva) throw new HttpError(404, 'Reserva no encontrada');
    if (reserva.cliente_id !== cliente_id) throw new HttpError(403, 'No puede cancelar esta reserva');
    if (reserva.estado === 'cancelada') throw new HttpError(409, 'La reserva ya esta cancelada');
    if (reserva.estado === 'cobrado') throw new HttpError(409, 'La reserva ya fue cobrada');

    return reservasModel.cancelReserva(id, cliente_id, 'Cancelada por el cliente');
  },

  async getAllReservas(filtros) {
    return reservasModel.findAllReservas(filtros);
  },
};

module.exports = reservasService;
