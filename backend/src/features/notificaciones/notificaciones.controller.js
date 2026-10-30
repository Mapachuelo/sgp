const notificacionesService = require('./notificaciones.service');
const asyncHandler = require('../../shared/async-handler');

const notificacionesController = {
  listar: asyncHandler(async (req, res) => {
    const data = await notificacionesService.listar(req.usuario.id, req.query);
    res.json({ ok: true, data });
  }),

  contador: asyncHandler(async (req, res) => {
    const data = await notificacionesService.contador(req.usuario.id);
    res.json({ ok: true, data });
  }),

  marcarLeida: asyncHandler(async (req, res) => {
    const data = await notificacionesService.marcarLeida(req.usuario.id, req.params.id);
    res.json({ ok: true, data });
  }),

  marcarTodas: asyncHandler(async (req, res) => {
    const data = await notificacionesService.marcarTodas(req.usuario.id);
    res.json({ ok: true, data });
  }),
};

module.exports = notificacionesController;
