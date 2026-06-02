const { Router } = require('express');
const preferenciasController = require('./preferencias.controller');
const { authenticate } = require('../../shared/middlewares/auth.middleware');

const router = Router();

router.get('/', authenticate, preferenciasController.get);
router.put('/', authenticate, preferenciasController.update);

module.exports = router;
