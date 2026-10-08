const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, crearUsuario, limpiar, sufijo } = require('./helpers');
const ubicacionesService = require('../../src/features/ubicaciones/ubicaciones.service');
const preferenciasService = require('../../src/features/preferencias/preferencias.service');
const reportesService = require('../../src/features/reportes/reportes.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

test('ubicaciones: valida campos obligatorios y rangos de coordenadas', async () => {
  await assert.rejects(() => ubicacionesService.create({}), /Todos los campos/);
  await assert.rejects(
    () => ubicacionesService.create({ nombre: 'X', direccion: 'Y', latitud: 100, longitud: 0 }),
    /latitud/
  );
  await assert.rejects(
    () => ubicacionesService.create({ nombre: 'X', direccion: 'Y', latitud: 4, longitud: 200 }),
    /longitud/
  );
  await assert.rejects(
    () => ubicacionesService.create({ nombre: 'X', direccion: 'Y', latitud: 'no', longitud: 4 }),
    /numericos/
  );
});

test('ubicaciones: CRUD completo', async () => {
  const sede = await ubicacionesService.create({
    nombre: `Sede Unit ${sufijo()}`,
    direccion: 'Calle 1 #2-3',
    latitud: 4.6,
    longitud: -74.08,
  });
  ids.sedes.push(sede.id);

  await assert.rejects(() => ubicacionesService.update(sede.id, { latitud: 91 }), /latitud/);
  await assert.rejects(() => ubicacionesService.update(999999, { nombre: 'x' }), /no encontrada/);

  const actualizada = await ubicacionesService.update(sede.id, { nombre: `Sede Unit editada ${sufijo()}` });
  assert.match(actualizada.nombre, /editada/);

  const todas = await ubicacionesService.findAll();
  assert.ok(todas.some((u) => u.id === sede.id));

  await ubicacionesService.delete(sede.id);
  await assert.rejects(() => ubicacionesService.delete(sede.id), /no encontrada/);
});

test('preferencias: crea por defecto y valida idioma', async () => {
  const usuarioId = await crearUsuario({});
  ids.usuarios.push(usuarioId);

  const inicial = await preferenciasService.get(usuarioId);
  assert.equal(inicial.idioma, 'es');
  assert.equal(inicial.granularidad_calendario, 30);

  await assert.rejects(() => preferenciasService.update(usuarioId, { idioma: 'fr' }), /idioma/);
  const actualizada = await preferenciasService.update(usuarioId, { idioma: 'en', tema: 'oscuro' });
  assert.equal(actualizada.idioma, 'en');
  assert.equal(actualizada.tema, 'oscuro');
});

test('reportes: valida fechas y responde con datos', async () => {
  await assert.rejects(() => reportesService.ventasDiarias('mal'), /formato/);
  await assert.rejects(() => reportesService.ocupacion('2026-99-99'), /formato/);

  const ventas = await reportesService.ventasDiarias();
  assert.match(ventas.fecha, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof ventas.total, 'number');
  assert.ok(Array.isArray(ventas.desglose));

  const ocupacion = await reportesService.ocupacion();
  assert.ok(Array.isArray(ocupacion));

  const recurrentes = await reportesService.clientesRecurrentes();
  assert.ok(Array.isArray(recurrentes));
});

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});
