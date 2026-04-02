const { db } = require("../../config/db");

async function findReservationById(id) {
  const result = await db.query(
    `
      SELECT id, status, starts_at, client_id, stylist_name
      FROM reservation
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findPaymentByReservationId(reservationId) {
  const result = await db.query(
    `
      SELECT id, reservation_id, stylist_id, amount, payment_method, paid_at, created_at
      FROM payment
      WHERE reservation_id = $1
      LIMIT 1
    `,
    [reservationId]
  );

  return result.rows[0] || null;
}

async function createManualPayment({ reservationId, stylistId, amount }) {
  const result = await db.query(
    `
      INSERT INTO payment (reservation_id, stylist_id, amount, payment_method)
      VALUES ($1, $2, $3, 'manual_cash')
      RETURNING id, reservation_id, stylist_id, amount, payment_method, paid_at, created_at
    `,
    [reservationId, stylistId, amount]
  );

  return result.rows[0];
}

module.exports = {
  findReservationById,
  findPaymentByReservationId,
  createManualPayment
};
