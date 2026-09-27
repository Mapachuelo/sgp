const disponibilidadService = require('./disponibilidad.service');
const asyncHandler = require('../../shared/async-handler');
const {
  emitDisponibilidadActualizada,
  emitReservaActualizada,
} = require('../../integrations/realtime/ws-hub');
const logger = require('../../shared/logger');

function emitirCancelaciones(result) {
  if (Array.isArray(result.reservas_canceladas)) {
    result.reservas_canceladas.forEach((id) => emitReservaActualizada(id, 'cancelada'));
  }
}

const disponibilidadController = {
  get: asyncHandler(async (req, res) => {
    const disponibilidad = await disponibilidadService.getDisponibilidad(req.usuario.id);
    res.json({ ok: true, data: disponibilidad });
  }),

  update: asyncHandler(async (req, res) => {
    const result = await disponibilidadService.updateDisponibilidad(
      req.usuario.id,
      req.body
    );
    logger.info({ empleado_id: req.usuario.id }, 'Disponibilidad actualizada');
    emitDisponibilidadActualizada(req.usuario.id, new Date().toISOString());
    emitirCancelaciones(result);
    res.json({ ok: true, data: result });
  }),

  getByAdmin: asyncHandler(async (req, res) => {
    const empleadoId = parseInt(req.params.empleadoId, 10);
    const disponibilidad = await disponibilidadService.getDisponibilidad(empleadoId);
    res.json({ ok: true, data: disponibilidad });
  }),

  updateByAdmin: asyncHandler(async (req, res) => {
    const empleadoId = parseInt(req.params.empleadoId, 10);
    const result = await disponibilidadService.updateDisponibilidad(
      empleadoId,
      req.body
    );
    logger.info({ empleado_id: empleadoId, admin_id: req.usuario.id }, 'Disponibilidad de empleado actualizada por admin');
    emitDisponibilidadActualizada(empleadoId, new Date().toISOString());
    emitirCancelaciones(result);
    res.json({ ok: true, data: result });
  }),
};

module.exports = disponibilidadController;
