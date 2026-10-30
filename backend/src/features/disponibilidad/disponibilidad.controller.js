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

  updateDescansos: asyncHandler(async (req, res) => {
    const result = await disponibilidadService.actualizarDescansos(
      req.usuario.id,
      req.body || {}
    );
    logger.info({ empleado_id: req.usuario.id, total_canceladas: result.total_canceladas }, 'Descansos actualizados');
    emitDisponibilidadActualizada(req.usuario.id, new Date().toISOString());
    emitirCancelaciones(result);
    res.json({ ok: true, data: result });
  }),

  getDescansosTemporales: asyncHandler(async (req, res) => {
    const data = await disponibilidadService.getDescansosTemporales(req.usuario.id, req.query);
    res.json({ ok: true, data });
  }),

  updateDescansoTemporal: asyncHandler(async (req, res) => {
    const result = await disponibilidadService.actualizarDescansoTemporal(
      req.usuario.id,
      req.body || {}
    );
    logger.info({ empleado_id: req.usuario.id, fecha: result.fecha || result.descanso?.fecha }, 'Descanso temporal actualizado');
    emitDisponibilidadActualizada(req.usuario.id, new Date().toISOString());
    emitirCancelaciones(result);
    res.json({ ok: true, data: result });
  }),

  deleteDescansoTemporal: asyncHandler(async (req, res) => {
    const result = await disponibilidadService.eliminarDescansoTemporal(req.usuario.id, req.params.fecha);
    logger.info({ empleado_id: req.usuario.id, fecha: req.params.fecha }, 'Descanso temporal eliminado');
    emitDisponibilidadActualizada(req.usuario.id, new Date().toISOString());
    res.json({ ok: true, data: result });
  }),

  deleteDescansosTemporalesRango: asyncHandler(async (req, res) => {
    const result = await disponibilidadService.eliminarDescansosTemporalesRango(req.usuario.id, req.query);
    logger.info({ empleado_id: req.usuario.id, ...result }, 'Descansos temporales eliminados');
    emitDisponibilidadActualizada(req.usuario.id, new Date().toISOString());
    res.json({ ok: true, data: result });
  }),

  getByAdmin: asyncHandler(async (req, res) => {
    const empleadoId = parseInt(req.params.empleadoId, 10);
    const disponibilidad = await disponibilidadService.getDisponibilidad(empleadoId);
    res.json({ ok: true, data: disponibilidad });
  }),

  getAll: asyncHandler(async (_req, res) => {
    const disponibilidad = await disponibilidadService.getAllDisponibilidad();
    res.json({ ok: true, data: disponibilidad });
  }),


  getTemporales: asyncHandler(async (req, res) => {
    const data = await disponibilidadService.getTemporales(req.usuario, req.query.empleado_id);
    res.json({ ok: true, data });
  }),

  crearTemporal: asyncHandler(async (req, res) => {
    const data = await disponibilidadService.crearTemporal(req.usuario, req.body);
    res.status(201).json({ ok: true, data });
  }),

  finalizarTemporal: asyncHandler(async (req, res) => {
    const data = await disponibilidadService.finalizarTemporal(req.usuario, req.params.id, req.body || {});
    res.json({ ok: true, data });
  }),

  getBloqueos: asyncHandler(async (req, res) => {
    const empleadoId = req.usuario.rol === 'empleado' ? req.usuario.id : req.query.empleado_id;
    const data = await disponibilidadService.getBloqueos(
      req.query.desde,
      req.query.hasta,
      empleadoId
    );
    res.json({ ok: true, data });
  }),

  getFestivosEmpleado: asyncHandler(async (req, res) => {
    const empleadoId = req.usuario.rol === 'empleado' ? req.usuario.id : Number(req.query.empleado_id);
    const hoy = new Date().toISOString().slice(0, 10);
    const futura = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const desde = req.query.desde || hoy;
    const hasta = req.query.hasta || futura;
    const data = await disponibilidadService.getFestivosEmpleado(empleadoId, desde, hasta);
    res.json({ ok: true, data });
  }),

  getFestivosAdmin: asyncHandler(async (req, res) => {
    const data = await disponibilidadService.getFestivosAdmin(req.query.fecha);
    res.json({ ok: true, data });
  }),

  crearFestivo: asyncHandler(async (req, res) => {
    const data = await disponibilidadService.crearFestivo(req.usuario, req.body);
    res.status(201).json({ ok: true, data });
  }),

  eliminarFestivo: asyncHandler(async (req, res) => {
    const data = await disponibilidadService.eliminarFestivo(req.usuario, req.params.fecha);
    res.json({ ok: true, data });
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
