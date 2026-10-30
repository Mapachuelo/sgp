const reservasService = require('./reservas.service');
const asyncHandler = require('../../shared/async-handler');
const HttpError = require('../../shared/http-error');
const logger = require('../../shared/logger');
const { emitReservaActualizada } = require('../../integrations/realtime/ws-hub');

const reservasController = {
  listarServicios: asyncHandler(async (req, res) => {
    const servicios = await reservasService.getServicios(req.query);
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
    const resultado = await reservasService.deleteServicio(parseInt(req.params.id, 10));
    res.json({ ok: true, data: resultado });
  }),

  listarImagenesServicio: asyncHandler(async (req, res) => {
    const imagenes = await reservasService.getImagenesServicio(parseInt(req.params.id, 10));
    res.json({ ok: true, data: imagenes });
  }),

  listarSedesPorServicio: asyncHandler(async (req, res) => {
    const sedes = await reservasService.getSedesPorServicio(req.query);
    res.json({ ok: true, data: sedes });
  }),

  listarCategorias: asyncHandler(async (_req, res) => {
    const categorias = await reservasService.getCategorias();
    res.json({ ok: true, data: categorias });
  }),

  crearCategoria: asyncHandler(async (req, res) => {
    const categoria = await reservasService.createCategoria(req.body);
    res.status(201).json({ ok: true, data: categoria });
  }),

  actualizarCategoria: asyncHandler(async (req, res) => {
    const categoria = await reservasService.updateCategoria(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true, data: categoria });
  }),

  eliminarCategoria: asyncHandler(async (req, res) => {
    const resultado = await reservasService.deleteCategoria(parseInt(req.params.id, 10));
    res.json({ ok: true, data: resultado });
  }),

  getConfiguracion: asyncHandler(async (_req, res) => {
    const configuracion = await reservasService.getConfiguracion();
    res.json({ ok: true, data: configuracion });
  }),

  updateConfiguracion: asyncHandler(async (req, res) => {
    const configuracion = await reservasService.updateConfiguracion(req.body);
    res.json({ ok: true, data: configuracion });
  }),

  disponibilidad: asyncHandler(async (req, res) => {
    const result = await reservasService.getDisponibilidad(req.query);
    res.json({ ok: true, data: result });
  }),

  disponibilidadCombo: asyncHandler(async (req, res) => {
    const result = await reservasService.getDisponibilidadCombo(req.body || req.query);
    res.json({ ok: true, data: result });
  }),

  getJornada: asyncHandler(async (req, res) => {
    const result = await reservasService.getJornada(req.query.ubicacion_id);
    res.json({ ok: true, data: result });
  }),

  getJornadaPlantilla: asyncHandler(async (req, res) => {
    const result = await reservasService.getJornadaPlantilla(req.query.ubicacion_id || null);
    res.json({ ok: true, data: result });
  }),

  updateJornadaPlantilla: asyncHandler(async (req, res) => {
    const { ubicacion_id, items } = req.body;
    if (!ubicacion_id || !items) {
      throw new HttpError(400, 'ubicacion_id e items son requeridos');
    }
    const result = await reservasService.updateJornadaPlantilla(ubicacion_id, items);
    result.reservas_canceladas.forEach((id) => emitReservaActualizada(id, 'cancelada'));
    res.json({ ok: true, data: result });
  }),

  updateJornadaPlantillaTodas: asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!items) throw new HttpError(400, 'items es requerido');
    const result = await reservasService.updateJornadaPlantillaTodas(items);
    result.reservas_canceladas.forEach((id) => emitReservaActualizada(id, 'cancelada'));
    res.json({ ok: true, data: result });
  }),

  getFestivos: asyncHandler(async (req, res) => {
    const result = await reservasService.getFestivos(req.query.desde, req.query.hasta);
    res.json({ ok: true, data: result });
  }),

  abrirFestivo: asyncHandler(async (req, res) => {
    const result = await reservasService.abrirFestivo(req.body || {});
    res.json({ ok: true, data: result });
  }),

  updateJornada: asyncHandler(async (req, res) => {
    const { ubicacion_id, items } = req.body;
    if (!ubicacion_id || !items) {
      throw new HttpError(400, 'ubicacion_id e items son requeridos');
    }
    const result = await reservasService.updateJornada(ubicacion_id, items);
    result.reservas_canceladas.forEach((id) => emitReservaActualizada(id, 'cancelada'));
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
    emitReservaActualizada(reserva.id, 'pendiente');
    res.status(201).json({ ok: true, data: reserva });
  }),

  reservasEmpleadoDia: asyncHandler(async (req, res) => {
    const data = await reservasService.getReservasEmpleadoDia(req.usuario.id, req.query.fecha);
    res.json({ ok: true, data });
  }),

  cancelarDiaEmpleado: asyncHandler(async (req, res) => {
    const result = await reservasService.cancelarDiaEmpleado(req.usuario.id, req.body || {});
    result.reservas_canceladas.forEach((item) => emitReservaActualizada(item.reserva_id, 'cancelada'));
    logger.info(
      { empleado_id: req.usuario.id, fecha: result.fecha, total: result.total_canceladas },
      'Dia del empleado cancelado por imprevisto'
    );
    res.json({ ok: true, data: result });
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
    emitReservaActualizada(result.id, 'cancelada');
    res.json({ ok: true, data: result });
  }),

  empleadosDisponibles: asyncHandler(async (req, res) => {
    const empleados = await reservasService.getEmpleadosDisponibles(req.query);
    res.json({ ok: true, data: empleados });
  }),

  empleadosPorServicio: asyncHandler(async (req, res) => {
    const empleados = await reservasService.getEmpleadosPorServicio(req.query);
    res.json({ ok: true, data: empleados });
  }),

  empleadosPorSede: asyncHandler(async (req, res) => {
    const empleados = await reservasService.getEmpleadosPorSede(req.query);
    res.json({ ok: true, data: empleados });
  }),

  listarReservas: asyncHandler(async (req, res) => {
    if (req.usuario.rol === 'empleado') {
      req.query.empleado_id = req.usuario.id;
    }
    const reservas = await reservasService.getAllReservas(req.query);
    res.json({ ok: true, data: reservas });
  }),

  agenda: asyncHandler(async (req, res) => {
    const reservas = await reservasService.getAgenda(req.query);
    res.json({ ok: true, data: reservas });
  }),
};

module.exports = reservasController;
