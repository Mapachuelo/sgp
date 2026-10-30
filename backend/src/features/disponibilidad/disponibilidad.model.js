const pool = require('../../config/db');
const { esFestivo } = require('../../shared/festivos-colombia');

const disponibilidadModel = {
  async findDisponibilidadByEmpleado(empleado_id) {
    const { rows } = await pool.query(
      `SELECT ed.*, u.nombre as ubicacion_nombre
       FROM empleado_disponibilidad ed
       JOIN ubicacion u ON ed.ubicacion_id = u.id
       WHERE ed.empleado_id = $1
       ORDER BY ed.dia_semana, ed.hora_inicio`,
      [empleado_id]
    );
    return rows;
  },

  async findAllDisponibilidad() {
    const { rows } = await pool.query(
      `SELECT ed.*, u.nombre as ubicacion_nombre,
              emp.nombre as empleado_nombre, emp.apellido as empleado_apellido
       FROM empleado_disponibilidad ed
       JOIN ubicacion u ON ed.ubicacion_id = u.id
       JOIN app_user emp ON ed.empleado_id = emp.id
       WHERE emp.rol = 'empleado'
       ORDER BY emp.nombre, emp.apellido, ed.dia_semana, ed.hora_inicio`
    );
    return rows;
  },

  async deleteDisponibilidadEmpleado(empleado_id) {
    await pool.query('DELETE FROM empleado_disponibilidad WHERE empleado_id = $1', [empleado_id]);
  },

  async insertDisponibilidad(empleado_id, items) {
    for (const item of items) {
      await pool.query(
        `INSERT INTO empleado_disponibilidad
           (empleado_id, ubicacion_id, dia_semana, hora_inicio, hora_fin, descansos, descanso)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         ON CONFLICT (empleado_id, ubicacion_id, dia_semana) DO UPDATE
         SET hora_inicio = EXCLUDED.hora_inicio, hora_fin = EXCLUDED.hora_fin,
             descansos = EXCLUDED.descansos, descanso = EXCLUDED.descanso`,
        [
          empleado_id,
          item.ubicacion_id,
          item.dia_semana,
          item.hora_inicio,
          item.hora_fin,
          JSON.stringify(Array.isArray(item.descansos) ? item.descansos : []),
          Boolean(item.descanso),
        ]
      );
    }
  },

  async updateDescansos(empleado_id, items) {
    const actualizados = [];
    for (const item of items) {
      const { rows } = await pool.query(
        `UPDATE empleado_disponibilidad
         SET descanso = $3, descansos = $4::jsonb
         WHERE empleado_id = $1 AND dia_semana = $2
         RETURNING *`,
        [
          empleado_id,
          item.dia_semana,
          Boolean(item.descanso),
          JSON.stringify(Array.isArray(item.descansos) ? item.descansos : []),
        ]
      );
      if (rows[0]) actualizados.push(rows[0]);
    }
    return actualizados;
  },

  async deleteDisponibilidadSedeDia(ubicacion_id, dia_semana) {
    await pool.query(
      'DELETE FROM empleado_disponibilidad WHERE ubicacion_id = $1 AND dia_semana = $2',
      [ubicacion_id, dia_semana]
    );
  },

  async findHorarioSemanal(empleado_id, dia_semana) {
    const { rows } = await pool.query(
      `SELECT ed.*, u.nombre as ubicacion_nombre
       FROM empleado_disponibilidad ed
       JOIN ubicacion u ON ed.ubicacion_id = u.id
       WHERE ed.empleado_id = $1 AND ed.dia_semana = $2
       ORDER BY ed.id
       LIMIT 1`,
      [empleado_id, dia_semana]
    );
    return rows[0] || null;
  },

  async findTemporalActivo(empleado_id, fecha) {
    const { rows } = await pool.query(
      `SELECT t.*, u.nombre AS ubicacion_nombre
       FROM empleado_sede_temporal t
       JOIN ubicacion u ON u.id = t.ubicacion_id
       WHERE t.empleado_id = $1
         AND $2::date BETWEEN t.desde AND t.hasta
         AND EXTRACT(ISODOW FROM $2::date)::int = ANY(t.dias_semana)
       ORDER BY t.creado_en DESC, t.id DESC
       LIMIT 1`,
      [empleado_id, fecha]
    );
    return rows[0] || null;
  },

  async findTemporalesByEmpleado(empleado_id) {
    const { rows } = await pool.query(
      `SELECT t.*, u.nombre AS ubicacion_nombre
       FROM empleado_sede_temporal t
       JOIN ubicacion u ON u.id = t.ubicacion_id
       WHERE t.empleado_id = $1
       ORDER BY t.desde DESC, t.id DESC`,
      [empleado_id]
    );
    return rows;
  },

  async findTodasTemporales() {
    const { rows } = await pool.query(
      `SELECT t.*, u.nombre AS ubicacion_nombre,
              emp.nombre AS empleado_nombre, emp.apellido AS empleado_apellido
       FROM empleado_sede_temporal t
       JOIN ubicacion u ON u.id = t.ubicacion_id
       JOIN app_user emp ON emp.id = t.empleado_id
       ORDER BY t.desde DESC, t.id DESC`
    );
    return rows;
  },

  async createTemporal({ empleado_id, ubicacion_id, desde, hasta, dias_semana, creado_por }) {
    const { rows } = await pool.query(
      `INSERT INTO empleado_sede_temporal
         (empleado_id, ubicacion_id, desde, hasta, dias_semana, creado_por)
       VALUES ($1, $2, $3, $4, $5::int[], $6)
       RETURNING *`,
      [empleado_id, ubicacion_id, desde, hasta, dias_semana, creado_por || null]
    );
    return rows[0];
  },

  async findTemporalById(id) {
    const { rows } = await pool.query(
      `SELECT t.*, u.nombre AS ubicacion_nombre
       FROM empleado_sede_temporal t
       JOIN ubicacion u ON u.id = t.ubicacion_id
       WHERE t.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async deleteTemporal(id, empleado_id = null) {
    const params = [id];
    let filtro = 'id = $1';
    if (empleado_id != null) {
      params.push(empleado_id);
      filtro += ' AND empleado_id = $2';
    }
    const { rows } = await pool.query(
      `DELETE FROM empleado_sede_temporal WHERE ${filtro} RETURNING *`,
      params
    );
    return rows[0] || null;
  },

  async updateSedeBaseSemanal(empleado_id, dias_semana, ubicacion_id) {
    if (!dias_semana.length) return;
    await pool.query(
      `UPDATE empleado_disponibilidad
       SET ubicacion_id = $3
       WHERE empleado_id = $1 AND dia_semana = ANY($2::int[])`,
      [empleado_id, dias_semana, ubicacion_id]
    );
    await pool.query(
      `UPDATE empleado_perfil SET ubicacion_base_id = $2 WHERE usuario_id = $1`,
      [empleado_id, ubicacion_id]
    );
  },

  async findFestivo(empleado_id, fecha) {
    const { rows } = await pool.query(
      `SELECT f.*, u.nombre AS ubicacion_nombre
       FROM empleado_festivo f
       JOIN ubicacion u ON u.id = f.ubicacion_id
       WHERE f.empleado_id = $1 AND f.fecha = $2`,
      [empleado_id, fecha]
    );
    return rows[0] || null;
  },

  async findFestivosByEmpleado(empleado_id, desde, hasta) {
    const { rows } = await pool.query(
      `SELECT f.*, u.nombre AS ubicacion_nombre
       FROM empleado_festivo f
       JOIN ubicacion u ON u.id = f.ubicacion_id
       WHERE f.empleado_id = $1 AND f.fecha BETWEEN $2 AND $3
       ORDER BY f.fecha`,
      [empleado_id, desde, hasta]
    );
    return rows;
  },

  async findFestivosPorFecha(fecha) {
    const { rows } = await pool.query(
      `SELECT f.*, u.nombre AS ubicacion_nombre,
              emp.nombre AS empleado_nombre, emp.apellido AS empleado_apellido
       FROM empleado_festivo f
       JOIN ubicacion u ON u.id = f.ubicacion_id
       JOIN app_user emp ON emp.id = f.empleado_id
       WHERE f.fecha = $1
       ORDER BY u.nombre, emp.nombre`,
      [fecha]
    );
    return rows;
  },

  async createFestivo({ empleado_id, ubicacion_id, fecha, hora_inicio, hora_fin, descansos }) {
    const { rows } = await pool.query(
      `INSERT INTO empleado_festivo
         (empleado_id, ubicacion_id, fecha, hora_inicio, hora_fin, descansos)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (empleado_id, fecha) DO UPDATE
       SET ubicacion_id = EXCLUDED.ubicacion_id,
           hora_inicio = EXCLUDED.hora_inicio,
           hora_fin = EXCLUDED.hora_fin,
           descansos = EXCLUDED.descansos
       RETURNING *`,
      [
        empleado_id,
        ubicacion_id,
        fecha,
        hora_inicio,
        hora_fin,
        JSON.stringify(Array.isArray(descansos) ? descansos : []),
      ]
    );
    return rows[0];
  },

  async deleteFestivo(empleado_id, fecha) {
    const { rows } = await pool.query(
      'DELETE FROM empleado_festivo WHERE empleado_id = $1 AND fecha = $2 RETURNING *',
      [empleado_id, fecha]
    );
    return rows[0] || null;
  },

  async findBloqueo(empleado_id, fecha) {
    const { rows } = await pool.query(
      'SELECT * FROM empleado_bloqueo_fecha WHERE empleado_id = $1 AND fecha = $2',
      [empleado_id, fecha]
    );
    return rows[0] || null;
  },

  async bloquearFecha(empleado_id, fecha, motivo) {
    const { rows } = await pool.query(
      `INSERT INTO empleado_bloqueo_fecha (empleado_id, fecha, motivo)
       VALUES ($1, $2, $3)
       ON CONFLICT (empleado_id, fecha) DO UPDATE SET motivo = EXCLUDED.motivo
       RETURNING *`,
      [empleado_id, fecha, motivo]
    );
    return rows[0];
  },

  async findBloqueos(desde, hasta, empleado_id = null) {
    const params = [desde, hasta];
    let filtro = '';
    if (empleado_id) {
      params.push(empleado_id);
      filtro = ' AND empleado_id = $3';
    }
    const { rows } = await pool.query(
      `SELECT b.*, u.nombre AS empleado_nombre, u.apellido AS empleado_apellido
       FROM empleado_bloqueo_fecha b
       JOIN app_user u ON u.id = b.empleado_id
       WHERE b.fecha BETWEEN $1::date AND $2::date${filtro}
       ORDER BY b.fecha, u.nombre`,
      params
    );
    return rows;
  },

  async findDisponibilidadEfectiva(empleado_id, ubicacion_id, fecha, dia_semana) {
    const bloqueo = await disponibilidadModel.findBloqueo(empleado_id, fecha);
    if (bloqueo) return null;
    if (esFestivo(fecha)) {
      const festivo = await disponibilidadModel.findFestivo(empleado_id, fecha);
      if (!festivo || Number(festivo.ubicacion_id) !== Number(ubicacion_id)) return null;
      return {
        ...festivo,
        hora_inicio: String(festivo.hora_inicio).slice(0, 5),
        hora_fin: String(festivo.hora_fin).slice(0, 5),
        descansos: Array.isArray(festivo.descansos) ? festivo.descansos : [],
        ubicacion_efectiva_id: festivo.ubicacion_id,
        es_festivo: true,
      };
    }

    const semanal = await disponibilidadModel.findHorarioSemanal(empleado_id, dia_semana);
    if (!semanal) return null;
    const temporal = await disponibilidadModel.findTemporalActivo(empleado_id, fecha);
    const sedeEfectiva = temporal?.ubicacion_id || semanal.ubicacion_id;
    if (Number(sedeEfectiva) !== Number(ubicacion_id)) return null;
    return {
      ...semanal,
      hora_inicio: String(semanal.hora_inicio).slice(0, 5),
      hora_fin: String(semanal.hora_fin).slice(0, 5),
      descansos: Array.isArray(semanal.descansos) ? semanal.descansos : [],
      ubicacion_efectiva_id: sedeEfectiva,
      es_temporal: Boolean(temporal),
    };
  },

  async findDisponibilidadEfectivaEmpleados(empleado_ids, ubicacion_id, fecha, dia_semana) {
    if (!empleado_ids.length) return [];
    if (esFestivo(fecha)) {
      const { rows } = await pool.query(
        `SELECT f.*, u.nombre AS ubicacion_nombre
         FROM empleado_festivo f
         JOIN ubicacion u ON u.id = f.ubicacion_id
         WHERE f.empleado_id = ANY($1::int[])
           AND f.fecha = $2
           AND f.ubicacion_id = $3
           AND NOT EXISTS (
             SELECT 1 FROM empleado_bloqueo_fecha b
             WHERE b.empleado_id = f.empleado_id AND b.fecha = f.fecha
           )`,
        [empleado_ids, fecha, ubicacion_id]
      );
      return rows.map((fila) => ({
        ...fila,
        hora_inicio: String(fila.hora_inicio).slice(0, 5),
        hora_fin: String(fila.hora_fin).slice(0, 5),
        descansos: Array.isArray(fila.descansos) ? fila.descansos : [],
        ubicacion_efectiva_id: fila.ubicacion_id,
        es_festivo: true,
      }));
    }

    const { rows } = await pool.query(
      `SELECT ed.*, u.nombre AS ubicacion_nombre,
              COALESCE(t.ubicacion_id, ed.ubicacion_id) AS ubicacion_efectiva_id,
              (t.id IS NOT NULL) AS es_temporal
       FROM empleado_disponibilidad ed
       JOIN ubicacion u ON u.id = ed.ubicacion_id
       LEFT JOIN LATERAL (
         SELECT t.id, t.ubicacion_id
         FROM empleado_sede_temporal t
         WHERE t.empleado_id = ed.empleado_id
           AND $2::date BETWEEN t.desde AND t.hasta
           AND EXTRACT(ISODOW FROM $2::date)::int = ANY(t.dias_semana)
         ORDER BY t.creado_en DESC, t.id DESC
         LIMIT 1
       ) t ON TRUE
       WHERE ed.empleado_id = ANY($1::int[])
         AND ed.dia_semana = $4
         AND COALESCE(t.ubicacion_id, ed.ubicacion_id) = $3`,
      [empleado_ids, fecha, ubicacion_id, dia_semana]
    );
    return rows.map((fila) => ({
      ...fila,
      hora_inicio: String(fila.hora_inicio).slice(0, 5),
      hora_fin: String(fila.hora_fin).slice(0, 5),
      descansos: Array.isArray(fila.descansos) ? fila.descansos : [],
    }));
  },
};

module.exports = disponibilidadModel;
