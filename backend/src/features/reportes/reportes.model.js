const pool = require('../../config/db');

const reportesModel = {
  async ventasDiarias(fecha) {
    const { rows } = await pool.query(
      `SELECT s.nombre as servicio, COUNT(*) as cantidad, SUM(c.monto) as total
       FROM cobro c
       JOIN reserva r ON c.reserva_id = r.id
       JOIN servicio_catalogo s ON r.servicio_id = s.id
       WHERE c.cobrado_en::date = $1
       GROUP BY s.nombre
       ORDER BY total DESC`,
      [fecha]
    );
    return rows;
  },

  async totalDia(fecha) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) as total FROM cobro WHERE cobrado_en::date = $1`,
      [fecha]
    );
    return parseFloat(rows[0].total);
  },

  async ocupacion(fecha) {
    const { rows } = await pool.query(
      `SELECT
         u.nombre as sede,
         COUNT(r.id) as total_citas,
         COUNT(CASE WHEN r.estado = 'cobrado' THEN 1 END) as completadas,
         COUNT(CASE WHEN r.estado = 'cancelada' THEN 1 END) as canceladas,
         COUNT(CASE WHEN r.estado = 'cancelada' AND r.motivo_cancelacion = 'no-show' THEN 1 END) as no_show
       FROM reserva r
       JOIN ubicacion u ON r.ubicacion_id = u.id
       WHERE r.inicia_en::date = $1
       GROUP BY u.nombre
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
