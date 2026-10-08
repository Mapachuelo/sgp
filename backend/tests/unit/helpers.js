const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const env = require('../../src/config/env');

const pool = new Pool({ connectionString: env.databaseUrl });

const sufijo = () => `${Date.now()}.${Math.floor(Math.random() * 100000)}`;

async function crearUsuario({ rol = 'cliente', email, nombre = 'Test', apellido = 'SGP', telefono = null, verificado = true, password = 'test1234' }) {
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query(
    `INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono, verificado)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [email || `test.${sufijo()}@unit.local`, hash, rol, nombre, apellido, telefono, verificado]
  );
  return rows[0].id;
}

async function crearSede(nombre = `Sede Test ${sufijo()}`) {
  const { rows } = await pool.query(
    'INSERT INTO ubicacion (nombre, direccion, latitud, longitud) VALUES ($1, $2, $3, $4) RETURNING *',
    [nombre, 'Calle Test 123', 4.6, -74.08]
  );
  return rows[0];
}

async function crearServicio(nombre = `Servicio Test ${sufijo()}`, duracion = 30, precio = 30000) {
  const { rows } = await pool.query(
    `INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [nombre, 'Servicio de pruebas', precio, duracion]
  );
  return rows[0];
}

async function asignarServicio(empleadoId, servicioId, duracion = 30) {
  await pool.query(
    `INSERT INTO empleado_tiempo_servicio (empleado_id, servicio_id, duracion_minutos)
     VALUES ($1, $2, $3) ON CONFLICT (empleado_id, servicio_id) DO UPDATE SET duracion_minutos = EXCLUDED.duracion_minutos`,
    [empleadoId, servicioId, duracion]
  );
}

async function crearDisponibilidad(empleadoId, ubicacionId, diaSemana, inicio = '09:00', fin = '18:00') {
  await pool.query(
    `INSERT INTO empleado_disponibilidad (empleado_id, ubicacion_id, dia_semana, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, $5)`,
    [empleadoId, ubicacionId, diaSemana, inicio, fin]
  );
}

async function limpiar({ usuarios = [], sedes = [], servicios = [] } = {}) {
  if (servicios.length > 0) {
    await pool.query('DELETE FROM servicio_catalogo WHERE id = ANY($1)', [servicios]);
  }
  if (sedes.length > 0) {
    await pool.query('DELETE FROM ubicacion WHERE id = ANY($1)', [sedes]);
  }
  if (usuarios.length > 0) {
    await pool.query('DELETE FROM cobro WHERE registrado_por = ANY($1)', [usuarios]);
    await pool.query('DELETE FROM app_user WHERE id = ANY($1)', [usuarios]);
  }
}

function proximoLunes() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const faltan = (1 - dia + 7) % 7 || 7;
  const objetivo = new Date(hoy);
  objetivo.setDate(hoy.getDate() + faltan);
  return objetivo;
}

module.exports = { pool, sufijo, crearUsuario, crearSede, crearServicio, asignarServicio, crearDisponibilidad, limpiar, proximoLunes };
