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

function validarTexto(valor, campo, maximo = 120) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new HttpError(400, `${campo} es requerido`);
  }
  const texto = valor.trim();
  if (texto.length > maximo) {
    throw new HttpError(400, `${campo} no puede superar ${maximo} caracteres`);
  }
  return texto;
}

const ubicacionesService = {
  async findAll(filtros = {}) {
    return ubicacionesModel.findAll(filtros);
  },

  async create(data) {
    if (!data.nombre || !data.direccion || data.latitud == null || data.longitud == null) {
      throw new HttpError(400, 'Todos los campos son requeridos: nombre, direccion, departamento, ciudad, latitud, longitud');
    }
    validarCoordenadas(data.latitud, data.longitud);
    return ubicacionesModel.create({
      nombre: String(data.nombre).trim(),
      direccion: String(data.direccion).trim(),
      departamento: validarTexto(data.departamento, 'departamento'),
      ciudad: validarTexto(data.ciudad, 'ciudad'),
      latitud: Number(data.latitud),
      longitud: Number(data.longitud),
    });
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
    const payload = { ...data };
    if (data.departamento !== undefined) payload.departamento = validarTexto(data.departamento, 'departamento');
    if (data.ciudad !== undefined) payload.ciudad = validarTexto(data.ciudad, 'ciudad');
    return ubicacionesModel.update(id, payload);
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
