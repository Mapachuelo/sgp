const { db } = require("../../config/db");

let locationSchemaReady = null;

async function ensureLocationSchema(queryable = db) {
  if (queryable !== db) {
    await queryable.query(`
      CREATE TABLE IF NOT EXISTS location (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        address VARCHAR(255) NOT NULL,
        region VARCHAR(120) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    return;
  }

  if (!locationSchemaReady) {
    locationSchemaReady = db.query(`
      CREATE TABLE IF NOT EXISTS location (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        address VARCHAR(255) NOT NULL,
        region VARCHAR(120) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((error) => {
      locationSchemaReady = null;
      throw error;
    });
  }

  await locationSchemaReady;
}

async function listLocations() {
  await ensureLocationSchema();

  const result = await db.query(
    `
      SELECT id, name, address, region, created_at
      FROM location
      ORDER BY name ASC
    `
  );

  return result.rows;
}

async function createLocation({ name, address, region }) {
  await ensureLocationSchema();

  const result = await db.query(
    `
      INSERT INTO location (name, address, region)
      VALUES ($1, $2, $3)
      RETURNING id, name, address, region, created_at
    `,
    [name, address, region]
  );

  return result.rows[0];
}

async function updateLocation(id, { name, address, region }) {
  await ensureLocationSchema();

  const result = await db.query(
    `
      UPDATE location
      SET name = COALESCE($2, name),
          address = COALESCE($3, address),
          region = COALESCE($4, region)
      WHERE id = $1
      RETURNING id, name, address, region, created_at
    `,
    [id, name, address, region]
  );

  return result.rows[0] || null;
}

async function deleteLocation(id) {
  await ensureLocationSchema();

  const result = await db.query(
    `
      DELETE FROM location
      WHERE id = $1
      RETURNING id, name, address, region, created_at
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findLocationById(id) {
  await ensureLocationSchema();

  const result = await db.query(
    `
      SELECT id, name, address, region, created_at
      FROM location
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  findLocationById
};
