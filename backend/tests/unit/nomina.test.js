const test = require('node:test');
const assert = require('node:assert/strict');
const {
  pool, crearUsuario, crearSede, crearServicio, limpiar,
} = require('./helpers');
const reportesService = require('../../src/features/reportes/reportes.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

function fechaBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});

test('nomina: calcula solo servicios cobrados, reparte porcentaje y genera PDF', async () => {
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Nomina', apellido: 'Unit' });
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const sede = await crearSede();
  const servicio = await crearServicio('Nomina Unit', 30, 100000);
  ids.usuarios.push(empleadoId, clienteId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  await pool.query(
    `INSERT INTO empleado_perfil (usuario_id, identificacion, comision_porcentaje)
     VALUES ($1, 'NOM-001', 60)`,
    [empleadoId]
  );

  const fecha = fechaBogota();
  const { rows: reservaRows } = await pool.query(
    `INSERT INTO reserva
       (cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, estado)
     VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '30 minutes', 'cobrado')
     RETURNING id`,
    [clienteId, empleadoId, servicio.id, sede.id]
  );
  await pool.query(
    `INSERT INTO reserva_servicio
       (reserva_id, servicio_id, empleado_id, nombre, precio, duracion_minutos, inicia_en, termina_en, orden)
     VALUES ($1, $2, $3, 'Nomina Unit', 100000, 30, NOW(), NOW() + INTERVAL '30 minutes', 1)`,
    [reservaRows[0].id, servicio.id, empleadoId]
  );
  await pool.query(
    `INSERT INTO cobro (reserva_id, monto, metodo)
     VALUES ($1, 100000, 'fisico')`,
    [reservaRows[0].id]
  );

  const resultado = await reportesService.nomina({
    empleado_id: empleadoId,
    ubicacion_id: sede.id,
    desde: fecha,
    hasta: fecha,
  });
  assert.equal(resultado.empleado.id, empleadoId);
  assert.equal(resultado.ubicacion.id, sede.id);
  assert.equal(resultado.totales.bruto, 100000);
  assert.equal(resultado.totales.empleado_parte, 60000);
  assert.equal(resultado.totales.salon_parte, 40000);
  assert.equal(resultado.detalle.length, 1);

  const resumenEmpleado = await reportesService.resumenEmpleado(empleadoId, {
    desde: fecha,
    hasta: fecha,
  });
  assert.equal(resumenEmpleado.servicios, 1);
  assert.equal(resumenEmpleado.porcentaje, 60);
  assert.equal(resumenEmpleado.bruto, 100000);
  assert.equal(resumenEmpleado.ganado, 60000);

  const pdf = await reportesService.nominaPdf({
    empleado_id: empleadoId,
    ubicacion_id: sede.id,
    desde: fecha,
    hasta: fecha,
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');

  await pool.query(
    'UPDATE cobro SET reembolsado_en = NOW() WHERE reserva_id = $1',
    [reservaRows[0].id]
  );
  const resumenReembolsado = await reportesService.resumenEmpleado(empleadoId, {
    desde: fecha,
    hasta: fecha,
  });
  assert.equal(resumenReembolsado.servicios, 0);
  assert.equal(resumenReembolsado.ganado, 0);
});

test('nomina: reparte una reserva multi-servicio de forma proporcional al filtrar por empleado', async () => {
  const empleadoA = await crearUsuario({ rol: 'empleado', nombre: 'Nomina', apellido: 'Uno' });
  const empleadoB = await crearUsuario({ rol: 'empleado', nombre: 'Nomina', apellido: 'Dos' });
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const sede = await crearSede();
  const servicioA = await crearServicio('Nomina Multi A', 30, 80000);
  const servicioB = await crearServicio('Nomina Multi B', 30, 40000);
  ids.usuarios.push(empleadoA, empleadoB, clienteId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicioA.id, servicioB.id);

  await pool.query(
    `INSERT INTO empleado_perfil (usuario_id, identificacion, comision_porcentaje)
     VALUES ($1, 'NOM-002', 60), ($2, 'NOM-003', 40)`,
    [empleadoA, empleadoB]
  );

  const fecha = fechaBogota();
  const { rows: reservaRows } = await pool.query(
    `INSERT INTO reserva
       (cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, estado)
     VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '60 minutes', 'cobrado')
     RETURNING id`,
    [clienteId, empleadoA, servicioA.id, sede.id]
  );
  await pool.query(
    `INSERT INTO reserva_servicio
       (reserva_id, servicio_id, empleado_id, nombre, precio, duracion_minutos, inicia_en, termina_en, orden)
     VALUES
       ($1, $2, $3, 'Nomina Multi A', 80000, 30, NOW(), NOW() + INTERVAL '30 minutes', 1),
       ($1, $4, $5, 'Nomina Multi B', 40000, 30, NOW() + INTERVAL '30 minutes', NOW() + INTERVAL '60 minutes', 2)`,
    [reservaRows[0].id, servicioA.id, empleadoA, servicioB.id, empleadoB]
  );
  await pool.query(
    `INSERT INTO cobro (reserva_id, monto, metodo)
     VALUES ($1, 120000, 'fisico')`,
    [reservaRows[0].id]
  );

  const resultadoA = await reportesService.nomina({
    empleado_id: empleadoA,
    desde: fecha,
    hasta: fecha,
  });
  assert.equal(resultadoA.totales.bruto, 80000);
  assert.equal(resultadoA.totales.empleado_parte, 48000);
  assert.equal(resultadoA.totales.salon_parte, 32000);

  const resultadoB = await reportesService.nomina({
    empleado_id: empleadoB,
    desde: fecha,
    hasta: fecha,
  });
  assert.equal(resultadoB.totales.bruto, 40000);
  assert.equal(resultadoB.totales.empleado_parte, 16000);
  assert.equal(resultadoB.totales.salon_parte, 24000);

  const resultadoTodos = await reportesService.nomina({ ubicacion_id: sede.id, desde: fecha, hasta: fecha });
  assert.equal(resultadoTodos.totales.bruto, 120000);
  assert.equal(resultadoTodos.totales.empleado_parte, 64000);
  assert.equal(resultadoTodos.totales.salon_parte, 56000);
});
