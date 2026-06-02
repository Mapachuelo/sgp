const ubicacionesModel = require('./ubicaciones.model');
const HttpError = require('../../shared/http-error');

const ubicacionesService = {
  async findAll() {
    return ubicacionesModel.findAll();
  },

  async create(data) {
    if (!data.nombre || !data.direccion || data.latitud == null || data.longitud == null) {
      throw new HttpError(400, 'Todos los campos son requeridos: nombre, direccion, latitud, longitud');
    }
    return ubicacionesModel.create(data);
  },

  async update(id, data) {
    const ubicacion = await ubicacionesModel.findById(id);
    if (!ubicacion) {
      throw new HttpError(404, 'Ubicacion no encontrada');
    }
    return ubicacionesModel.update(id, data);
  },

  async delete(id) {
    const ubicacion = await ubicacionesModel.findById(id);
    if (!ubicacion) {
      throw new HttpError(404, 'Ubicacion no encontrada');
    }
    return ubicacionesModel.delete(id);
  },
};

module.exports = ubicacionesService;
