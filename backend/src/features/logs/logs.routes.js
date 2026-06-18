const { Router } = require('express');
const logsController = require('./logs.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/actividad', authenticate, authorize('admin'), logsController.actividad);
router.get('/errores', authenticate, authorize('admin'), logsController.errores);
router.get('/exportar', authenticate, authorize('admin'), logsController.exportar);

module.exports = router;
