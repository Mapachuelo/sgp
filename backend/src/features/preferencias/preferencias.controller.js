const preferenciasService = require('./preferencias.service');
const asyncHandler = require('../../shared/async-handler');

const preferenciasController = {
  get: asyncHandler(async (req, res) => {
    const prefs = await preferenciasService.get(req.usuario.id);
    res.json({ ok: true, data: prefs });
  }),

  update: asyncHandler(async (req, res) => {
    const prefs = await preferenciasService.update(req.usuario.id, req.body);
    res.json({ ok: true, data: prefs });
  }),
};

module.exports = preferenciasController;
