const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authModel = require('./auth.model');
const env = require('../../config/env');
const HttpError = require('../../shared/http-error');
const { enviarCorreoVerificacion } = require('../../integrations/email/mailer');
const logger = require('../../shared/logger');
const { validarTelefono, normalizarTelefono } = require('../../shared/utils/telefono');

const EXPIRACION_TOKEN_MINUTOS = env.registroTtlMinutos;

function validarEmail(email) {
  return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function validarFotoEmpleado(foto) {
  if (foto === undefined) return undefined;
  if (foto === null || foto === '') return null;
  if (typeof foto !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(foto)) {
    throw new HttpError(400, 'La foto debe ser una imagen JPG, PNG o WebP');
  }
  if (foto.length > 2_500_000) {
    throw new HttpError(400, 'La foto es demasiado grande');
  }
  return foto;
}

function normalizarTelefonoRequerido(telefono) {
  const normalizado = normalizarTelefono(telefono);
  if (!validarTelefono(normalizado)) {
    throw new HttpError(400, 'El telefono debe incluir el codigo de pais, por ejemplo +573001112233');
  }
  return normalizado;
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
    telefono = normalizarTelefonoRequerido(telefono);

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
        foto_url: usuario.foto_url || null,
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
        foto_url: usuario.foto_url || null,
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
    if (data.rol !== undefined && !['empleado', 'admin'].includes(data.rol)) {
      throw new HttpError(400, 'El rol debe ser empleado o admin');
    }
    const rol = data.rol === 'admin' ? 'admin' : 'empleado';
    if (data.telefono) {
      data.telefono = normalizarTelefonoRequerido(data.telefono);
    }

    let comision = 50;
    if (rol === 'empleado') {
      comision = data.comision_porcentaje === undefined ? 50 : Number(data.comision_porcentaje);
      if (!Number.isFinite(comision) || comision < 0 || comision > 100) {
        throw new HttpError(400, 'El porcentaje del empleado debe estar entre 0 y 100');
      }
    }

    const existente = await authModel.findByEmail(data.email);
    if (existente) {
      throw new HttpError(409, 'El correo ya esta registrado');
    }

    const password_hash = await bcrypt.hash(data.password || (rol === 'admin' ? 'admin123' : 'empleado123'), 12);
    const usuario = await authModel.create({
      email: data.email,
      password_hash,
      rol,
      nombre: data.nombre,
      apellido: data.apellido,
      telefono: data.telefono || null,
      verificado: true,
    });

    await authModel.ensurePreferencias(usuario.id);

    if (rol === 'empleado') {
      await authModel.createEmpleadoPerfil(usuario.id, {
        identificacion: data.identificacion || null,
        password_asignada_hash: password_hash,
        ubicacion_base_id: data.ubicacion_base_id || null,
        comision_porcentaje: comision,
        foto_url: validarFotoEmpleado(data.foto_url) ?? null,
      });
    }

    return authModel.findUsuarioGestionado(usuario.id);
  },

  async updateEmpleado(id, data) {
    const existente = await authModel.findUsuarioGestionado(id);
    if (!existente) {
      throw new HttpError(404, 'Usuario no encontrado');
    }
    if (data.rol !== undefined && data.rol !== existente.rol) {
      throw new HttpError(400, 'El rol de una cuenta no se puede cambiar');
    }
    if (data.email !== undefined && !validarEmail(data.email)) {
      throw new HttpError(400, 'El correo no tiene un formato valido');
    }
    if (data.telefono !== undefined && data.telefono !== null && data.telefono !== '') {
      data.telefono = normalizarTelefonoRequerido(data.telefono);
    }
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 12);
    }

    if (existente.rol === 'admin') {
      const payload = {
        email: data.email,
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono,
        password_hash: data.password_hash,
      };
      return authModel.updateUsuarioBase(id, payload);
    }

    if (data.foto_url !== undefined) {
      data.foto_url = validarFotoEmpleado(data.foto_url);
    }
    if (data.comision_porcentaje !== undefined) {
      const comision = Number(data.comision_porcentaje);
      if (!Number.isFinite(comision) || comision < 0 || comision > 100) {
        throw new HttpError(400, 'El porcentaje del empleado debe estar entre 0 y 100');
      }
      data.comision_porcentaje = comision;
    }
    return authModel.updateEmpleado(id, data);
  },

  async deleteEmpleado(id, solicitanteId = null) {
    const usuario = await authModel.findUsuarioGestionado(id);
    if (!usuario) {
      throw new HttpError(404, 'Usuario no encontrado');
    }

    if (usuario.rol === 'admin') {
      if (solicitanteId && Number(solicitanteId) === Number(id)) {
        throw new HttpError(409, 'No puedes eliminar tu propia cuenta de administrador');
      }
      const totalAdmins = await authModel.countAdmins();
      if (totalAdmins <= 1) {
        throw new HttpError(409, 'No se puede eliminar el ultimo administrador');
      }
      const tieneCobros = await authModel.hasCobros(id);
      if (tieneCobros) {
        throw new HttpError(409, 'No se puede eliminar el administrador porque tiene cobros asociados');
      }
      await authModel.deleteUsuarioGestionado(id);
      return { eliminado: true };
    }

    const tieneCobros = await authModel.hasCobros(id);
    if (tieneCobros) {
      throw new HttpError(409, 'No se puede eliminar el empleado porque tiene cobros asociados');
    }
    const tieneReservas = await authModel.hasReservas(id);
    if (tieneReservas) {
      throw new HttpError(409, 'No se puede eliminar el empleado porque tiene reservas asociadas');
    }

    await authModel.deleteEmpleado(id);
    return { eliminado: true };
  },
};

module.exports = authService;
