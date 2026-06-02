const { Router } = require('express');
const clientesController = require('./clientes.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/me', authenticate, authorize('cliente'), clientesController.getMe);
router.put('/me', authenticate, authorize('cliente'), clientesController.updateMe);
router.delete('/me', authenticate, authorize('cliente'), clientesController.deleteMe);

router.get('/', authenticate, authorize('admin'), clientesController.listar);
router.put('/:id/bloquear', authenticate, authorize('admin'), clientesController.bloquear);
router.put('/:id/desbloquear', authenticate, authorize('admin'), clientesController.desbloquear);
router.delete('/:id', authenticate, authorize('admin'), clientesController.eliminar);

module.exports = router;
