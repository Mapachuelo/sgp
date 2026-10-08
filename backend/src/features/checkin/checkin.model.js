const pool = require('../../config/db');

const checkinModel = {
  async findReservaByQrTokenForUpdate(qr_token, db = pool) {
    const { rows } = await db.query(
      `SELECT r.*, cli.nombre AS cliente_nombre, cli.apellido AS cliente_apellido,
              s.nombre AS servicio_nombre, s.precio_base
       FROM reserva r
       JOIN app_user cli ON r.cliente_id = cli.id
       JOIN servicio_catalogo s ON r.servicio_id = s.id
       WHERE r.qr_token = $1::uuid
       FOR UPDATE OF r`,
      [qr_token]
    );
    return rows[0] || null;
  },

  async findPagoAprobado(reserva_id, db = pool) {
    const { rows } = await db.query(
      "SELECT id, monto, metodo FROM pago WHERE reserva_id = $1 AND estado = 'aprobado' ORDER BY creado_en DESC LIMIT 1",
      [reserva_id]
    );
    return rows[0] || null;
  },

  async registrarCobro(reserva_id, monto, metodo, registrado_por, db = pool) {
    const { rows } = await db.query(
      `INSERT INTO cobro (reserva_id, monto, metodo, registrado_por)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reserva_id) DO NOTHING
       RETURNING *`,
      [reserva_id, monto, metodo, registrado_por]
    );
    return rows[0] || null;
  },

  async updateReservaEstado(reserva_id, estado, db = pool) {
    const { rows } = await db.query(
      'UPDATE reserva SET estado = $2 WHERE id = $1 RETURNING *',
      [reserva_id, estado]
    );
    return rows[0] || null;
  },
};

module.exports = checkinModel;
