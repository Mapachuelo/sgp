const { db } = require("../../config/db");

async function findReservationByQrToken(qrToken) {
  const result = await db.query(
    `
      SELECT id, client_id, service_name, stylist_name, starts_at, client_count, qr_token, status, checked_in_at, created_at
      FROM reservation
      WHERE qr_token = $1
      LIMIT 1
    `,
    [qrToken]
  );

  return result.rows[0] || null;
}

async function markReservationCheckin(reservationId) {
  const result = await db.query(
    `
      UPDATE reservation
      SET checked_in_at = NOW(),
          status = 'checked_in'
      WHERE id = $1
      RETURNING id, client_id, service_name, stylist_name, starts_at, client_count, qr_token, status, checked_in_at, created_at
    `,
    [reservationId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findReservationByQrToken,
  markReservationCheckin
};
