const pool = require('../../config/db');

const reportesModel = {
  async ventasDiarias(fecha, ciudad = null, departamento = null) {
    const { rows } = await pool.query(
      `SELECT rs.nombre as servicio,
              COUNT(DISTINCT r.id) as cantidad,
              SUM(c.monto * (rs.precio / NULLIF(t.total, 0))) as total
       FROM cobro c
       JOIN reserva r ON c.reserva_id = r.id
       JOIN ubicacion u ON u.id = r.ubicacion_id
       JOIN reserva_servicio rs ON rs.reserva_id = r.id
       JOIN LATERAL (
         SELECT SUM(precio) as total FROM reserva_servicio WHERE reserva_id = r.id
       ) t ON true
       WHERE (c.cobrado_en AT TIME ZONE 'America/Bogota')::date = $1
         AND ($2::text IS NULL OR u.ciudad = $2)
         AND ($3::text IS NULL OR u.departamento = $3)
       GROUP BY rs.nombre
       ORDER BY total DESC`,
      [fecha, ciudad, departamento]
    );
    return rows;
  },

  async totalDia(fecha, ciudad = null, departamento = null) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(c.monto), 0) as total
       FROM cobro c
       JOIN reserva r ON c.reserva_id = r.id
       JOIN ubicacion u ON u.id = r.ubicacion_id
       WHERE (c.cobrado_en AT TIME ZONE 'America/Bogota')::date = $1
         AND ($2::text IS NULL OR u.ciudad = $2)
         AND ($3::text IS NULL OR u.departamento = $3)`,
      [fecha, ciudad, departamento]
    );
    return parseFloat(rows[0].total);
  },

  async ocupacion(fecha, ciudad = null, departamento = null) {
    const { rows } = await pool.query(
      `WITH cap AS (
         SELECT ed.ubicacion_id,
                SUM(EXTRACT(EPOCH FROM (ed.hora_fin - ed.hora_inicio)) / 1800) AS slots
         FROM empleado_disponibilidad ed
         JOIN ubicacion u ON u.id = ed.ubicacion_id
         WHERE ed.dia_semana = EXTRACT(ISODOW FROM $1::date)
           AND ($2::text IS NULL OR u.ciudad = $2)
           AND ($3::text IS NULL OR u.departamento = $3)
         GROUP BY ed.ubicacion_id
       ),
       occ AS (
         SELECT r.ubicacion_id,
                SUM(EXTRACT(EPOCH FROM (r.termina_en - r.inicia_en)) / 1800) AS slots_ocupados
         FROM reserva r
          WHERE (r.inicia_en AT TIME ZONE 'America/Bogota')::date = $1
            AND r.estado <> 'cancelada'
          GROUP BY r.ubicacion_id
       )
       SELECT
         u.nombre as sede,
         u.ciudad,
         u.departamento,
         COUNT(r.id) as total,
         COUNT(CASE WHEN r.estado = 'cobrado' THEN 1 END) as completadas,
         COUNT(CASE WHEN r.estado = 'cancelada' THEN 1 END) as canceladas,
         COUNT(CASE WHEN r.estado = 'cancelada' AND r.motivo_cancelacion = 'no-show' THEN 1 END) as no_show,
         CASE WHEN COALESCE(cap.slots, 0) > 0
              THEN ROUND(LEAST(100, COALESCE(occ.slots_ocupados, 0) / cap.slots * 100)::numeric, 1)
              ELSE 0 END as porcentaje
       FROM reserva r
       JOIN ubicacion u ON r.ubicacion_id = u.id
       LEFT JOIN cap ON cap.ubicacion_id = r.ubicacion_id
       LEFT JOIN occ ON occ.ubicacion_id = r.ubicacion_id
       WHERE (r.inicia_en AT TIME ZONE 'America/Bogota')::date = $1
         AND ($2::text IS NULL OR u.ciudad = $2)
         AND ($3::text IS NULL OR u.departamento = $3)
       GROUP BY u.nombre, u.ciudad, u.departamento, cap.slots, occ.slots_ocupados
       ORDER BY u.nombre`,
      [fecha, ciudad, departamento]
    );
    return rows;
  },

  async clientesRecurrentes() {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, COUNT(r.id) as total_reservas
       FROM app_user u
       JOIN reserva r ON u.id = r.cliente_id
       WHERE u.rol = 'cliente'
       GROUP BY u.id, u.nombre, u.apellido, u.email
       ORDER BY total_reservas DESC
       LIMIT 20`
    );
    return rows;
  },
};

module.exports = reportesModel;
