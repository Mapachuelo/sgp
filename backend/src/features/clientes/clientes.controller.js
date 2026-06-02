const clientesService = require('./clientes.service');
const asyncHandler = require('../../shared/async-handler');
const HttpError = require('../../shared/http-error');
const logger = require('../../shared/logger');

const clientesController = {
  getMe: asyncHandler(async (req, res) => {
    const cliente = await clientesService.getMe(req.usuario.id);
    res.json({ ok: true, data: cliente });
  }),

  updateMe: asyncHandler(async (req, res) => {
    const cliente = await clientesService.updateMe(req.usuario.id, req.body);
    res.json({ ok: true, data: cliente });
  }),

  deleteMe: asyncHandler(async (req, res) => {
    const result = await clientesService.deleteMe(req.usuario.id);
    res.json({ ok: true, data: result });
  }),

  listar: asyncHandler(async (_req, res) => {
    const clientes = await clientesService.findAll();
    res.json({ ok: true, data: clientes });
  }),

  bloquear: asyncHandler(async (req, res) => {
    const { motivo } = req.body;
    if (!motivo) {
      throw new HttpError(400, 'El motivo de bloqueo es requerido');
    }
    const result = await clientesService.bloquear(
      parseInt(req.params.id, 10),
      motivo,
      req.usuario.id
    );
    logger.info({ cliente_id: req.params.id }, 'Cliente bloqueado');
    res.json({ ok: true, data: result });
  }),

  desbloquear: asyncHandler(async (req, res) => {
    const result = await clientesService.desbloquear(parseInt(req.params.id, 10));
    logger.info({ cliente_id: req.params.id }, 'Cliente desbloqueado');
    res.json({ ok: true, data: result });
  }),

  eliminar: asyncHandler(async (req, res) => {
    const result = await clientesService.deleteCliente(parseInt(req.params.id, 10));
    logger.info({ cliente_id: req.params.id }, 'Cliente eliminado');
    res.json({ ok: true, data: result });
  }),
};

module.exports = clientesController;
