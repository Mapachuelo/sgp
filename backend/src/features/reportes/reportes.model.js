const pool = require('../../config/db');

const reportesModel = {
  async ventasDiarias(fecha) {
    const { rows } = await pool.query(
      `SELECT s.nombre as servicio, COUNT(*) as cantidad, SUM(c.monto) as total
       FROM cobro c
       JOIN reserva r ON c.reserva_id = r.id
       JOIN servicio_catalogo s ON r.servicio_id = s.id
       WHERE (c.cobrado_en AT TIME ZONE 'America/Bogota')::date = $1
       GROUP BY s.nombre
       ORDER BY total DESC`,
      [fecha]
    );
    return rows;
  },

  async totalDia(fecha) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) as total FROM cobro WHERE (cobrado_en AT TIME ZONE 'America/Bogota')::date = $1`,
      [fecha]
    );
    return parseFloat(rows[0].total);
  },

  async ocupacion(fecha) {
    const { rows } = await pool.query(
      `WITH cap AS (
         SELECT ed.ubicacion_id,
                SUM(EXTRACT(EPOCH FROM (ed.hora_fin - ed.hora_inicio)) / 1800) AS slots
         FROM empleado_disponibilidad ed
         WHERE ed.dia_semana = EXTRACT(ISODOW FROM $1::date)
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
       GROUP BY u.nombre, cap.slots, occ.slots_ocupados
       ORDER BY u.nombre`,
      [fecha]
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
