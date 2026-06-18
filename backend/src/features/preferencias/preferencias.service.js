const preferenciasModel = require('./preferencias.model');

const preferenciasService = {
  async get(usuario_id) {
    let prefs = await preferenciasModel.findByUsuarioId(usuario_id);
    if (!prefs) {
      prefs = await preferenciasModel.upsert(usuario_id, {});
    }
    return prefs;
  },

  async update(usuario_id, data) {
    return preferenciasModel.upsert(usuario_id, data);
  },
};

module.exports = preferenciasService;
