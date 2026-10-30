const reportesService = require('./reportes.service');
const asyncHandler = require('../../shared/async-handler');

const reportesController = {
  ventasDiarias: asyncHandler(async (req, res) => {
    const result = await reportesService.ventasDiarias(req.query.fecha, req.query);
    res.json({ ok: true, data: result });
  }),

  ocupacion: asyncHandler(async (req, res) => {
    const result = await reportesService.ocupacion(req.query.fecha, req.query);
    res.json({ ok: true, data: result });
  }),

  nomina: asyncHandler(async (req, res) => {
    const result = await reportesService.nomina(req.query);
    res.json({ ok: true, data: result });
  }),

  resumenEmpleado: asyncHandler(async (req, res) => {
    const result = await reportesService.resumenEmpleado(req.usuario.id, req.query);
    res.json({ ok: true, data: result });
  }),

  nominaPdf: asyncHandler(async (req, res) => {
    const pdf = await reportesService.nominaPdf(req.query);
    const nombre = `nomina-${req.query.empleado_id || 'todos'}-${req.query.desde || 'inicio'}-${req.query.hasta || 'fin'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(pdf);
  }),

  clientesRecurrentes: asyncHandler(async (_req, res) => {
    const result = await reportesService.clientesRecurrentes();
    res.json({ ok: true, data: result });
  }),
};

module.exports = reportesController;
