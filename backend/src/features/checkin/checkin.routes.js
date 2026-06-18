const { Router } = require('express');
const checkinController = require('./checkin.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.post('/validar', authenticate, authorize('empleado', 'admin'), checkinController.validar);

module.exports = router;
