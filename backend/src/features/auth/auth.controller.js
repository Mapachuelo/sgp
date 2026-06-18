const authService = require('./auth.service');
const asyncHandler = require('../../shared/async-handler');
const HttpError = require('../../shared/http-error');
const logger = require('../../shared/logger');

const authController = {
  register: asyncHandler(async (req, res) => {
    const { nombre, apellido, email, password, telefono } = req.body;

    if (!nombre || !apellido || !email || !password || !telefono) {
      throw new HttpError(400, 'Todos los campos son requeridos: nombre, apellido, email, password, telefono');
    }

    if (!/^\+57[0-9]{10}$/.test(telefono)) {
      throw new HttpError(400, 'El telefono debe tener formato colombiano: +57 seguido de 10 digitos');
    }

    const resultado = await authService.register({ nombre, apellido, email, password, telefono });
    logger.info({ email }, 'Cliente registrado exitosamente');

    res.status(201).json({
      ok: true,
      data: resultado,
    });
  }),

  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new HttpError(400, 'Email y password son requeridos');
    }

    const resultado = await authService.login(email, password);
    logger.info({ email, rol: resultado.rol }, 'Inicio de sesion exitoso');

    res.json({
      ok: true,
      data: resultado,
    });
  }),

  getMe: asyncHandler(async (req, res) => {
    const usuario = await authService.getMe(req.usuario.id);
    res.json({
      ok: true,
      data: usuario,
    });
  }),

  listarEmpleados: asyncHandler(async (req, res) => {
    const authModel = require('./auth.model');
    const empleados = await authModel.findAllEmpleados();
    res.json({
      ok: true,
      data: empleados,
    });
  }),

  crearEmpleado: asyncHandler(async (req, res) => {
    const empleado = await authService.createEmpleado(req.body);
    logger.info({ email: req.body.email }, 'Empleado creado por admin');
    res.status(201).json({
      ok: true,
      data: empleado,
    });
  }),

  actualizarEmpleado: asyncHandler(async (req, res) => {
    const empleado = await authService.updateEmpleado(parseInt(req.params.id, 10), req.body);
    res.json({
      ok: true,
      data: empleado,
    });
  }),

  eliminarEmpleado: asyncHandler(async (req, res) => {
    const resultado = await authService.deleteEmpleado(parseInt(req.params.id, 10));
    res.json({
      ok: true,
      data: resultado,
    });
  }),
};

module.exports = authController;
