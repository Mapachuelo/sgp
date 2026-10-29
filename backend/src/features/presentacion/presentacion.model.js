const pool = require('../../config/db-presentacion');

const CAMPOS_CONFIG = [
  'hero_etiqueta', 'hero_titulo', 'hero_subtitulo', 'hero_cta_principal', 'hero_cta_secundario',
  'seccion_cita_titulo', 'seccion_cita_texto', 'seccion_servicios_titulo', 'seccion_servicios_texto',
  'seccion_salon_titulo', 'seccion_salon_texto', 'seccion_sedes_titulo', 'seccion_sedes_texto',
  'cierre_titulo', 'cierre_texto', 'activo',
];

const presentacionModel = {
  async getConfig() {
    const { rows } = await pool.query('SELECT * FROM presentacion_config WHERE id = 1');
    return rows[0] || null;
  },

  async updateConfig(data) {
    const campos = [];
    const valores = [];
    let indice = 1;
    for (const campo of CAMPOS_CONFIG) {
      if (data[campo] !== undefined) {
        campos.push(`${campo} = $${indice++}`);
        valores.push(data[campo]);
      }
    }
    if (campos.length === 0) return presentacionModel.getConfig();
    campos.push('actualizado_en = NOW()');
    const { rows } = await pool.query(
      `UPDATE presentacion_config SET ${campos.join(', ')} WHERE id = 1 RETURNING *`,
      valores
    );
    return rows[0];
  },

  async findMedia({ soloActivos = false } = {}) {
    const { rows } = await pool.query(
      `SELECT m.*,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', f.id,
                    'archivo_url', f.archivo_url,
                    'mime_type', f.mime_type,
                    'codec', f.codec,
                    'orden', f.orden
                  ) ORDER BY f.orden, f.id
                ) FILTER (WHERE f.id IS NOT NULL),
                '[]'
              ) AS fuentes
       FROM presentacion_media m
       LEFT JOIN presentacion_fuente f ON f.media_id = m.id
       WHERE ($1::boolean IS FALSE OR m.activo = TRUE)
       GROUP BY m.id
       ORDER BY m.orden, m.id`,
      [Boolean(soloActivos)]
    );
    return rows;
  },

  async findMediaById(id) {
    const { rows } = await pool.query(
      `SELECT m.*,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', f.id,
                    'archivo_url', f.archivo_url,
                    'mime_type', f.mime_type,
                    'codec', f.codec,
                    'orden', f.orden
                  ) ORDER BY f.orden, f.id
                ) FILTER (WHERE f.id IS NOT NULL),
                '[]'
              ) AS fuentes
       FROM presentacion_media m
       LEFT JOIN presentacion_fuente f ON f.media_id = m.id
       WHERE m.id = $1
       GROUP BY m.id`,
      [id]
    );
    return rows[0] || null;
  },

  async createMedia({ tipo, titulo, descripcion, alt, poster_url, orden }) {
    const { rows } = await pool.query(
      `INSERT INTO presentacion_media (tipo, titulo, descripcion, alt, poster_url, orden)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(MAX(orden), 0) + 1 FROM presentacion_media)))
       RETURNING *`,
      [tipo, titulo || null, descripcion || null, alt || null, poster_url || null, orden || null]
    );
    return rows[0];
  },

  async updateMedia(id, data) {
    const campos = [];
    const valores = [];
    let indice = 1;
    for (const campo of ['titulo', 'descripcion', 'alt', 'poster_url', 'orden', 'activo']) {
      if (data[campo] !== undefined) {
        campos.push(`${campo} = $${indice++}`);
        valores.push(data[campo]);
      }
    }
    if (campos.length === 0) return presentacionModel.findMediaById(id);
    valores.push(id);
    const { rows } = await pool.query(
      `UPDATE presentacion_media SET ${campos.join(', ')} WHERE id = $${indice} RETURNING *`,
      valores
    );
    return rows[0] || null;
  },

  async deleteMedia(id) {
    const { rows } = await pool.query('DELETE FROM presentacion_media WHERE id = $1 RETURNING *', [id]);
    return rows[0] || null;
  },

  async addFuente(media_id, { archivo_url, mime_type, codec, orden }) {
    const { rows } = await pool.query(
      `INSERT INTO presentacion_fuente (media_id, archivo_url, mime_type, codec, orden)
       VALUES ($1, $2, $3, $4, COALESCE($5, (SELECT COALESCE(MAX(orden), 0) + 1 FROM presentacion_fuente WHERE media_id = $1)))
       RETURNING *`,
      [media_id, archivo_url, mime_type, codec || null, orden || null]
    );
    return rows[0];
  },

  async findFuentes(media_id) {
    const { rows } = await pool.query(
      'SELECT * FROM presentacion_fuente WHERE media_id = $1 ORDER BY orden, id',
      [media_id]
    );
    return rows;
  },

  async deleteFuente(id) {
    const { rows } = await pool.query('DELETE FROM presentacion_fuente WHERE id = $1 RETURNING *', [id]);
    return rows[0] || null;
  },

  async reorderMedia(items) {
    for (const item of items) {
      await pool.query('UPDATE presentacion_media SET orden = $2 WHERE id = $1', [item.id, item.orden]);
    }
    return presentacionModel.findMedia();
  },
};

module.exports = presentacionModel;
