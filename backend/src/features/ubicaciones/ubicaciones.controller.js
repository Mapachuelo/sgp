const ubicacionesService = require('./ubicaciones.service');
const asyncHandler = require('../../shared/async-handler');

const ubicacionesController = {
  listar: asyncHandler(async (_req, res) => {
    const ubicaciones = await ubicacionesService.findAll();
    res.json({ ok: true, data: ubicaciones });
  }),

  crear: asyncHandler(async (req, res) => {
    const ubicacion = await ubicacionesService.create(req.body);
    res.status(201).json({ ok: true, data: ubicacion });
  }),

  actualizar: asyncHandler(async (req, res) => {
    const ubicacion = await ubicacionesService.update(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true, data: ubicacion });
  }),

  eliminar: asyncHandler(async (req, res) => {
    await ubicacionesService.delete(parseInt(req.params.id, 10));
    res.json({ ok: true, data: { eliminado: true } });
  }),
};

module.exports = ubicacionesController;
