const preferenciasModel = require('./preferencias.model');
const HttpError = require('../../shared/http-error');

function validarUbicacion(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string') {
    throw new HttpError(400, `${campo} debe ser texto`);
  }
  const texto = valor.trim();
  if (texto.length > 120) {
    throw new HttpError(400, `${campo} no puede superar 120 caracteres`);
  }
  return texto || null;
}

const preferenciasService = {
  async get(usuario_id) {
    let prefs = await preferenciasModel.findByUsuarioId(usuario_id);
    if (!prefs) {
      prefs = await preferenciasModel.upsert(usuario_id, {});
    }
    return prefs;
  },

  async update(usuario_id, data) {
    const payload = { ...data };
    if (data.departamento_preferido !== undefined) {
      payload.departamento_preferido = validarUbicacion(data.departamento_preferido, 'departamento_preferido');
    }
    if (data.ciudad_preferida !== undefined) {
      payload.ciudad_preferida = validarUbicacion(data.ciudad_preferida, 'ciudad_preferida');
    }
    return preferenciasModel.upsert(usuario_id, payload);
  },
};

module.exports = preferenciasService;
