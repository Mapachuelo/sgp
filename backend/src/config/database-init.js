const fs = require('fs');
const path = require('path');
const pool = require('./db');
const logger = require('../shared/logger');

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
    logger.info('Base de datos inicializada correctamente');
  } catch (err) {
    logger.error({ err }, 'Error al inicializar la base de datos');
  } finally {
    client.release();
  }
}

module.exports = initDatabase;
