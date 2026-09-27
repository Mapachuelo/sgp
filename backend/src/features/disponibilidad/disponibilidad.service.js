const disponibilidadModel = require('./disponibilidad.model');
const reservasModel = require('../reservas/reservas.model');
const HttpError = require('../../shared/http-error');

const MOTIVO_CAMBIO_SEDE = 'El empleado cambió de sede';

const disponibilidadService = {
  async getDisponibilidad(empleado_id) {
    return disponibilidadModel.findDisponibilidadByEmpleado(empleado_id);
  },

  async updateDisponibilidad(empleado_id, items) {
    if (!Array.isArray(items)) {
      throw new HttpError(400, 'Los items de disponibilidad deben ser un arreglo');
    }

    const diasAsignados = new Set();
    for (const item of items) {
      if (diasAsignados.has(item.dia_semana)) {
        throw new HttpError(400, 'El empleado no puede estar disponible en más de una sede el mismo día');
      }
      diasAsignados.add(item.dia_semana);
    }

    const anteriores = await disponibilidadModel.findDisponibilidadByEmpleado(empleado_id);
    const mapaAnterior = new Map(anteriores.map((r) => [r.dia_semana, r.ubicacion_id]));
    const mapaNuevo = new Map(items.map((i) => [i.dia_semana, i.ubicacion_id]));

    const diasCambiados = [];
    for (const [dia, sedeAnterior] of mapaAnterior) {
      if (mapaNuevo.get(dia) !== sedeAnterior) {
        diasCambiados.push({ dia_semana: dia, ubicacion_id: sedeAnterior });
      }
    }

    await disponibilidadModel.deleteDisponibilidadEmpleado(empleado_id);
    if (items.length > 0) {
      await disponibilidadModel.insertDisponibilidad(empleado_id, items);
    }

    const reservasCanceladas = [];
    for (const cambio of diasCambiados) {
      const reservasFuturas = await reservasModel.findReservasFuturasByEmpleadoUbicacionYDia(
        empleado_id,
        cambio.ubicacion_id,
        cambio.dia_semana
      );
      if (reservasFuturas.length > 0) {
        const ids = reservasFuturas.map((r) => r.id);
        const canceladas = await reservasModel.cancelReservasFuturas(ids, MOTIVO_CAMBIO_SEDE);
        reservasCanceladas.push(...canceladas);
      }
    }

    return {
      actualizado: true,
      dias_cambiados: diasCambiados.map((d) => d.dia_semana),
      reservas_canceladas: reservasCanceladas,
      motivo_cancelacion: MOTIVO_CAMBIO_SEDE,
    };
  },
};

module.exports = disponibilidadService;