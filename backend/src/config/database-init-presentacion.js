const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('./env');
const logger = require('../shared/logger');

async function asegurarBase() {
  const url = new URL(env.presentacionDatabaseUrl);
  const nombre = url.pathname.replace(/^\//, '');
  const cliente = new Client({ connectionString: env.databaseUrl });
  await cliente.connect();
  try {
    const { rows } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
    if (rows.length === 0) {
      await cliente.query(`CREATE DATABASE "${nombre.replace(/"/g, '""')}"`);
      logger.info({ base: nombre }, 'Base de datos de presentacion creada');
    }
  } finally {
    await cliente.end();
  }
}

async function initPresentacionDatabase() {
  const sqlPath = path.join(__dirname, '..', '..', '..', 'db', 'presentacion.sql');
  if (!fs.existsSync(sqlPath)) {
    logger.warn('db/presentacion.sql no encontrado, omitiendo presentacion');
    return;
  }
  await asegurarBase();
  const cliente = new Client({ connectionString: env.presentacionDatabaseUrl });
  await cliente.connect();
  try {
    await cliente.query(fs.readFileSync(sqlPath, 'utf-8'));
    logger.info('Base de datos de presentacion inicializada');
  } finally {
    await cliente.end();
  }
}

module.exports = initPresentacionDatabase;
