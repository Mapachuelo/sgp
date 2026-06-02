const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authModel = require('./auth.model');
const env = require('../../config/env');
const HttpError = require('../../shared/http-error');

const authService = {
  async register({ email, password, nombre, apellido, telefono }) {
    const existente = await authModel.findByEmail(email);
    if (existente) {
      throw new HttpError(409, 'El correo ya esta registrado');
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

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return { token, usuario };
  },

  async login(email, password) {
    const usuario = await authModel.findByEmail(email);
    if (!usuario) {
      throw new HttpError(401, 'Credenciales invalidas');
    }

    if (usuario.esta_bloqueado) {
      throw new HttpError(403, 'Su cuenta esta bloqueada. Contacte al administrador.');
    }

    const esValida = await bcrypt.compare(password, usuario.password_hash);
    if (!esValida) {
      throw new HttpError(401, 'Credenciales invalidas');
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return {
      token,
      rol: usuario.rol,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
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
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 12);
    }
    const empleado = await authModel.updateEmpleado(id, data);
    if (!empleado) {
      throw new HttpError(404, 'Empleado no encontrado');
    }
    return empleado;
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
