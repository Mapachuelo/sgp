const { Router } = require('express');
const authRoutes = require('../features/auth/auth.routes');
const clientesRoutes = require('../features/clientes/clientes.routes');
const ubicacionesRoutes = require('../features/ubicaciones/ubicaciones.routes');
const reservasRoutes = require('../features/reservas/reservas.routes');
const checkinRoutes = require('../features/checkin/checkin.routes');
const reportesRoutes = require('../features/reportes/reportes.routes');
const disponibilidadRoutes = require('../features/disponibilidad/disponibilidad.routes');
const logsRoutes = require('../features/logs/logs.routes');
const preferenciasRoutes = require('../features/preferencias/preferencias.routes');

const router = Router();

router.get('/healthcheck', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

router.use('/auth', authRoutes);
router.use('/clientes', clientesRoutes);
router.use('/ubicaciones', ubicacionesRoutes);
router.use('/reservas', reservasRoutes);
router.use('/checkin', checkinRoutes);
router.use('/reportes', reportesRoutes);
router.use('/empleados', disponibilidadRoutes);
router.use('/logs', logsRoutes);
router.use('/preferencias', preferenciasRoutes);

module.exports = router;
