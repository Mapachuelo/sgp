const disponibilidadService = require('./disponibilidad.service');
const asyncHandler = require('../../shared/async-handler');
const { emitDisponibilidadActualizada } = require('../../integrations/realtime/ws-hub');
const logger = require('../../shared/logger');

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
    res.json({ ok: true, data: result });
  }),
};

module.exports = disponibilidadController;
