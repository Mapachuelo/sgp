const { Router } = require('express');
const disponibilidadController = require('./disponibilidad.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/disponibilidad/todas', authenticate, authorize('admin'), disponibilidadController.getAll);

router.get('/disponibilidad/bloqueos', authenticate, authorize('empleado', 'admin'), disponibilidadController.getBloqueos);

router.get('/disponibilidad/temporales', authenticate, authorize('empleado', 'admin'), disponibilidadController.getTemporales);
router.post('/disponibilidad/temporales', authenticate, authorize('empleado', 'admin'), disponibilidadController.crearTemporal);
router.patch('/disponibilidad/temporales/:id/finalizar', authenticate, authorize('empleado', 'admin'), disponibilidadController.finalizarTemporal);

router.get('/disponibilidad/festivos/admin', authenticate, authorize('admin'), disponibilidadController.getFestivosAdmin);
router.get('/disponibilidad/festivos', authenticate, authorize('empleado', 'admin'), disponibilidadController.getFestivosEmpleado);
router.post('/disponibilidad/festivos', authenticate, authorize('empleado', 'admin'), disponibilidadController.crearFestivo);
router.delete('/disponibilidad/festivos/:fecha', authenticate, authorize('empleado', 'admin'), disponibilidadController.eliminarFestivo);

router.put('/disponibilidad/descansos', authenticate, authorize('empleado'), disponibilidadController.updateDescansos);

router.get('/disponibilidad', authenticate, authorize('empleado'), disponibilidadController.get);
router.put('/disponibilidad', authenticate, authorize('empleado'), disponibilidadController.update);

router.get('/:empleadoId/disponibilidad', authenticate, authorize('admin'), disponibilidadController.getByAdmin);
router.put('/:empleadoId/disponibilidad', authenticate, authorize('admin'), disponibilidadController.updateByAdmin);

module.exports = router;
