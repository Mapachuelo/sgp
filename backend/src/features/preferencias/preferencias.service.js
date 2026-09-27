const preferenciasModel = require('./preferencias.model');
const HttpError = require('../../shared/http-error');

const preferenciasService = {
  async get(usuario_id) {
    let prefs = await preferenciasModel.findByUsuarioId(usuario_id);
    if (!prefs) {
      prefs = await preferenciasModel.upsert(usuario_id, {});
    }
    return prefs;
  },

  async update(usuario_id, data) {
    if (data.idioma !== undefined && !['es', 'en'].includes(data.idioma)) {
      throw new HttpError(400, 'idioma debe ser "es" o "en"');
    }
    return preferenciasModel.upsert(usuario_id, data);
  },
};

module.exports = preferenciasService;
