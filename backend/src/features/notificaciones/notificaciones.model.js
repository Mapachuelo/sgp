const pool = require('../../config/db');

const notificacionesModel = {
  async create({ usuario_id, reserva_id = null, tipo = 'reserva', titulo, mensaje, metadata = {} }, db = pool) {
    const { rows } = await db.query(
      `INSERT INTO notificacion (usuario_id, reserva_id, tipo, titulo, mensaje, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      [usuario_id, reserva_id, tipo, titulo, mensaje, JSON.stringify(metadata || {})]
    );
    return rows[0] || null;
  },

  async findByUsuario(usuario_id, { soloNoLeidas = false, limit = 100, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT id, usuario_id, reserva_id, tipo, titulo, mensaje, metadata,
              leida_en, creado_en
       FROM notificacion
       WHERE usuario_id = $1
         AND ($2::boolean IS FALSE OR leida_en IS NULL)
       ORDER BY creado_en DESC, id DESC
       LIMIT $3 OFFSET $4`,
      [usuario_id, Boolean(soloNoLeidas), limit, offset]
    );
    return rows;
  },

  async contarNoLeidas(usuario_id) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM notificacion
       WHERE usuario_id = $1 AND leida_en IS NULL`,
      [usuario_id]
    );
    return Number(rows[0]?.total || 0);
  },

  async marcarLeida(id, usuario_id) {
    const { rows } = await pool.query(
      `UPDATE notificacion
       SET leida_en = COALESCE(leida_en, NOW())
       WHERE id = $1 AND usuario_id = $2
       RETURNING *`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  async marcarTodas(usuario_id) {
    const { rowCount } = await pool.query(
      `UPDATE notificacion
       SET leida_en = NOW()
       WHERE usuario_id = $1 AND leida_en IS NULL`,
      [usuario_id]
    );
    return rowCount;
  },
};

module.exports = notificacionesModel;
