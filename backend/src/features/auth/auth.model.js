const pool = require('../../config/db');

const authModel = {
  async findByEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM app_user WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, email, rol, nombre, apellido, telefono, esta_bloqueado, verificado, creado_en, actualizado_en FROM app_user WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async create({ email, password_hash, rol, nombre, apellido, telefono, verificado = false }) {
    const tel = telefono && telefono.trim() ? telefono.trim() : null;
    const { rows } = await pool.query(
      `INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono, verificado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, rol, nombre, apellido, telefono, esta_bloqueado, verificado, creado_en, actualizado_en`,
      [email, password_hash, rol, nombre, apellido, tel, verificado]
    );
    return rows[0];
  },

  async saveVerificationToken(id, tokenHash, expiracion) {
    await pool.query(
      `UPDATE app_user SET token_verificacion = $2, token_verificacion_expiracion = $3
       WHERE id = $1`,
      [id, tokenHash, expiracion]
    );
  },

  async findVerificationData(id) {
    const { rows } = await pool.query(
      `SELECT id, verificado, token_verificacion, token_verificacion_expiracion
       FROM app_user WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async markVerified(id) {
    const { rows } = await pool.query(
      `UPDATE app_user SET verificado = TRUE, token_verificacion = NULL, token_verificacion_expiracion = NULL
       WHERE id = $1
       RETURNING id, email, rol, nombre, apellido, telefono, verificado`,
      [id]
    );
    return rows[0] || null;
  },

  async createEmpleadoPerfil(usuario_id, data) {
    const { identificacion, password_asignada_hash, ubicacion_base_id } = data;
    const { rows } = await pool.query(
      `INSERT INTO empleado_perfil (usuario_id, identificacion, password_asignada_hash, ubicacion_base_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id) DO UPDATE
       SET identificacion = EXCLUDED.identificacion,
           password_asignada_hash = EXCLUDED.password_asignada_hash,
           ubicacion_base_id = EXCLUDED.ubicacion_base_id
       RETURNING *`,
      [usuario_id, identificacion, password_asignada_hash, ubicacion_base_id]
    );
    return rows[0];
  },

  async findAllEmpleados() {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.rol, u.nombre, u.apellido, u.telefono, u.esta_bloqueado,
              ep.identificacion, ep.ubicacion_base_id, u.creado_en
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON u.id = ep.usuario_id
       WHERE u.rol = 'empleado'
       ORDER BY u.creado_en DESC`
    );
    return rows;
  },

  async findEmpleadoById(id) {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.rol, u.nombre, u.apellido, u.telefono, u.esta_bloqueado,
              ep.identificacion, ep.ubicacion_base_id
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON u.id = ep.usuario_id
       WHERE u.id = $1 AND u.rol = 'empleado'`,
      [id]
    );
    return rows[0] || null;
  },

  async updateEmpleado(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }
    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.apellido !== undefined) { fields.push(`apellido = $${idx++}`); values.push(data.apellido); }
    if (data.telefono !== undefined) { fields.push(`telefono = $${idx++}`); values.push(data.telefono); }
    if (data.password_hash !== undefined) { fields.push(`password_hash = $${idx++}`); values.push(data.password_hash); }

    if (fields.length > 0) {
      fields.push(`actualizado_en = NOW()`);
      values.push(id);
      await pool.query(
        `UPDATE app_user SET ${fields.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    if (data.identificacion !== undefined || data.ubicacion_base_id !== undefined) {
      await pool.query(
        `INSERT INTO empleado_perfil (usuario_id, identificacion, ubicacion_base_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (usuario_id) DO UPDATE
         SET identificacion = COALESCE(EXCLUDED.identificacion, empleado_perfil.identificacion),
             ubicacion_base_id = COALESCE(EXCLUDED.ubicacion_base_id, empleado_perfil.ubicacion_base_id)`,
        [id, data.identificacion || null, data.ubicacion_base_id || null]
      );
    }

    return authModel.findEmpleadoById(id);
  },

  async deleteEmpleado(id) {
    const { rows } = await pool.query(
      'DELETE FROM app_user WHERE id = $1 AND rol = $2 RETURNING id',
      [id, 'empleado']
    );
    return rows[0] || null;
  },

  async hasCobros(empleado_id) {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM cobro WHERE registrado_por = $1',
      [empleado_id]
    );
    return parseInt(rows[0].count, 10) > 0;
  },

  async ensurePreferencias(usuario_id) {
    await pool.query(
      `INSERT INTO preferencia_usuario (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING`,
      [usuario_id]
    );
  },
};

module.exports = authModel;
