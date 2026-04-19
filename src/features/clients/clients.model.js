const { db } = require("../../config/db");

let clientModerationSchemaReadyPromise = null;

async function runClientModerationSchemaMigration(queryable = db) {
  await queryable.query(`
    ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await queryable.query(`
    ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS blocked_reason VARCHAR(255)
  `);

  await queryable.query(`
    ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS blocked_by INT REFERENCES app_user(id) ON DELETE SET NULL
  `);

  await queryable.query(`
    ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ
  `);

  await queryable.query(`
    CREATE INDEX IF NOT EXISTS idx_app_user_client_blocked
    ON app_user(role, is_blocked)
  `);
}

async function ensureClientModerationSchema(queryable = db) {
  if (queryable !== db) {
    await runClientModerationSchemaMigration(queryable);
    return;
  }

  if (!clientModerationSchemaReadyPromise) {
    clientModerationSchemaReadyPromise = runClientModerationSchemaMigration(db).catch((error) => {
      clientModerationSchemaReadyPromise = null;
      throw error;
    });
  }

  await clientModerationSchemaReadyPromise;
}

async function listClients() {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      SELECT id, name, email, phone, role, created_at, is_blocked, blocked_reason, blocked_at
      FROM app_user
      WHERE role = 'client'
      ORDER BY created_at DESC
    `
  );

  return result.rows;
}

async function findClientById(id) {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      SELECT id, name, email, phone, role, created_at, is_blocked, blocked_reason, blocked_at
      FROM app_user
      WHERE id = $1 AND role = 'client'
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findUserByEmail(email) {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      SELECT id, email
      FROM app_user
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function updateClient(id, { name, phone, email, passwordHash }) {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      UPDATE app_user
      SET name = $2,
          phone = $3,
          email = $4,
          password_hash = $5
      WHERE id = $1 AND role = 'client'
      RETURNING id, name, email, phone, role, created_at, is_blocked, blocked_reason, blocked_at
    `,
    [id, name, phone, email, passwordHash]
  );

  return result.rows[0] || null;
}

async function deleteClient(id) {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      DELETE FROM app_user
      WHERE id = $1 AND role = 'client'
      RETURNING id
    `,
    [id]
  );

  return result.rowCount > 0;
}

async function findClientModerationById(id) {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.created_at,
        u.is_blocked,
        u.blocked_reason,
        u.blocked_at,
        blocker.name AS blocked_by_name
      FROM app_user u
      LEFT JOIN app_user blocker ON blocker.id = u.blocked_by
      WHERE u.id = $1
        AND u.role = 'client'
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listClientsForModeration() {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.created_at,
        u.is_blocked,
        u.blocked_reason,
        u.blocked_at,
        blocker.name AS blocked_by_name,
        COUNT(CASE WHEN r.status = 'booked' THEN 1 END)::INT AS active_reservations,
        COUNT(CASE WHEN r.status = 'booked' AND r.starts_at < NOW() THEN 1 END)::INT AS no_show_reservations,
        MAX(r.starts_at) AS last_reservation_at
      FROM app_user u
      LEFT JOIN app_user blocker ON blocker.id = u.blocked_by
      LEFT JOIN reservation r ON r.client_id = u.id
      WHERE u.role = 'client'
      GROUP BY u.id, blocker.name
      ORDER BY u.is_blocked DESC, no_show_reservations DESC, u.created_at DESC
    `
  );

  return result.rows;
}

async function blockClientById(clientId, reason, actorUserId) {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      UPDATE app_user
      SET is_blocked = TRUE,
          blocked_reason = $2,
          blocked_by = $3,
          blocked_at = NOW()
      WHERE id = $1
        AND role = 'client'
      RETURNING id, name, email, phone, role, created_at, is_blocked, blocked_reason, blocked_at
    `,
    [clientId, reason, actorUserId]
  );

  return result.rows[0] || null;
}

async function unblockClientById(clientId) {
  await ensureClientModerationSchema();

  const result = await db.query(
    `
      UPDATE app_user
      SET is_blocked = FALSE,
          blocked_reason = NULL,
          blocked_by = NULL,
          blocked_at = NULL
      WHERE id = $1
        AND role = 'client'
      RETURNING id, name, email, phone, role, created_at, is_blocked, blocked_reason, blocked_at
    `,
    [clientId]
  );

  return result.rows[0] || null;
}

module.exports = {
  listClients,
  findClientById,
  findUserByEmail,
  updateClient,
  deleteClient,
  findClientModerationById,
  listClientsForModeration,
  blockClientById,
  unblockClientById
};
