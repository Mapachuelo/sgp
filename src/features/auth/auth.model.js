const { db } = require("../../config/db");

async function ensureEmployeeProfileTable(queryable = db) {
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS employee_profile (
      user_id INT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
      last_name VARCHAR(120) NOT NULL,
      identification VARCHAR(80) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function findUserByEmail(email) {
  const result = await db.query(
    `
      SELECT id, name, email, phone, role, password_hash, created_at
      FROM app_user
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function findUserByPhone(phone) {
  const result = await db.query(
    `
      SELECT id, name, email, phone, role, created_at
      FROM app_user
      WHERE phone = $1
      LIMIT 1
    `,
    [phone]
  );

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await db.query(
    `
      SELECT id, name, email, phone, role, created_at
      FROM app_user
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createUser({ name, email, phone, role, passwordHash }) {
  const result = await db.query(
    `
      INSERT INTO app_user (name, email, phone, role, password_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, phone, role, created_at
    `,
    [name, email, phone, role, passwordHash]
  );

  return result.rows[0];
}

async function findEmployeeByIdentification(identification) {
  await ensureEmployeeProfileTable();

  const result = await db.query(
    `
      SELECT ep.user_id
      FROM employee_profile ep
      WHERE ep.identification = $1
      LIMIT 1
    `,
    [identification]
  );

  return result.rows[0] || null;
}

async function listEmployees() {
  await ensureEmployeeProfileTable();

  const result = await db.query(
    `
      SELECT
        u.id,
        u.name,
        ep.last_name,
        u.phone,
        ep.identification,
        u.email,
        u.role,
        u.created_at
      FROM app_user u
      LEFT JOIN employee_profile ep ON ep.user_id = u.id
      WHERE u.role = 'employee'
      ORDER BY u.created_at DESC
    `
  );

  return result.rows;
}

async function createEmployeeWithProfile({
  firstName,
  lastName,
  phone,
  identification,
  email,
  passwordHash
}) {
  return db.withTransaction(async (client) => {
    await ensureEmployeeProfileTable(client);

    const userResult = await client.query(
      `
        INSERT INTO app_user (name, email, phone, role, password_hash)
        VALUES ($1, $2, $3, 'employee', $4)
        RETURNING id, name, email, phone, role, created_at
      `,
      [firstName, email, phone, passwordHash]
    );

    const user = userResult.rows[0];

    await client.query(
      `
        INSERT INTO employee_profile (user_id, last_name, identification)
        VALUES ($1, $2, $3)
      `,
      [user.id, lastName, identification]
    );

    return {
      id: user.id,
      name: user.name,
      last_name: lastName,
      phone: user.phone,
      identification,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };
  });
}

async function countPaymentsByStylistId(stylistId) {
  const result = await db.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM payment
      WHERE stylist_id = $1
    `,
    [stylistId]
  );

  return result.rows[0] ? result.rows[0].total : 0;
}

async function deleteUserById(id) {
  const result = await db.query(
    `
      DELETE FROM app_user
      WHERE id = $1
      RETURNING id, name, email, phone, role, created_at
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserByEmail,
  findUserByPhone,
  findUserById,
  createUser,
  findEmployeeByIdentification,
  listEmployees,
  createEmployeeWithProfile,
  countPaymentsByStylistId,
  deleteUserById
};
