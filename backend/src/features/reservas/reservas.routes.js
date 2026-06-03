const { Router } = require('express');
const reservasController = require('./reservas.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/empleados-disponibles', reservasController.empleadosDisponibles);

router.get('/servicios', reservasController.listarServicios);
router.post('/servicios', authenticate, authorize('admin'), reservasController.crearServicio);
router.put('/servicios/:id', authenticate, authorize('admin'), reservasController.actualizarServicio);
router.delete('/servicios/:id', authenticate, authorize('admin'), reservasController.eliminarServicio);

router.get('/disponibilidad', reservasController.disponibilidad);

router.get('/jornada', reservasController.getJornada);
router.put('/jornada', authenticate, authorize('admin'), reservasController.updateJornada);

router.get('/empleado-tiempos-servicio', authenticate, authorize('admin', 'empleado'), reservasController.getEmpleadoTiemposServicio);
router.put('/empleado-tiempos-servicio', authenticate, authorize('admin', 'empleado'), reservasController.updateEmpleadoTiemposServicio);

router.post('/', authenticate, authorize('cliente'), reservasController.crearReserva);
router.get('/me', authenticate, authorize('cliente'), reservasController.misReservas);
router.delete('/me/:id', authenticate, authorize('cliente'), reservasController.cancelarMiReserva);

router.get('/', authenticate, authorize('empleado', 'admin'), reservasController.listarReservas);

module.exports = router;
