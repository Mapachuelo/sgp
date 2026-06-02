const clientesModel = require('./clientes.model');
const HttpError = require('../../shared/http-error');

const clientesService = {
  async getMe(usuarioId) {
    const cliente = await clientesModel.findById(usuarioId);
    if (!cliente) {
      throw new HttpError(404, 'Cliente no encontrado');
    }
    return cliente;
  },

  async updateMe(usuarioId, data) {
    const cliente = await clientesModel.update(usuarioId, data);
    if (!cliente) {
      throw new HttpError(404, 'Cliente no encontrado');
    }
    return cliente;
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
