const { db } = require("../../config/db");

async function ensureWorkScheduleTable(queryable = db) {
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS work_schedule (
      work_date DATE PRIMARY KEY,
      off_day BOOLEAN NOT NULL DEFAULT FALSE,
      start_time TIME NOT NULL DEFAULT '06:00',
      end_time TIME NOT NULL DEFAULT '22:00',
      updated_by INT REFERENCES app_user(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

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

async function listWorkScheduleByRange(startDate, daysCount) {
  await ensureWorkScheduleTable();

  const result = await db.query(
    `
      SELECT
        work_date::TEXT AS work_date,
        off_day,
        TO_CHAR(start_time, 'HH24:MI') AS start_time,
        TO_CHAR(end_time, 'HH24:MI') AS end_time
      FROM work_schedule
      WHERE work_date >= $1::DATE
        AND work_date < ($1::DATE + ($2::INT * INTERVAL '1 day'))
      ORDER BY work_date ASC
    `,
    [startDate, daysCount]
  );

  return result.rows;
}

async function upsertWorkSchedule(entries, updatedBy) {
  await ensureWorkScheduleTable();

  return db.withTransaction(async (client) => {
    for (const entry of entries) {
      await client.query(
        `
          INSERT INTO work_schedule (work_date, off_day, start_time, end_time, updated_by, updated_at)
          VALUES ($1::DATE, $2, $3::TIME, $4::TIME, $5, NOW())
          ON CONFLICT (work_date)
          DO UPDATE SET
            off_day = EXCLUDED.off_day,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `,
        [entry.date, entry.offDay, entry.start, entry.end, updatedBy]
      );
    }
  });
}

async function deleteWorkScheduleByRange(startDate, daysCount) {
  await ensureWorkScheduleTable();

  await db.query(
    `
      DELETE FROM work_schedule
      WHERE work_date >= $1::DATE
        AND work_date < ($1::DATE + ($2::INT * INTERVAL '1 day'))
    `,
    [startDate, daysCount]
  );
}

module.exports = {
  createReservation,
  findOverlappingReservation,
  listReservationsByClient,
  listAllReservations,
  listReservedByDate,
  listWorkScheduleByRange,
  upsertWorkSchedule,
  deleteWorkScheduleByRange
};
