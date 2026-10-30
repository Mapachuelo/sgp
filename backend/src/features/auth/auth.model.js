const pool = require('../../config/db');
const { cifrarTelefono, descifrarTelefono } = require('../../shared/utils/telefono');

function conTelefonoDescifrado(usuario) {
  if (!usuario) return usuario;
  return { ...usuario, telefono: descifrarTelefono(usuario.telefono) };
}

const authModel = {
  async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT u.*, ep.foto_url
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON ep.usuario_id = u.id
       WHERE u.email = $1`,
      [email]
    );
    return conTelefonoDescifrado(rows[0] || null);
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.rol, u.nombre, u.apellido, u.telefono, u.esta_bloqueado,
              u.verificado, u.creado_en, u.actualizado_en, ep.foto_url
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON ep.usuario_id = u.id
       WHERE u.id = $1`,
      [id]
    );
    return conTelefonoDescifrado(rows[0] || null);
  },

  async create({ email, password_hash, rol, nombre, apellido, telefono, verificado = false }) {
    const tel = telefono && telefono.trim() ? telefono.trim() : null;
    const { rows } = await pool.query(
      `INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono, verificado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, rol, nombre, apellido, esta_bloqueado, verificado, creado_en, actualizado_en`,
      [email, password_hash, rol, nombre, apellido, cifrarTelefono(tel), verificado]
    );
    return { ...rows[0], telefono: tel };
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
    return conTelefonoDescifrado(rows[0] || null);
  },

  async createEmpleadoPerfil(usuario_id, data) {
    const { identificacion, password_asignada_hash, ubicacion_base_id, comision_porcentaje, foto_url } = data;
    const { rows } = await pool.query(
      `INSERT INTO empleado_perfil
         (usuario_id, identificacion, password_asignada_hash, ubicacion_base_id, comision_porcentaje, foto_url)
       VALUES ($1, $2, $3, $4, COALESCE($5, 50), $6)
       ON CONFLICT (usuario_id) DO UPDATE
       SET identificacion = EXCLUDED.identificacion,
           password_asignada_hash = EXCLUDED.password_asignada_hash,
           ubicacion_base_id = EXCLUDED.ubicacion_base_id,
           comision_porcentaje = EXCLUDED.comision_porcentaje,
           foto_url = EXCLUDED.foto_url
       RETURNING *`,
      [usuario_id, identificacion, password_asignada_hash, ubicacion_base_id, comision_porcentaje ?? null, foto_url ?? null]
    );
    return rows[0];
  },

  async findAllUsuarios({ rol } = {}) {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.rol, u.nombre, u.apellido, u.telefono, u.esta_bloqueado,
              ep.identificacion, ep.ubicacion_base_id, ep.foto_url, ep.comision_porcentaje, u.creado_en
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON u.id = ep.usuario_id
       WHERE u.rol IN ('empleado', 'admin')
         AND ($1::text IS NULL OR u.rol = $1)
       ORDER BY u.rol DESC, u.creado_en DESC`,
      [rol || null]
    );
    return rows.map(conTelefonoDescifrado);
  },

  async findAllEmpleados() {
    return authModel.findAllUsuarios({ rol: 'empleado' });
  },

  async findUsuarioGestionado(id) {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.rol, u.nombre, u.apellido, u.telefono, u.esta_bloqueado,
              ep.identificacion, ep.ubicacion_base_id, ep.foto_url, ep.comision_porcentaje, u.creado_en
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON u.id = ep.usuario_id
       WHERE u.id = $1 AND u.rol IN ('empleado', 'admin')`,
      [id]
    );
    return conTelefonoDescifrado(rows[0] || null);
  },

  async findEmpleadoById(id) {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.rol, u.nombre, u.apellido, u.telefono, u.esta_bloqueado,
              ep.identificacion, ep.ubicacion_base_id, ep.foto_url, ep.comision_porcentaje
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON u.id = ep.usuario_id
       WHERE u.id = $1 AND u.rol = 'empleado'`,
      [id]
    );
    return conTelefonoDescifrado(rows[0] || null);
  },

  async updateEmpleado(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }
    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.apellido !== undefined) { fields.push(`apellido = $${idx++}`); values.push(data.apellido); }
    if (data.telefono !== undefined) { fields.push(`telefono = $${idx++}`); values.push(cifrarTelefono(data.telefono)); }
    if (data.password_hash !== undefined) { fields.push(`password_hash = $${idx++}`); values.push(data.password_hash); }

    if (fields.length > 0) {
      fields.push(`actualizado_en = NOW()`);
      values.push(id);
      await pool.query(
        `UPDATE app_user SET ${fields.join(', ')} WHERE id = $${idx} AND rol = 'empleado'`,
        values
      );
    }

    if (data.identificacion !== undefined || data.ubicacion_base_id !== undefined || data.foto_url !== undefined || data.comision_porcentaje !== undefined) {
      await pool.query(
        `INSERT INTO empleado_perfil
           (usuario_id, identificacion, ubicacion_base_id, foto_url, comision_porcentaje)
         VALUES ($1, $2, $3, $4, COALESCE($6, 50))
         ON CONFLICT (usuario_id) DO UPDATE
         SET identificacion = COALESCE(EXCLUDED.identificacion, empleado_perfil.identificacion),
             ubicacion_base_id = COALESCE(EXCLUDED.ubicacion_base_id, empleado_perfil.ubicacion_base_id),
             foto_url = CASE WHEN $5::boolean THEN EXCLUDED.foto_url ELSE empleado_perfil.foto_url END,
             comision_porcentaje = CASE WHEN $7::boolean THEN EXCLUDED.comision_porcentaje ELSE empleado_perfil.comision_porcentaje END`,
        [
          id,
          data.identificacion || null,
          data.ubicacion_base_id || null,
          data.foto_url ?? null,
          data.foto_url !== undefined,
          data.comision_porcentaje ?? 50,
          data.comision_porcentaje !== undefined,
        ]
      );
    }

    return authModel.findEmpleadoById(id);
  },

  async updateUsuarioBase(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;
    if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }
    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.apellido !== undefined) { fields.push(`apellido = $${idx++}`); values.push(data.apellido); }
    if (data.telefono !== undefined) { fields.push(`telefono = $${idx++}`); values.push(cifrarTelefono(data.telefono)); }
    if (data.password_hash !== undefined) { fields.push(`password_hash = $${idx++}`); values.push(data.password_hash); }
    if (fields.length === 0) return authModel.findUsuarioGestionado(id);
    fields.push('actualizado_en = NOW()');
    values.push(id);
    await pool.query(
      `UPDATE app_user SET ${fields.join(', ')}
       WHERE id = $${idx} AND rol IN ('empleado', 'admin')`,
      values
    );
    return authModel.findUsuarioGestionado(id);
  },

  async deleteEmpleado(id) {
    const { rows } = await pool.query(
      'DELETE FROM app_user WHERE id = $1 AND rol = $2 RETURNING id',
      [id, 'empleado']
    );
    return rows[0] || null;
  },

  async deleteUsuarioGestionado(id) {
    const { rows } = await pool.query(
      "DELETE FROM app_user WHERE id = $1 AND rol IN ('empleado', 'admin') RETURNING id, rol",
      [id]
    );
    return rows[0] || null;
  },

  async countAdmins() {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS total FROM app_user WHERE rol = 'admin'"
    );
    return Number(rows[0]?.total || 0);
  },

  async hasCobros(empleado_id) {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM cobro WHERE registrado_por = $1',
      [empleado_id]
    );
    return parseInt(rows[0].count, 10) > 0;
  },

  async hasReservas(empleado_id) {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM reserva WHERE empleado_id = $1) +
         (SELECT COUNT(*) FROM reserva_servicio WHERE empleado_id = $1) AS count`,
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

  async deleteUsuario(id) {
    await pool.query('DELETE FROM cobro WHERE registrado_por = $1', [id]);
    const { rows } = await pool.query('DELETE FROM app_user WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  },

  async deleteNoVerificadosAntiguos(ttlMinutos) {
    await pool.query(
      `DELETE FROM cobro WHERE registrado_por IN (
         SELECT id FROM app_user
         WHERE rol = 'cliente' AND verificado = FALSE AND token_verificacion_expiracion < NOW()
       )`
    );
    const { rows } = await pool.query(
      `DELETE FROM app_user
       WHERE id IN (
         SELECT id FROM app_user
         WHERE rol = 'cliente'
           AND verificado = FALSE
           AND (
             token_verificacion_expiracion < NOW()
             OR (token_verificacion_expiracion IS NULL AND creado_en < NOW() - ($1 || ' minutes')::interval)
           )
       )
       RETURNING id`,
      [String(ttlMinutos)]
    );
    return rows.length;
  },
};

module.exports = authModel;
