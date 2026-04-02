const { db } = require("../../config/db");

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

module.exports = {
  findUserByEmail,
  findUserById,
  createUser
};
