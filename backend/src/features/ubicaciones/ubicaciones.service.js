const ubicacionesModel = require('./ubicaciones.model');
const { withTransaction } = require('../../config/db');
const HttpError = require('../../shared/http-error');

const MAX_IMAGENES_UBICACION = 6;

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

function normalizarImagen(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(valor)) {
    throw new HttpError(400, 'La imagen de la sede debe ser PNG, JPG o WebP');
  }
  if (valor.length > 900000) {
    throw new HttpError(400, 'La imagen de la sede es demasiado grande');
  }
  return valor;
}

function normalizarGaleria(data) {
  if (data.imagenes !== undefined) {
    if (!Array.isArray(data.imagenes)) {
      throw new HttpError(400, 'imagenes debe ser un arreglo');
    }
    if (data.imagenes.length > MAX_IMAGENES_UBICACION) {
      throw new HttpError(400, `Puedes subir hasta ${MAX_IMAGENES_UBICACION} imagenes por sede`);
    }
    return data.imagenes.map((imagen, indice) => {
      const normalizada = normalizarImagen(imagen);
      if (!normalizada) throw new HttpError(400, `imagenes[${indice}] no es valida`);
      return normalizada;
    });
  }
  if (data.imagen_url !== undefined) {
    const imagen = normalizarImagen(data.imagen_url);
    return imagen ? [imagen] : [];
  }
  return undefined;
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
    const galeria = normalizarGaleria(data) ?? [];
    const payload = {
      nombre: String(data.nombre).trim(),
      direccion: String(data.direccion).trim(),
      departamento: validarTexto(data.departamento, 'departamento'),
      ciudad: validarTexto(data.ciudad, 'ciudad'),
      latitud: Number(data.latitud),
      longitud: Number(data.longitud),
      imagen_url: galeria[0] || null,
    };
    return withTransaction(async (client) => {
      const sede = await ubicacionesModel.create(payload, client);
      if (galeria.length > 0) {
        await ubicacionesModel.replaceImagenes(sede.id, galeria, client);
      }
      return ubicacionesModel.findById(sede.id, client);
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
    const galeria = normalizarGaleria(data);
    const payload = { ...data };
    delete payload.imagenes;
    if (data.departamento !== undefined) payload.departamento = validarTexto(data.departamento, 'departamento');
    if (data.ciudad !== undefined) payload.ciudad = validarTexto(data.ciudad, 'ciudad');
    if (galeria !== undefined) payload.imagen_url = galeria[0] || null;

    if (galeria === undefined) {
      return ubicacionesModel.update(id, payload);
    }
    return withTransaction(async (client) => {
      const actualizada = await ubicacionesModel.update(id, payload, client);
      if (!actualizada) throw new HttpError(404, 'Ubicacion no encontrada');
      await ubicacionesModel.replaceImagenes(id, galeria, client);
      return ubicacionesModel.findById(id, client);
    });
  },

  async getImagenes(id) {
    const ubicacion = await ubicacionesModel.findById(Number(id));
    if (!ubicacion) throw new HttpError(404, 'Ubicacion no encontrada');
    return ubicacionesModel.findImagenes(Number(id));
  },

  async delete(id) {
    const eliminada = await ubicacionesModel.delete(id);
    if (!eliminada) {
      throw new HttpError(404, 'Ubicacion no encontrada');
    }
    return { eliminado: true };
  },
};

module.exports = ubicacionesService;
