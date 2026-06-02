const { Router } = require('express');
const ubicacionesController = require('./ubicaciones.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/', ubicacionesController.listar);
router.post('/', authenticate, authorize('admin'), ubicacionesController.crear);
router.put('/:id', authenticate, authorize('admin'), ubicacionesController.actualizar);
router.delete('/:id', authenticate, authorize('admin'), ubicacionesController.eliminar);

module.exports = router;
