const { db } = require("../../config/db");

async function createReservation(data) {
  const result = await db.query(
    `
      INSERT INTO reservation (
        client_id,
        service_name,
        stylist_name,
        starts_at,
        client_count,
        qr_token,
        qr_data_url,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'booked')
      RETURNING id, client_id, service_name, stylist_name, starts_at, client_count, qr_token, qr_data_url, status, created_at
    `,
    [
      data.clientId,
      data.serviceName,
      data.stylistName,
      data.startsAt,
      data.clientCount,
      data.qrToken,
      data.qrDataUrl
    ]
  );

  return result.rows[0];
}

async function findOverlappingReservation({ stylistName, startsAt }) {
  const result = await db.query(
    `
      SELECT id
      FROM reservation
      WHERE stylist_name = $1
        AND starts_at = $2
        AND status = 'booked'
      LIMIT 1
    `,
    [stylistName, startsAt]
  );

  return result.rows[0] || null;
}

async function listReservationsByClient(clientId) {
  const result = await db.query(
    `
      SELECT id, client_id, service_name, stylist_name, starts_at, client_count, qr_token, status, checked_in_at, created_at
      FROM reservation
      WHERE client_id = $1
      ORDER BY starts_at DESC
    `,
    [clientId]
  );

  return result.rows;
}

async function listAllReservations() {
  const result = await db.query(
    `
      SELECT id, client_id, service_name, stylist_name, starts_at, client_count, qr_token, status, checked_in_at, created_at
      FROM reservation
      ORDER BY starts_at DESC
    `
  );

  return result.rows;
}

async function listReservedByDate(dateText) {
  const result = await db.query(
    `
      SELECT id, stylist_name, starts_at, status
      FROM reservation
      WHERE DATE(starts_at) = $1
        AND status = 'booked'
      ORDER BY starts_at ASC
    `,
    [dateText]
  );

  return result.rows;
}

module.exports = {
  createReservation,
  findOverlappingReservation,
  listReservationsByClient,
  listAllReservations,
  listReservedByDate
};
