const pool = require('../../config/db');

const ubicacionesModel = {
  async findAll({ departamento, ciudad } = {}) {
    const { rows } = await pool.query(
      `SELECT u.*,
              (SELECT COUNT(*)::int FROM ubicacion_imagen ui WHERE ui.ubicacion_id = u.id) AS total_imagenes
       FROM ubicacion u
       WHERE ($1::text IS NULL OR u.departamento = $1)
         AND ($2::text IS NULL OR u.ciudad = $2)
       ORDER BY u.departamento, u.ciudad, u.nombre`,
      [departamento || null, ciudad || null]
    );
    return rows;
  },

  async findById(id, db = pool) {
    const { rows } = await db.query(
      `SELECT u.*,
              (SELECT COUNT(*)::int FROM ubicacion_imagen ui WHERE ui.ubicacion_id = u.id) AS total_imagenes
       FROM ubicacion u
       WHERE u.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findImagenes(ubicacion_id) {
    const { rows } = await pool.query(
      `SELECT id, imagen_url, orden
       FROM ubicacion_imagen
       WHERE ubicacion_id = $1
       ORDER BY orden, id`,
      [ubicacion_id]
    );
    return rows;
  },

  async replaceImagenes(ubicacion_id, imagenes, db = pool) {
    await db.query('DELETE FROM ubicacion_imagen WHERE ubicacion_id = $1', [ubicacion_id]);
    for (let indice = 0; indice < imagenes.length; indice += 1) {
      await db.query(
        `INSERT INTO ubicacion_imagen (ubicacion_id, imagen_url, orden)
         VALUES ($1, $2, $3)`,
        [ubicacion_id, imagenes[indice], indice + 1]
      );
    }
    await db.query(
      'UPDATE ubicacion SET imagen_url = $2 WHERE id = $1',
      [ubicacion_id, imagenes[0] || null]
    );
  },

  async create({ nombre, direccion, departamento, ciudad, latitud, longitud, imagen_url }, db = pool) {
    const { rows } = await db.query(
      `INSERT INTO ubicacion (nombre, direccion, departamento, ciudad, latitud, longitud, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre, direccion, departamento, ciudad, latitud, longitud, imagen_url ?? null]
    );
    return rows[0];
  },

  async update(id, { nombre, direccion, departamento, ciudad, latitud, longitud, imagen_url }, db = pool) {
    const { rows } = await db.query(
      `UPDATE ubicacion SET
         nombre = COALESCE($2, nombre),
         direccion = COALESCE($3, direccion),
         departamento = COALESCE($4, departamento),
         ciudad = COALESCE($5, ciudad),
         latitud = COALESCE($6, latitud),
         longitud = COALESCE($7, longitud),
         imagen_url = CASE WHEN $9::boolean THEN $8 ELSE imagen_url END
       WHERE id = $1 RETURNING *`,
      [id, nombre, direccion, departamento, ciudad, latitud, longitud, imagen_url ?? null, imagen_url !== undefined]
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rows } = await pool.query('DELETE FROM ubicacion WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  },
};

module.exports = ubicacionesModel;
