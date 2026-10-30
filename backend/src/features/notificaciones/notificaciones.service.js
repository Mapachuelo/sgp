const notificacionesModel = require('./notificaciones.model');
const HttpError = require('../../shared/http-error');

const notificacionesService = {
  async listar(usuario_id, { solo_no_leidas, limit, offset } = {}) {
    const soloNoLeidas = solo_no_leidas === '1' || solo_no_leidas === true;
    const limite = Math.min(200, Math.max(1, Number(limit) || 100));
    const salto = Math.max(0, Number(offset) || 0);
    const [items, no_leidas] = await Promise.all([
      notificacionesModel.findByUsuario(usuario_id, { soloNoLeidas, limit: limite, offset: salto }),
      notificacionesModel.contarNoLeidas(usuario_id),
    ]);
    return { items, total: items.length, no_leidas };
  },

  async contador(usuario_id) {
    return { no_leidas: await notificacionesModel.contarNoLeidas(usuario_id) };
  },

  async marcarLeida(usuario_id, id) {
    const notificacionId = Number(id);
    if (!Number.isInteger(notificacionId) || notificacionId <= 0) {
      throw new HttpError(400, 'Notificacion no valida');
    }
    const notificacion = await notificacionesModel.marcarLeida(notificacionId, usuario_id);
    if (!notificacion) throw new HttpError(404, 'Notificacion no encontrada');
    return notificacion;
  },

  async marcarTodas(usuario_id) {
    const actualizadas = await notificacionesModel.marcarTodas(usuario_id);
    return { actualizadas };
  },
};

module.exports = notificacionesService;
