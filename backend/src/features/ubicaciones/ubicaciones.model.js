const pool = require('../../config/db');

const ubicacionesModel = {
  async findAll({ departamento, ciudad } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM ubicacion
       WHERE ($1::text IS NULL OR departamento = $1)
         AND ($2::text IS NULL OR ciudad = $2)
       ORDER BY departamento, ciudad, nombre`,
      [departamento || null, ciudad || null]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM ubicacion WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async create({ nombre, direccion, departamento, ciudad, latitud, longitud }) {
    const { rows } = await pool.query(
      `INSERT INTO ubicacion (nombre, direccion, departamento, ciudad, latitud, longitud)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, direccion, departamento, ciudad, latitud, longitud]
    );
    return rows[0];
  },

  async update(id, { nombre, direccion, departamento, ciudad, latitud, longitud }) {
    const { rows } = await pool.query(
      `UPDATE ubicacion SET
         nombre = COALESCE($2, nombre),
         direccion = COALESCE($3, direccion),
         departamento = COALESCE($4, departamento),
         ciudad = COALESCE($5, ciudad),
         latitud = COALESCE($6, latitud),
         longitud = COALESCE($7, longitud)
       WHERE id = $1 RETURNING *`,
      [id, nombre, direccion, departamento, ciudad, latitud, longitud]
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rows } = await pool.query('DELETE FROM ubicacion WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  },
};

module.exports = ubicacionesModel;
