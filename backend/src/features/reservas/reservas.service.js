const QRCode = require('qrcode');
const reservasModel = require('./reservas.model');
const HttpError = require('../../shared/http-error');
const { withTransaction } = require('../../config/db');

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
    const { empleado_id, servicio_id, ubicacion_id, inicia_en, cantidad_personas } = data;

    if (!empleado_id || !servicio_id || !ubicacion_id || !inicia_en) {
      throw new HttpError(400, 'empleado_id, servicio_id, ubicacion_id e inicia_en son requeridos');
    }

    const inicio = new Date(inicia_en);
    if (Number.isNaN(inicio.getTime())) {
      throw new HttpError(400, 'inicia_en no es una fecha valida');
    }

    const diffMin = (inicio - new Date()) / (1000 * 60);
    if (diffMin < 60) {
      throw new HttpError(400, 'La reserva debe hacerse con al menos 60 minutos de anticipacion');
    }

    const qty = Number(cantidad_personas || 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 5) {
      throw new HttpError(400, 'cantidad_personas debe estar entre 1 y 5');
    }

    const [empleado, ubicacion, duracion] = await Promise.all([
      reservasModel.findEmpleadoById(empleado_id),
      reservasModel.findUbicacionById(ubicacion_id),
      reservasModel.findDuracionServicioEmpleado(empleado_id, servicio_id),
    ]);

    if (!empleado) throw new HttpError(404, 'Empleado no encontrado');
    if (empleado.esta_bloqueado) throw new HttpError(409, 'El empleado no esta disponible');
    if (!ubicacion) throw new HttpError(404, 'Ubicacion no encontrada');
    if (!duracion) {
      throw new HttpError(400, 'El empleado no ofrece el servicio seleccionado');
    }

    const fin = new Date(inicio.getTime() + duracion.duracion_minutos * 60 * 1000);
    const inicioIso = inicio.toISOString();
    const finIso = fin.toISOString();

    const dentroDisponibilidad = await reservasModel.estaDentroDeDisponibilidad(
      empleado_id,
      ubicacion_id,
      inicioIso,
      finIso
    );
    if (!dentroDisponibilidad) {
      throw new HttpError(400, 'El horario esta fuera de la disponibilidad del empleado en esa sede');
    }

    const reserva = await withTransaction(async (client) => {
      await reservasModel.acquireLock(empleado_id, inicioIso, client);

      const activas = await reservasModel.findReservasActivasPorCliente(cliente_id, client);
      if (activas >= 5) {
        throw new HttpError(409, 'Maximo 5 reservas activas por cliente');
      }

      const solapadas = await reservasModel.findReservasSolapadas(
        empleado_id,
        inicioIso,
        finIso,
        client
      );
      if (solapadas.length > 0) {
        throw new HttpError(409, 'El horario seleccionado se superpone con otra reserva activa');
      }

      const nueva = await reservasModel.createReserva(
        {
          cliente_id,
          empleado_id,
          servicio_id,
          ubicacion_id,
          inicia_en: inicioIso,
          termina_en: finIso,
          cantidad_personas: qty,
          qr_data_url: null,
        },
        client
      );

      const qrPayload = JSON.stringify({
        id: nueva.id,
        qr_token: nueva.qr_token,
        cliente_id,
        inicia_en: inicioIso,
      });
      const qr_data_url = await QRCode.toDataURL(qrPayload);
      await reservasModel.updateReservaQr(nueva.id, qr_data_url, client);

      return { ...nueva, qr_data_url };
    });

    return reservasModel.findReservaById(reserva.id);
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

  async getAgenda({ desde, hasta, empleado_id }) {
    const fechaValida = (valor) =>
      typeof valor === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
      !Number.isNaN(Date.parse(`${valor}T00:00:00Z`)) &&
      new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
    if (!fechaValida(desde) || !fechaValida(hasta)) {
      throw new HttpError(400, 'desde y hasta son requeridos con formato YYYY-MM-DD');
    }
    if (desde > hasta) {
      throw new HttpError(400, 'desde no puede ser mayor que hasta');
    }
    return reservasModel.findAgenda(desde, hasta, empleado_id ? parseInt(empleado_id, 10) : null);
  },
};

module.exports = reservasService;
