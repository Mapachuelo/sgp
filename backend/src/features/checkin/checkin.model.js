const pool = require('../../config/db');

const checkinModel = {
  async findReservaByQrToken(qr_token) {
    const { rows } = await pool.query(
      'SELECT * FROM reserva WHERE qr_token = $1::uuid',
      [qr_token]
    );
    return rows[0] || null;
  },

  async registrarCobro(reserva_id, monto, metodo, registrado_por) {
    const { rows } = await pool.query(
      `INSERT INTO cobro (reserva_id, monto, metodo, registrado_por)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reserva_id) DO NOTHING
       RETURNING *`,
      [reserva_id, monto, metodo, registrado_por]
    );
    return rows[0] || null;
  },

  async updateReservaEstado(reserva_id, estado) {
    const { rows } = await pool.query(
      'UPDATE reserva SET estado = $2 WHERE id = $1 RETURNING *',
      [reserva_id, estado]
    );
    return rows[0] || null;
  },
};

module.exports = checkinModel;
