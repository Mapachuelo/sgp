const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authModel = require('./auth.model');
const env = require('../../config/env');
const HttpError = require('../../shared/http-error');
const { enviarCorreoVerificacion } = require('../../integrations/email/mailer');
const logger = require('../../shared/logger');
const { validarTelefono } = require('../../shared/utils/telefono');

const EXPIRACION_TOKEN_MINUTOS = env.registroTtlMinutos;

function validarEmail(email) {
  return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function validarTelefonoRequerido(telefono) {
  if (!validarTelefono(telefono)) {
    throw new HttpError(400, 'El telefono debe tener formato colombiano: +57 seguido de 10 digitos');
  }
}

function generarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCodigo(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex');
}

function emitirToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

const authService = {
  async register({ email, password, nombre, apellido, telefono }) {
    if (!validarEmail(email)) {
      throw new HttpError(400, 'El correo no tiene un formato valido');
    }
    validarTelefonoRequerido(telefono);

    const existente = await authModel.findByEmail(email);
    if (existente) {
      if (existente.verificado || existente.rol !== 'cliente') {
        throw new HttpError(409, 'El correo ya esta registrado');
      }
      await authModel.deleteUsuario(existente.id);
      logger.info({ email }, 'Registro sin verificar reemplazado por uno nuevo');
    }

    const password_hash = await bcrypt.hash(password, 12);
    const usuario = await authModel.create({
      email,
      password_hash,
      rol: 'cliente',
      nombre,
      apellido,
      telefono,
    });

    await authModel.ensurePreferencias(usuario.id);

    const codigo = generarCodigo();
    const expiracion = new Date(Date.now() + EXPIRACION_TOKEN_MINUTOS * 60 * 1000);
    await authModel.saveVerificationToken(usuario.id, hashCodigo(codigo), expiracion);

    let correoEnviado = true;
    try {
      await enviarCorreoVerificacion({ email, nombre, codigo });
    } catch (err) {
      correoEnviado = false;
      logger.error({ err, email }, 'No se pudo enviar el correo de verificacion');
    }

    return {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        telefono: usuario.telefono,
        rol: usuario.rol,
      },
      correoEnviado,
      expiraEn: expiracion.toISOString(),
      ttlMinutos: EXPIRACION_TOKEN_MINUTOS,
    };
  },

  async verificar({ email, codigo }) {
    const usuario = await authModel.findByEmail(email);
    if (!usuario) {
      throw new HttpError(404, 'Usuario no encontrado');
    }

    if (usuario.verificado) {
      throw new HttpError(409, 'La cuenta ya esta verificada');
    }

    if (!codigo || !/^\d{6}$/.test(codigo)) {
      throw new HttpError(400, 'El codigo debe tener 6 digitos');
    }

    const datos = await authModel.findVerificationData(usuario.id);
    if (!datos.token_verificacion || !datos.token_verificacion_expiracion) {
      throw new HttpError(400, 'No hay codigo pendiente. Solicita uno nuevo.');
    }

    if (new Date(datos.token_verificacion_expiracion) < new Date()) {
      throw new HttpError(400, 'El codigo expiro. Solicita uno nuevo.');
    }

    if (datos.token_verificacion !== hashCodigo(codigo)) {
      throw new HttpError(400, 'El codigo es incorrecto');
    }

    const usuarioVerificado = await authModel.markVerified(usuario.id);
    const token = emitirToken(usuarioVerificado);

    return { token, usuario: usuarioVerificado };
  },

  async reenviarCodigo(email) {
    const usuario = await authModel.findByEmail(email);
    if (!usuario) {
      throw new HttpError(404, 'Usuario no encontrado');
    }

    if (usuario.verificado) {
      throw new HttpError(409, 'La cuenta ya esta verificada');
    }

    const codigo = generarCodigo();
    const expiracion = new Date(Date.now() + EXPIRACION_TOKEN_MINUTOS * 60 * 1000);

    try {
      await enviarCorreoVerificacion({ email, nombre: usuario.nombre, codigo });
    } catch (err) {
      logger.error({ err, email }, 'No se pudo reenviar el correo de verificacion');
      throw new HttpError(502, 'No se pudo enviar el correo. Intenta nuevamente.');
    }

    await authModel.saveVerificationToken(usuario.id, hashCodigo(codigo), expiracion);

    return {
      reenviado: true,
      expiraEn: expiracion.toISOString(),
      ttlMinutos: EXPIRACION_TOKEN_MINUTOS,
    };
  },

  async login(email, password) {
    const usuario = await authModel.findByEmail(email);
    if (!usuario) {
      throw new HttpError(401, 'Credenciales invalidas');
    }

    if (usuario.esta_bloqueado) {
      throw new HttpError(403, 'Su cuenta esta bloqueada. Contacte al administrador.');
    }

    if (!usuario.verificado) {
      throw new HttpError(403, 'Cuenta no verificada. Revisa tu correo para completar la verificacion.');
    }

    const esValida = await bcrypt.compare(password, usuario.password_hash);
    if (!esValida) {
      throw new HttpError(401, 'Credenciales invalidas');
    }

    const token = emitirToken(usuario);

    return {
      token,
      rol: usuario.rol,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        telefono: usuario.telefono,
        rol: usuario.rol,
      },
    };
  },

  async getMe(usuarioId) {
    const usuario = await authModel.findById(usuarioId);
    if (!usuario) {
      throw new HttpError(404, 'Usuario no encontrado');
    }
    return usuario;
  },

  async createEmpleado(data) {
    if (!validarEmail(data.email)) {
      throw new HttpError(400, 'El correo no tiene un formato valido');
    }
    if (data.telefono) {
      validarTelefonoRequerido(data.telefono);
    }

    const existente = await authModel.findByEmail(data.email);
    if (existente) {
      throw new HttpError(409, 'El correo ya esta registrado');
    }

    const password_hash = await bcrypt.hash(data.password || 'empleado123', 12);
    const usuario = await authModel.create({
      email: data.email,
      password_hash,
      rol: 'empleado',
      nombre: data.nombre,
      apellido: data.apellido,
      telefono: data.telefono || null,
      verificado: true,
    });

    await authModel.ensurePreferencias(usuario.id);

    await authModel.createEmpleadoPerfil(usuario.id, {
      identificacion: data.identificacion || null,
      password_asignada_hash: password_hash,
      ubicacion_base_id: data.ubicacion_base_id || null,
    });

    return authModel.findEmpleadoById(usuario.id);
  },

  async updateEmpleado(id, data) {
    const existente = await authModel.findEmpleadoById(id);
    if (!existente) {
      throw new HttpError(404, 'Empleado no encontrado');
    }
    if (data.email !== undefined && !validarEmail(data.email)) {
      throw new HttpError(400, 'El correo no tiene un formato valido');
    }
    if (data.telefono !== undefined && data.telefono !== null && data.telefono !== '') {
      validarTelefonoRequerido(data.telefono);
    }
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 12);
    }
    return authModel.updateEmpleado(id, data);
  },

  async deleteEmpleado(id) {
    const empleado = await authModel.findEmpleadoById(id);
    if (!empleado) {
      throw new HttpError(404, 'Empleado no encontrado');
    }

    const tieneCobros = await authModel.hasCobros(id);
    if (tieneCobros) {
      throw new HttpError(409, 'No se puede eliminar el empleado porque tiene cobros asociados');
    }

    await authModel.deleteEmpleado(id);
    return { eliminado: true };
  },
};

module.exports = authService;
