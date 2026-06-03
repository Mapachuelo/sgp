const pool = require('../../config/db');

const clientesModel = {
  async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, email, rol, nombre, apellido, telefono, esta_bloqueado, motivo_bloqueo, creado_en, actualizado_en FROM app_user WHERE id = $1 AND rol = $2',
      [id, 'cliente']
    );
    return rows[0] || null;
  },

  async findUserById(id) {
    const { rows } = await pool.query(
      'SELECT id, email, rol, nombre, apellido, telefono, esta_bloqueado, motivo_bloqueo, creado_en, actualizado_en FROM app_user WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.apellido !== undefined) { fields.push(`apellido = $${idx++}`); values.push(data.apellido); }
    if (data.telefono !== undefined) { fields.push(`telefono = $${idx++}`); values.push(data.telefono); }
    if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }

    if (fields.length === 0) return clientesModel.findById(id);

    fields.push(`actualizado_en = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE app_user SET ${fields.join(', ')} WHERE id = $${idx} AND rol = 'cliente'`,
      values
    );

    return clientesModel.findById(id);
  },

  async updateUser(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.apellido !== undefined) { fields.push(`apellido = $${idx++}`); values.push(data.apellido); }
    if (data.telefono !== undefined) { fields.push(`telefono = $${idx++}`); values.push(data.telefono); }
    if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }

    if (fields.length === 0) return clientesModel.findUserById(id);

    fields.push(`actualizado_en = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE app_user SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    return clientesModel.findUserById(id);
  },

  async delete(id) {
    const { rows } = await pool.query(
      "DELETE FROM app_user WHERE id = $1 AND rol = 'cliente' RETURNING id",
      [id]
    );
    return rows[0] || null;
  },

  async findAll() {
    const { rows } = await pool.query(
      `SELECT id, email, rol, nombre, apellido, telefono, esta_bloqueado, motivo_bloqueo, creado_en, actualizado_en
       FROM app_user WHERE rol = 'cliente'
       ORDER BY creado_en DESC`
    );
    return rows;
  },

  async bloquear(id, motivo, bloqueado_por) {
    const { rows } = await pool.query(
      `UPDATE app_user SET esta_bloqueado = TRUE, motivo_bloqueo = $2, bloqueado_por = $3, bloqueado_en = NOW(), actualizado_en = NOW()
       WHERE id = $1 AND rol = 'cliente'
       RETURNING id, email, nombre, apellido, esta_bloqueado, motivo_bloqueo`,
      [id, motivo, bloqueado_por]
    );
    return rows[0] || null;
  },

  async desbloquear(id) {
    const { rows } = await pool.query(
      `UPDATE app_user SET esta_bloqueado = FALSE, motivo_bloqueo = NULL, bloqueado_por = NULL, bloqueado_en = NULL, actualizado_en = NOW()
       WHERE id = $1 AND rol = 'cliente'
       RETURNING id, email, nombre, apellido, esta_bloqueado`,
      [id]
    );
    return rows[0] || null;
  },

  async contarNoShows(cliente_id) {
    const { rows } = await pool.query(
      "SELECT COUNT(*) as count FROM reserva WHERE cliente_id = $1 AND estado = 'cancelada' AND motivo_cancelacion = 'no-show'",
      [cliente_id]
    );
    return parseInt(rows[0].count, 10);
  },

  async deleteCliente(cliente_id) {
    const noShows = await clientesModel.contarNoShows(cliente_id);
    if (noShows < 3) {
      return { error: 'El cliente no tiene al menos 3 no-shows para ser eliminado', noShows };
    }
    await pool.query("DELETE FROM app_user WHERE id = $1 AND rol = 'cliente'", [cliente_id]);
    return { eliminado: true, noShows };
  },
};

module.exports = clientesModel;
