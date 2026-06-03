const reservasService = require('./reservas.service');
const asyncHandler = require('../../shared/async-handler');
const HttpError = require('../../shared/http-error');
const logger = require('../../shared/logger');

const reservasController = {
  listarServicios: asyncHandler(async (_req, res) => {
    const servicios = await reservasService.getServicios();
    res.json({ ok: true, data: servicios });
  }),

  crearServicio: asyncHandler(async (req, res) => {
    const servicio = await reservasService.createServicio(req.body);
    res.status(201).json({ ok: true, data: servicio });
  }),

  actualizarServicio: asyncHandler(async (req, res) => {
    const servicio = await reservasService.updateServicio(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true, data: servicio });
  }),

  eliminarServicio: asyncHandler(async (req, res) => {
    await reservasService.deleteServicio(parseInt(req.params.id, 10));
    res.json({ ok: true, data: { eliminado: true } });
  }),

  disponibilidad: asyncHandler(async (req, res) => {
    const result = await reservasService.getDisponibilidad(req.query);
    res.json({ ok: true, data: result });
  }),

  getJornada: asyncHandler(async (req, res) => {
    const result = await reservasService.getJornada(req.query.ubicacion_id);
    res.json({ ok: true, data: result });
  }),

  updateJornada: asyncHandler(async (req, res) => {
    const { ubicacion_id, items } = req.body;
    if (!ubicacion_id || !items) {
      throw new HttpError(400, 'ubicacion_id e items son requeridos');
    }
    const result = await reservasService.updateJornada(ubicacion_id, items);
    res.json({ ok: true, data: result });
  }),

  getEmpleadoTiemposServicio: asyncHandler(async (req, res) => {
    const empleado_id = req.usuario.rol === 'empleado' ? req.usuario.id : req.query.empleado_id;
    const result = await reservasService.getEmpleadoTiemposServicio(empleado_id);
    res.json({ ok: true, data: result });
  }),

  updateEmpleadoTiemposServicio: asyncHandler(async (req, res) => {
    const empleado_id = req.usuario.rol === 'empleado' ? req.usuario.id : req.body.empleado_id;
    const { items } = req.body;
    if (!empleado_id || !items) {
      throw new HttpError(400, 'empleado_id e items son requeridos');
    }
    const result = await reservasService.updateEmpleadoTiemposServicio(empleado_id, items);
    res.json({ ok: true, data: result });
  }),

  crearReserva: asyncHandler(async (req, res) => {
    const reserva = await reservasService.createReserva(req.usuario.id, req.body);
    logger.info({ reserva_id: reserva.id, cliente_id: req.usuario.id }, 'Reserva creada');
    res.status(201).json({ ok: true, data: reserva });
  }),

  misReservas: asyncHandler(async (req, res) => {
    const reservas = await reservasService.getReservasByCliente(req.usuario.id);
    res.json({ ok: true, data: reservas });
  }),

  cancelarMiReserva: asyncHandler(async (req, res) => {
    const result = await reservasService.cancelReserva(
      parseInt(req.params.id, 10),
      req.usuario.id
    );
    logger.info({ reserva_id: req.params.id }, 'Reserva cancelada por cliente');
    res.json({ ok: true, data: result });
  }),

  empleadosDisponibles: asyncHandler(async (req, res) => {
    const { ubicacion_id, fecha } = req.query;
    if (!ubicacion_id || !fecha) {
      throw new HttpError(400, 'ubicacion_id y fecha son requeridos');
    }
    const reservasModel = require('./reservas.model');
    const empleados = await reservasModel.findEmpleadosDisponibles(fecha, ubicacion_id);
    res.json({ ok: true, data: empleados });
  }),

  listarReservas: asyncHandler(async (req, res) => {
    if (req.usuario.rol === 'empleado') {
      req.query.empleado_id = req.usuario.id;
    }
    const reservas = await reservasService.getAllReservas(req.query);
    res.json({ ok: true, data: reservas });
  }),
};

module.exports = reservasController;
