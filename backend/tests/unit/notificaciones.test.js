const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, crearUsuario, limpiar, sufijo } = require('./helpers');
const notificacionesModel = require('../../src/features/notificaciones/notificaciones.model');
const notificacionesService = require('../../src/features/notificaciones/notificaciones.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

test('notificaciones: crea, lista, marca leida y aisla por usuario', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente', email: `noti.${sufijo()}@unit.local` });
  const otroId = await crearUsuario({ rol: 'cliente', email: `noti.otro.${sufijo()}@unit.local` });
  ids.usuarios.push(clienteId, otroId);

  const creada = await notificacionesModel.create({
    usuario_id: clienteId,
    tipo: 'reserva_cancelada',
    titulo: 'Tu cita fue cancelada',
    mensaje: 'La cita del lunes fue cancelada.',
    metadata: { motivo: 'Prueba' },
  });
  assert.ok(creada.id);

  const listado = await notificacionesService.listar(clienteId);
  assert.equal(listado.items.length, 1);
  assert.equal(listado.no_leidas, 1);
  assert.equal(listado.items[0].titulo, 'Tu cita fue cancelada');

  const ajeno = await notificacionesService.listar(otroId);
  assert.equal(ajeno.items.length, 0);
  await assert.rejects(() => notificacionesService.marcarLeida(otroId, creada.id), /no encontrada/);

  const leida = await notificacionesService.marcarLeida(clienteId, creada.id);
  assert.ok(leida.leida_en);
  assert.equal((await notificacionesService.contador(clienteId)).no_leidas, 0);

  await notificacionesModel.create({
    usuario_id: clienteId,
    tipo: 'reserva_cancelada',
    titulo: 'Otro aviso',
    mensaje: 'Mensaje pendiente.',
  });
  const todas = await notificacionesService.marcarTodas(clienteId);
  assert.equal(todas.actualizadas, 1);
  assert.equal((await notificacionesService.contador(clienteId)).no_leidas, 0);

  await pool.query('DELETE FROM notificacion WHERE usuario_id = ANY($1)', [ids.usuarios]);
  await limpiar(ids);
});
