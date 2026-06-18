const disponibilidadModel = require('./disponibilidad.model');
const reservasModel = require('../reservas/reservas.model');
const HttpError = require('../../shared/http-error');

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

    const ubicacionesAnteriores = await disponibilidadModel.getUbicacionesAnteriores(empleado_id);

    await disponibilidadModel.deleteDisponibilidadEmpleado(empleado_id);
    if (items.length > 0) {
      await disponibilidadModel.insertDisponibilidad(empleado_id, items);
    }

    const nuevasUbicaciones = [...new Set(items.map((i) => i.ubicacion_id))];
    const sedesCambiadas = ubicacionesAnteriores.filter(
      (uid) => !nuevasUbicaciones.includes(uid)
    );

    for (const ubicacion_id of sedesCambiadas) {
      const reservasFuturas =
        await reservasModel.findReservasFuturasByEmpleadoAndUbicacion(
          empleado_id,
          ubicacion_id
        );
      if (reservasFuturas.length > 0) {
        const ids = reservasFuturas.map((r) => r.id);
        await reservasModel.cancelReservasFuturas(ids, 'Empleado cambio de sede');
      }
    }

    return { actualizado: true, sedes_cambiadas: sedesCambiadas };
  },
};

module.exports = disponibilidadService;
