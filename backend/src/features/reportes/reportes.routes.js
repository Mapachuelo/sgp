const { Router } = require('express');
const reportesController = require('./reportes.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/ventas-diarias', authenticate, authorize('admin'), reportesController.ventasDiarias);
router.get('/ocupacion', authenticate, authorize('admin'), reportesController.ocupacion);
router.get('/mi-resumen', authenticate, authorize('empleado'), reportesController.resumenEmpleado);

router.get('/nomina', authenticate, authorize('admin'), reportesController.nomina);
router.get('/nomina/pdf', authenticate, authorize('admin'), reportesController.nominaPdf);
router.get('/clientes-recurrentes', authenticate, authorize('admin'), reportesController.clientesRecurrentes);

module.exports = router;
