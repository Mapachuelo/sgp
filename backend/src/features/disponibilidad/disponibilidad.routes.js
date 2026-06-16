const { Router } = require('express');
const disponibilidadController = require('./disponibilidad.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/disponibilidad', authenticate, authorize('empleado'), disponibilidadController.get);
router.put('/disponibilidad', authenticate, authorize('empleado'), disponibilidadController.update);

router.get('/:empleadoId/disponibilidad', authenticate, authorize('admin'), disponibilidadController.getByAdmin);
router.put('/:empleadoId/disponibilidad', authenticate, authorize('admin'), disponibilidadController.updateByAdmin);

module.exports = router;
