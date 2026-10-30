const clientesModel = require('./clientes.model');
const HttpError = require('../../shared/http-error');
const { validarTelefono, normalizarTelefono } = require('../../shared/utils/telefono');

function validarDatosPerfil(data) {
  if (data.telefono !== undefined && data.telefono !== null && data.telefono !== '') {
    data.telefono = normalizarTelefono(data.telefono);
    if (!validarTelefono(data.telefono)) {
      throw new HttpError(400, 'El telefono debe incluir el codigo de pais, por ejemplo +573001112233');
    }
  }
  if (data.email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
    throw new HttpError(400, 'El correo no tiene un formato valido');
  }
  if (data.foto_url !== undefined && data.foto_url !== null && data.foto_url !== '') {
    if (typeof data.foto_url !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(data.foto_url)) {
      throw new HttpError(400, 'La foto debe ser una imagen JPG, PNG o WebP');
    }
    if (data.foto_url.length > 2_500_000) {
      throw new HttpError(400, 'La foto es demasiado grande');
    }
  }
}

const clientesService = {
  async getMe(usuarioId) {
    const user = await clientesModel.findUserById(usuarioId);
    if (!user) {
      throw new HttpError(404, 'Usuario no encontrado');
    }
    return user;
  },

  async updateMe(usuarioId, data) {
    validarDatosPerfil(data);
    if (data.telefono === '') data.telefono = null;
    const user = await clientesModel.updateUser(usuarioId, data);
    if (!user) {
      throw new HttpError(404, 'Usuario no encontrado');
    }
    return user;
  },

  async deleteMe(usuarioId) {
    const eliminado = await clientesModel.delete(usuarioId);
    if (!eliminado) {
      throw new HttpError(404, 'Cliente no encontrado');
    }
    return { eliminado: true };
  },

  async findAll() {
    return clientesModel.findAll();
  },

  async bloquear(id, motivo, adminId) {
    const cliente = await clientesModel.findById(id);
    if (!cliente) {
      throw new HttpError(404, 'Cliente no encontrado');
    }
    const result = await clientesModel.bloquear(id, motivo, adminId);
    if (!result) {
      throw new HttpError(404, 'Cliente no encontrado');
    }
    return result;
  },

  async desbloquear(id) {
    const cliente = await clientesModel.findById(id);
    if (!cliente) {
      throw new HttpError(404, 'Cliente no encontrado');
    }
    const result = await clientesModel.desbloquear(id);
    if (!result) {
      throw new HttpError(404, 'Cliente no encontrado');
    }
    return result;
  },

  async deleteCliente(id) {
    const cliente = await clientesModel.findById(id);
    if (!cliente) {
      throw new HttpError(404, 'Cliente no encontrado');
    }
    const result = await clientesModel.deleteCliente(id);
    if (result.error) {
      throw new HttpError(409, result.error);
    }
    return result;
  },
};

module.exports = clientesService;