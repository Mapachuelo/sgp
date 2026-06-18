const { Router } = require('express');
const authController = require('./auth.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const authLimiter = require('../../shared/middlewares/rateLimit.middleware');

const router = Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', authenticate, authController.getMe);

router.get('/empleados', authenticate, authorize('admin'), authController.listarEmpleados);
router.post('/empleados', authenticate, authorize('admin'), authController.crearEmpleado);
router.put('/empleados/:id', authenticate, authorize('admin'), authController.actualizarEmpleado);
router.delete('/empleados/:id', authenticate, authorize('admin'), authController.eliminarEmpleado);

module.exports = router;
