const { Router } = require('express');
const pagosController = require('./pagos.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.post('/webhook', pagosController.webhook);
router.post('/intencion', authenticate, authorize('cliente'), pagosController.crearIntencion);
router.get('/:id', authenticate, pagosController.obtenerPago);
router.post('/:id/verificar', authenticate, authorize('cliente', 'admin'), pagosController.verificarPago);

module.exports = router;
