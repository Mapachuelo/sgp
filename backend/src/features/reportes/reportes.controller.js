const reportesService = require('./reportes.service');
const asyncHandler = require('../../shared/async-handler');

const reportesController = {
  ventasDiarias: asyncHandler(async (req, res) => {
    const result = await reportesService.ventasDiarias(req.query.fecha);
    res.json({ ok: true, data: result });
  }),

  ocupacion: asyncHandler(async (req, res) => {
    const result = await reportesService.ocupacion(req.query.fecha);
    res.json({ ok: true, data: result });
  }),

  clientesRecurrentes: asyncHandler(async (_req, res) => {
    const result = await reportesService.clientesRecurrentes();
    res.json({ ok: true, data: result });
  }),
};

module.exports = reportesController;
