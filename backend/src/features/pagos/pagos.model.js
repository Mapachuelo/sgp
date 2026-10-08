const pool = require('../../config/db');

const pagosModel = {
  async findReservaParaPago(reservaId, db = pool) {
    const { rows } = await db.query(
      `SELECT r.*, s.precio_base, s.nombre AS servicio_nombre,
              cli.email AS cliente_email, cli.nombre AS cliente_nombre, cli.apellido AS cliente_apellido
       FROM reserva r
       JOIN servicio_catalogo s ON r.servicio_id = s.id
       JOIN app_user cli ON r.cliente_id = cli.id
       WHERE r.id = $1`,
      [reservaId]
    );
    return rows[0] || null;
  },

  async crearPago({ reserva_id, referencia, monto, moneda = 'COP', estado = 'pendiente' }, db = pool) {
    const { rows } = await db.query(
      `INSERT INTO pago (reserva_id, referencia, monto, moneda, estado)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reserva_id, referencia, monto, moneda, estado]
    );
    return rows[0];
  },

  async findById(id, db = pool) {
    const { rows } = await db.query(
      `SELECT p.*, r.estado AS reserva_estado, r.cliente_id
       FROM pago p
       JOIN reserva r ON p.reserva_id = r.id
       WHERE p.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByIdForUpdate(id, db = pool) {
    const { rows } = await db.query(
      `SELECT p.*, r.estado AS reserva_estado, r.cliente_id
       FROM pago p
       JOIN reserva r ON p.reserva_id = r.id
       WHERE p.id = $1
       FOR UPDATE OF p`,
      [id]
    );
    return rows[0] || null;
  },

  async findByReferencia(referencia, db = pool) {
    const { rows } = await db.query(
      `SELECT p.*, r.estado AS reserva_estado, r.cliente_id
       FROM pago p
       JOIN reserva r ON p.reserva_id = r.id
       WHERE p.referencia = $1`,
      [referencia]
    );
    return rows[0] || null;
  },

  async findAprobadoByReservaId(reserva_id, db = pool) {
    const { rows } = await db.query(
      "SELECT * FROM pago WHERE reserva_id = $1 AND estado = 'aprobado' ORDER BY creado_en DESC LIMIT 1",
      [reserva_id]
    );
    return rows[0] || null;
  },

  async actualizarPago(id, { estado, transaction_id, metodo, payload }, db = pool) {
    const { rows } = await db.query(
      `UPDATE pago
       SET estado = $2,
           transaction_id = COALESCE($3, transaction_id),
           metodo = COALESCE($4, metodo),
           payload = COALESCE($5, payload),
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, estado, transaction_id || null, metodo || null, payload || null]
    );
    return rows[0] || null;
  },

  async confirmarReservaSiPendiente(reserva_id, db = pool) {
    const { rows } = await db.query(
      "UPDATE reserva SET estado = 'confirmada' WHERE id = $1 AND estado = 'pendiente' RETURNING id",
      [reserva_id]
    );
    return rows[0] || null;
  },
};

module.exports = pagosModel;
