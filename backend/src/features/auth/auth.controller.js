const authService = require('./auth.service');
const asyncHandler = require('../../shared/async-handler');
const HttpError = require('../../shared/http-error');
const logger = require('../../shared/logger');
const { validarTelefono } = require('../../shared/utils/telefono');

const authController = {
  register: asyncHandler(async (req, res) => {
    const { nombre, apellido, email, password, telefono } = req.body;

    if (!nombre || !apellido || !email || !password || !telefono) {
      throw new HttpError(400, 'Todos los campos son requeridos: nombre, apellido, email, password, telefono');
    }

    if (!validarTelefono(telefono)) {
      throw new HttpError(400, 'El telefono debe incluir el codigo de pais, por ejemplo +573001112233');
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

  verificar: asyncHandler(async (req, res) => {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      throw new HttpError(400, 'Email y codigo son requeridos');
    }

    const resultado = await authService.verificar({ email, codigo });
    logger.info({ email }, 'Cuenta verificada exitosamente');

    res.json({
      ok: true,
      data: resultado,
    });
  }),

  reenviarCodigo: asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new HttpError(400, 'Email es requerido');
    }

    const resultado = await authService.reenviarCodigo(email);
    logger.info({ email }, 'Codigo de verificacion reenviado');

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
    const rol = req.query.rol === 'empleado' || req.query.rol === 'admin' ? req.query.rol : null;
    const usuarios = await authModel.findAllUsuarios({ rol });
    res.json({
      ok: true,
      data: usuarios,
    });
  }),

  crearEmpleado: asyncHandler(async (req, res) => {
    const empleado = await authService.createEmpleado(req.body);
    logger.info({ email: req.body.email, rol: empleado.rol }, 'Usuario creado por admin');
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
    const resultado = await authService.deleteEmpleado(parseInt(req.params.id, 10), req.usuario.id);
    res.json({
      ok: true,
      data: resultado,
    });
  }),
};

module.exports = authController;
