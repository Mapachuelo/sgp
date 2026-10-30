const { Router } = require('express');
const notificacionesController = require('./notificaciones.controller');
const { authenticate } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/me', authenticate, notificacionesController.listar);
router.get('/me/contador', authenticate, notificacionesController.contador);
router.put('/me/leidas', authenticate, notificacionesController.marcarTodas);
router.put('/me/:id/leida', authenticate, notificacionesController.marcarLeida);

module.exports = router;
