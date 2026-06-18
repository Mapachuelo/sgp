const pool = require('../../config/db');

const preferenciasModel = {
  async findByUsuarioId(usuario_id) {
    const { rows } = await pool.query(
      'SELECT * FROM preferencia_usuario WHERE usuario_id = $1',
      [usuario_id]
    );
    return rows[0] || null;
  },

  async upsert(usuario_id, data) {
    const existente = await preferenciasModel.findByUsuarioId(usuario_id);
    if (!existente) {
      await pool.query(
        'INSERT INTO preferencia_usuario (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [usuario_id]
      );
    }

    const { rango_hora_desde, rango_hora_hasta, granularidad_calendario, tema } = data;
    const fields = [];
    const values = [];
    let idx = 1;

    if (rango_hora_desde !== undefined) { fields.push(`rango_hora_desde = $${idx++}`); values.push(rango_hora_desde); }
    if (rango_hora_hasta !== undefined) { fields.push(`rango_hora_hasta = $${idx++}`); values.push(rango_hora_hasta); }
    if (granularidad_calendario !== undefined) { fields.push(`granularidad_calendario = $${idx++}`); values.push(granularidad_calendario); }
    if (tema !== undefined) { fields.push(`tema = $${idx++}`); values.push(tema); }

    if (fields.length > 0) {
      values.push(usuario_id);
      await pool.query(
        `UPDATE preferencia_usuario SET ${fields.join(', ')} WHERE usuario_id = $${idx}`,
        values
      );
    }

    return preferenciasModel.findByUsuarioId(usuario_id);
  },
};

module.exports = preferenciasModel;
