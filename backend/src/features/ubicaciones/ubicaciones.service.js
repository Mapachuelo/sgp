const ubicacionesModel = require('./ubicaciones.model');
const HttpError = require('../../shared/http-error');

function validarCoordenadas(latitud, longitud) {
  const lat = Number(latitud);
  const lng = Number(longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpError(400, 'latitud y longitud deben ser valores numericos');
  }
  if (lat < -90 || lat > 90) {
    throw new HttpError(400, 'latitud debe estar entre -90 y 90');
  }
  if (lng < -180 || lng > 180) {
    throw new HttpError(400, 'longitud debe estar entre -180 y 180');
  }
}

const ubicacionesService = {
  async findAll() {
    return ubicacionesModel.findAll();
  },

  async create(data) {
    if (!data.nombre || !data.direccion || data.latitud == null || data.longitud == null) {
      throw new HttpError(400, 'Todos los campos son requeridos: nombre, direccion, latitud, longitud');
    }
    validarCoordenadas(data.latitud, data.longitud);
    return ubicacionesModel.create(data);
  },

  async update(id, data) {
    const ubicacion = await ubicacionesModel.findById(id);
    if (!ubicacion) {
      throw new HttpError(404, 'Ubicacion no encontrada');
    }
    if (data.latitud !== undefined || data.longitud !== undefined) {
      const latitud = data.latitud !== undefined ? data.latitud : ubicacion.latitud;
      const longitud = data.longitud !== undefined ? data.longitud : ubicacion.longitud;
      validarCoordenadas(latitud, longitud);
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