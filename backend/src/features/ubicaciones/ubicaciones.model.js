const pool = require('../../config/db');

const ubicacionesModel = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM ubicacion ORDER BY nombre');
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM ubicacion WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async create({ nombre, direccion, latitud, longitud }) {
    const { rows } = await pool.query(
      `INSERT INTO ubicacion (nombre, direccion, latitud, longitud)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, direccion, latitud, longitud]
    );
    return rows[0];
  },

  async update(id, { nombre, direccion, latitud, longitud }) {
    const { rows } = await pool.query(
      `UPDATE ubicacion SET nombre = COALESCE($2, nombre), direccion = COALESCE($3, direccion),
       latitud = COALESCE($4, latitud), longitud = COALESCE($5, longitud)
       WHERE id = $1 RETURNING *`,
      [id, nombre, direccion, latitud, longitud]
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rows } = await pool.query('DELETE FROM ubicacion WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  },
};

module.exports = ubicacionesModel;
