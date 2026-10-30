const { Router } = require('express');
const reservasController = require('./reservas.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/empleados-disponibles', reservasController.empleadosDisponibles);
router.get('/empleados-por-servicio', reservasController.empleadosPorServicio);
router.get('/empleados-por-sede', reservasController.empleadosPorSede);
router.get('/sedes-por-servicio', reservasController.listarSedesPorServicio);
router.post('/disponibilidad-combo', reservasController.disponibilidadCombo);

router.get('/configuracion', reservasController.getConfiguracion);
router.put('/configuracion', authenticate, authorize('admin'), reservasController.updateConfiguracion);

router.get('/categorias', reservasController.listarCategorias);
router.post('/categorias', authenticate, authorize('admin'), reservasController.crearCategoria);
router.put('/categorias/:id', authenticate, authorize('admin'), reservasController.actualizarCategoria);
router.delete('/categorias/:id', authenticate, authorize('admin'), reservasController.eliminarCategoria);

router.get('/servicios', reservasController.listarServicios);
router.get('/servicios/:id/imagenes', reservasController.listarImagenesServicio);
router.post('/servicios', authenticate, authorize('admin'), reservasController.crearServicio);
router.put('/servicios/:id', authenticate, authorize('admin'), reservasController.actualizarServicio);
router.delete('/servicios/:id', authenticate, authorize('admin'), reservasController.eliminarServicio);

router.get('/disponibilidad', authenticate, authorize('cliente', 'empleado', 'admin'), reservasController.disponibilidad);

router.get('/jornada/plantilla', reservasController.getJornadaPlantilla);
router.put('/jornada/plantilla', authenticate, authorize('admin'), reservasController.updateJornadaPlantilla);
router.put('/jornada/plantilla/todas', authenticate, authorize('admin'), reservasController.updateJornadaPlantillaTodas);
router.get('/festivos', reservasController.getFestivos);
router.get('/jornada', reservasController.getJornada);
router.put('/jornada', authenticate, authorize('admin'), reservasController.updateJornada);
router.post('/jornada/festivo', authenticate, authorize('admin'), reservasController.abrirFestivo);

router.get('/empleado-tiempos-servicio', authenticate, authorize('admin', 'empleado', 'cliente'), reservasController.getEmpleadoTiemposServicio);
router.put('/empleado-tiempos-servicio', authenticate, authorize('admin', 'empleado'), reservasController.updateEmpleadoTiemposServicio);

router.get('/empleado/dia', authenticate, authorize('empleado'), reservasController.reservasEmpleadoDia);
router.post('/empleado/cancelar-dia', authenticate, authorize('empleado'), reservasController.cancelarDiaEmpleado);

router.post('/', authenticate, authorize('cliente'), reservasController.crearReserva);
router.get('/me', authenticate, authorize('cliente'), reservasController.misReservas);
router.delete('/me/:id', authenticate, authorize('cliente'), reservasController.cancelarMiReserva);

router.get('/agenda', authenticate, authorize('admin'), reservasController.agenda);

router.get('/', authenticate, authorize('empleado', 'admin'), reservasController.listarReservas);

module.exports = router;
