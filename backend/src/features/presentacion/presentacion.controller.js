const presentacionService = require('./presentacion.service');
const asyncHandler = require('../../shared/async-handler');

const presentacionController = {
  publica: asyncHandler(async (_req, res) => {
    res.json({ ok: true, data: await presentacionService.getPublica() });
  }),
  admin: asyncHandler(async (_req, res) => {
    res.json({ ok: true, data: await presentacionService.getAdmin() });
  }),
  actualizarConfig: asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await presentacionService.updateConfig(req.body) });
  }),
  crearMedia: asyncHandler(async (req, res) => {
    res.status(201).json({ ok: true, data: await presentacionService.crearMedia({ body: req.body, files: req.files }) });
  }),
  agregarFuentes: asyncHandler(async (req, res) => {
    res.status(201).json({ ok: true, data: await presentacionService.agregarFuentes(Number(req.params.id), { files: req.files }) });
  }),
  actualizarMedia: asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await presentacionService.actualizarMedia(Number(req.params.id), req.body) });
  }),
  reordenar: asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await presentacionService.reordenarMedia(req.body.items) });
  }),
  eliminarMedia: asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await presentacionService.eliminarMedia(Number(req.params.id)) });
  }),
  eliminarFuente: asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await presentacionService.eliminarFuente(Number(req.params.id), Number(req.params.fuenteId)) });
  }),
};

module.exports = presentacionController;
