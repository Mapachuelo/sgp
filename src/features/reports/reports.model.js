const { db } = require("../../config/db");

async function getDailySales(dateText) {
  const result = await db.query(
    `
      SELECT
        COALESCE(SUM(amount), 0)::numeric(12,2) AS total_amount,
        COUNT(*)::int AS payments_count
      FROM payment
      WHERE DATE(paid_at) = $1
    `,
    [dateText]
  );

  return result.rows[0];
}

async function getDailyOccupancy(dateText) {
  const result = await db.query(
    `
      SELECT
        COUNT(*)::int AS reservations_count,
        COUNT(*) FILTER (WHERE status = 'checked_in')::int AS checked_in_count,
        COUNT(*) FILTER (WHERE status = 'booked')::int AS booked_count
      FROM reservation
      WHERE DATE(starts_at) = $1
    `,
    [dateText]
  );

  return result.rows[0];
}

async function getRecurrentClients(limit = 10) {
  const result = await db.query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(r.id)::int AS reservations_count
      FROM app_user u
      JOIN reservation r ON r.client_id = u.id
      WHERE u.role = 'client'
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(r.id) > 1
      ORDER BY reservations_count DESC, u.name ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

module.exports = {
  getDailySales,
  getDailyOccupancy,
  getRecurrentClients
};
