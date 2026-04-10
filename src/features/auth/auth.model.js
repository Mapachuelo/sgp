const { db } = require("../../config/db");

let roleSchemaReadyPromise = null;

async function runRoleSchemaMigration(queryable = db) {
  await queryable.query(`
    ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS app_user_role_check
  `);

  await queryable.query(`
    ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS app_user_phone_co_check
  `);

  await queryable.query(`
    UPDATE app_user
    SET role = 'empleado'
    WHERE role = 'employee'
  `);

  await queryable.query(`
    ALTER TABLE app_user
    ADD CONSTRAINT app_user_role_check
    CHECK (role IN ('client', 'empleado', 'admin'))
  `);

  await queryable.query(`
    ALTER TABLE app_user
    ADD CONSTRAINT app_user_phone_co_check
    CHECK (phone ~ '^\\+57[0-9]{10}$') NOT VALID
  `);
}

async function ensureRoleSchema(queryable = db) {
  if (queryable !== db) {
    await runRoleSchemaMigration(queryable);
    return;
  }

  if (!roleSchemaReadyPromise) {
    roleSchemaReadyPromise = runRoleSchemaMigration(db).catch((error) => {
      roleSchemaReadyPromise = null;
      throw error;
    });
  }

  await roleSchemaReadyPromise;
}

async function ensureEmployeeProfileTable(queryable = db) {
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS employee_profile (
      user_id INT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
      last_name VARCHAR(120) NOT NULL,
      identification VARCHAR(80) NOT NULL UNIQUE,
      assigned_password VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await queryable.query(`
    ALTER TABLE employee_profile
    ADD COLUMN IF NOT EXISTS assigned_password VARCHAR(255)
  `);
}

async function findUserByEmail(email) {
  await ensureRoleSchema();

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
  await ensureRoleSchema();

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
  await ensureRoleSchema();

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
  await ensureRoleSchema();

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
  await ensureRoleSchema();

  const result = await db.query(
    `
      SELECT
        u.id,
        u.name,
        ep.last_name,
        u.phone,
        ep.identification,
        ep.assigned_password,
        u.email,
        u.role,
        u.created_at
      FROM app_user u
      LEFT JOIN employee_profile ep ON ep.user_id = u.id
      WHERE u.role IN ('empleado', 'admin')
      ORDER BY u.created_at DESC
    `
  );

  return result.rows;
}

async function createStaffWithProfile({
  firstName,
  lastName,
  phone,
  identification,
  email,
  role,
  passwordHash,
  assignedPassword
}) {
  await ensureRoleSchema();

  return db.withTransaction(async (client) => {
    await ensureEmployeeProfileTable(client);

    const userResult = await client.query(
      `
        INSERT INTO app_user (name, email, phone, role, password_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, phone, role, created_at
      `,
      [firstName, email, phone, role, passwordHash]
    );

    const user = userResult.rows[0];

    await client.query(
      `
        INSERT INTO employee_profile (user_id, last_name, identification, assigned_password)
        VALUES ($1, $2, $3, $4)
      `,
      [user.id, lastName, identification, assignedPassword]
    );

    return {
      id: user.id,
      name: user.name,
      last_name: lastName,
      phone: user.phone,
      identification,
      assigned_password: assignedPassword,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };
  });
}

async function listStylists() {
  await ensureRoleSchema();

  const result = await db.query(
    `
      SELECT id, name
      FROM app_user
      WHERE role = 'empleado'
      ORDER BY name ASC
    `
  );

  return result.rows;
}

async function findEmployeeAccountByUserId(userId) {
  await ensureRoleSchema();
  await ensureEmployeeProfileTable();

  const result = await db.query(
    `
      SELECT
        u.id,
        u.name,
        COALESCE(ep.last_name, '') AS last_name,
        COALESCE(ep.identification, '') AS identification,
        u.phone,
        u.email,
        u.role,
        u.created_at
      FROM app_user u
      LEFT JOIN employee_profile ep ON ep.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function updateUserById(id, { phone, email, passwordHash }) {
  await ensureRoleSchema();

  const result = await db.query(
    `
      UPDATE app_user
      SET phone = $2,
          email = $3,
          password_hash = COALESCE($4, password_hash)
      WHERE id = $1
      RETURNING id, name, email, phone, role, created_at
    `,
    [id, phone, email, passwordHash]
  );

  return result.rows[0] || null;
}

async function updateAssignedPasswordByUserId(userId, assignedPassword) {
  await ensureEmployeeProfileTable();

  await db.query(
    `
      UPDATE employee_profile
      SET assigned_password = $2
      WHERE user_id = $1
    `,
    [userId, assignedPassword]
  );
}

async function countPaymentsByStylistId(stylistId) {
  await ensureRoleSchema();

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
  await ensureRoleSchema();

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
  findEmployeeAccountByUserId,
  createUser,
  findEmployeeByIdentification,
  listEmployees,
  createStaffWithProfile,
  listStylists,
  updateUserById,
  updateAssignedPasswordByUserId,
  countPaymentsByStylistId,
  deleteUserById
};
