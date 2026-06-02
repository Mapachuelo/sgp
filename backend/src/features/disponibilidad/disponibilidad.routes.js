const { Router } = require('express');
const disponibilidadController = require('./disponibilidad.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/disponibilidad', authenticate, authorize('empleado'), disponibilidadController.get);
router.put('/disponibilidad', authenticate, authorize('empleado'), disponibilidadController.update);

module.exports = router;
