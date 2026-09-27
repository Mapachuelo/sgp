const fs = require('fs');
const path = require('path');
const pool = require('./db');
const logger = require('../shared/logger');
const { cifrarTelefono } = require('../shared/utils/telefono');

async function migrarTelefonosEnClaro(client) {
  const { rows } = await client.query(
    "SELECT id, telefono FROM app_user WHERE telefono IS NOT NULL AND telefono NOT LIKE '%:%'"
  );
  for (const row of rows) {
    await client.query('UPDATE app_user SET telefono = $2 WHERE id = $1', [
      row.id,
      cifrarTelefono(row.telefono),
    ]);
  }
  if (rows.length > 0) {
    logger.info({ total: rows.length }, 'Telefonos cifrados con AES-256 correctamente');
  }
}

async function initDatabase() {
  const sqlPath = path.join(__dirname, '..', '..', '..', 'db', 'init.sql');

  if (!fs.existsSync(sqlPath)) {
    logger.warn('db/init.sql no encontrado, omitiendo inicializacion de BD');
    return;
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    await migrarTelefonosEnClaro(client);
    logger.info('Base de datos inicializada correctamente');
  } catch (err) {
    logger.error({ err }, 'Error al inicializar la base de datos');
  } finally {
    client.release();
  }
}

module.exports = initDatabase;
