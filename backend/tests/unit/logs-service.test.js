const test = require('node:test');
const assert = require('node:assert/strict');
const { filtrarLogs, exportarLineas, fechaEnBogota } = require('../../src/features/logs/logs.service');

const ahora = Date.now();
const lineas = [
  { level: 30, time: ahora, msg: 'inicio de sesion exitoso', _linea: 1 },
  { level: 40, time: ahora, msg: 'advertencia de reserva', _linea: 2 },
  { level: 50, time: ahora, msg: 'error grave de conexion', _linea: 3 },
];

test('logs: sin filtros devuelve todas las lineas', () => {
  assert.equal(filtrarLogs(lineas, {}).length, 3);
});

test('logs: severidad exacta INFO devuelve solo nivel 30', () => {
  const resultado = filtrarLogs(lineas, { severidad: 'INFO' });
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].level, 30);
});

test('logs: severidad exacta ERROR devuelve solo nivel 50', () => {
  const resultado = filtrarLogs(lineas, { severidad: 'ERROR' });
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].level, 50);
});

test('logs: filtro por palabra clave', () => {
  const resultado = filtrarLogs(lineas, { filtro: 'grav' });
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].msg, 'error grave de conexion');
});

test('logs: filtro por fecha en zona Bogota', () => {
  const hoy = fechaEnBogota(ahora);
  assert.equal(filtrarLogs(lineas, { fecha: hoy }).length, 3);
  assert.equal(filtrarLogs(lineas, { fecha: '2000-01-01' }).length, 0);
});

test('logs: linea sin time se descarta al filtrar por fecha', () => {
  assert.equal(filtrarLogs([{ level: 30, msg: 'sin fecha' }], { fecha: '2026-01-01' }).length, 0);
});

test('logs: exportarLineas respeta desde y hasta', () => {
  assert.deepEqual(exportarLineas(lineas, 1, 2).map((l) => l._linea), [2]);
  assert.equal(exportarLineas(lineas, 0, undefined).length, 3);
  assert.equal(exportarLineas(lineas, 0, 0).length, 3);
});
