const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Router } = require('express');
const multer = require('multer');
const presentacionController = require('./presentacion.controller');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const env = require('../../config/env');

fs.mkdirSync(env.presentacionMediaDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.presentacionMediaDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024, files: 8 },
});

const router = Router();

router.get('/', presentacionController.publica);

router.get('/admin', authenticate, authorize('admin'), presentacionController.admin);
router.put('/config', authenticate, authorize('admin'), presentacionController.actualizarConfig);
router.put('/media/orden', authenticate, authorize('admin'), presentacionController.reordenar);
router.post(
  '/media',
  authenticate,
  authorize('admin'),
  upload.fields([{ name: 'archivos', maxCount: 6 }, { name: 'poster', maxCount: 1 }]),
  presentacionController.crearMedia
);
router.post(
  '/media/:id/fuentes',
  authenticate,
  authorize('admin'),
  upload.fields([{ name: 'archivos', maxCount: 6 }]),
  presentacionController.agregarFuentes
);
router.put('/media/:id', authenticate, authorize('admin'), presentacionController.actualizarMedia);
router.delete('/media/:id/fuentes/:fuenteId', authenticate, authorize('admin'), presentacionController.eliminarFuente);
router.delete('/media/:id', authenticate, authorize('admin'), presentacionController.eliminarMedia);

module.exports = router;
