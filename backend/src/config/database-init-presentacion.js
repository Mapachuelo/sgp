const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('./env');
const logger = require('../shared/logger');

const INTENTOS = 5;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function datosConexion() {
  try {
    const url = new URL(env.presentacionDatabaseUrl);
    return {
      host: url.hostname,
      puerto: url.port || '5432',
      base: url.pathname.replace(/^\//, ''),
    };
  } catch {
    return { host: 'desconocido', puerto: 'desconocido', base: 'desconocida' };
  }
}

async function asegurarBase(nombre) {
  const cliente = new Client({ connectionString: env.databaseUrl });
  await cliente.connect();
  try {
    const { rows } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
    if (rows.length === 0) {
      try {
        await cliente.query(`CREATE DATABASE "${nombre.replace(/"/g, '""')}"`);
        logger.info({ base: nombre }, 'Base de datos de presentacion creada');
      } catch (error) {
        if (error.code !== '42P04') throw error;
        logger.info({ base: nombre }, 'Base de datos de presentacion ya existente');
      }
    }
  } finally {
    await cliente.end();
  }
}

async function inicializarUnaVez(sqlPath, nombre) {
  await asegurarBase(nombre);
  const cliente = new Client({ connectionString: env.presentacionDatabaseUrl });
  await cliente.connect();
  try {
    await cliente.query(fs.readFileSync(sqlPath, 'utf-8'));
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

  const conexion = datosConexion();
  let ultimoError = null;

  for (let intento = 1; intento <= INTENTOS; intento += 1) {
    try {
      await inicializarUnaVez(sqlPath, conexion.base);
      logger.info(conexion, 'Base de datos de presentacion inicializada');
      return;
    } catch (error) {
      ultimoError = error;
      logger.warn(
        {
          intento,
          intentos: INTENTOS,
          codigo: error.code,
          mensaje: error.message,
          ...conexion,
        },
        'Fallo al inicializar presentacion; reintentando'
      );
      if (intento < INTENTOS) {
        await esperar(intento * 1000);
      }
    }
  }

  ultimoError.host = conexion.host;
  ultimoError.base = conexion.base;
  ultimoError.intentos = INTENTOS;
  throw ultimoError;
}

module.exports = initPresentacionDatabase;
