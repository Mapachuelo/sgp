const { db } = require("../../config/db");

async function listClients() {
  const result = await db.query(
    `
      SELECT id, name, email, phone, role, created_at
      FROM app_user
      WHERE role = 'client'
      ORDER BY created_at DESC
    `
  );

  return result.rows;
}

async function findClientById(id) {
  const result = await db.query(
    `
      SELECT id, name, email, phone, role, created_at
      FROM app_user
      WHERE id = $1 AND role = 'client'
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findUserByEmail(email) {
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
  const result = await db.query(
    `
      UPDATE app_user
      SET name = $2,
          phone = $3,
          email = $4,
          password_hash = $5
      WHERE id = $1 AND role = 'client'
      RETURNING id, name, email, phone, role, created_at
    `,
    [id, name, phone, email, passwordHash]
  );

  return result.rows[0] || null;
}

async function deleteClient(id) {
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

module.exports = {
  listClients,
  findClientById,
  findUserByEmail,
  updateClient,
  deleteClient
};
