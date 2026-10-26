const { Router } = require('express');
const checkinController = require('./checkin.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.post('/consultar', authenticate, authorize('empleado', 'admin'), checkinController.consultar);
router.post('/llegada', authenticate, authorize('empleado', 'admin'), checkinController.llegada);
router.post('/cobro-efectivo', authenticate, authorize('empleado', 'admin'), checkinController.cobroEfectivo);
router.post('/iniciar', authenticate, authorize('empleado', 'admin'), checkinController.iniciar);
router.post('/finalizar', authenticate, authorize('empleado', 'admin'), checkinController.finalizar);
router.post('/validar', authenticate, authorize('empleado', 'admin'), checkinController.validar);

module.exports = router;
