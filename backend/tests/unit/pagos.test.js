const test = require('node:test');
const assert = require('node:assert/strict');

process.env.WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_unit';
process.env.WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || 'test_events_unit';
process.env.WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || 'pub_test_unit';
delete require.cache[require.resolve('../../src/config/env')];

const { pool, sufijo, crearUsuario, crearSede, crearServicio, limpiar } = require('./helpers');
const pagosService = require('../../src/features/pagos/pagos.service');
const pagosModel = require('../../src/features/pagos/pagos.model');
const wompi = require('../../src/integrations/pagos/wompi');

async function crearReservaFixture({ estado = 'pendiente', cantidad = 2, precio = 30000 } = {}) {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado' });
  const sede = await crearSede();
  const servicio = await crearServicio(`Servicio Pago ${sufijo()}`, 30, precio);
  const inicio = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const { rows } = await pool.query(
    `INSERT INTO reserva (cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [clienteId, empleadoId, servicio.id, sede.id, inicio, new Date(inicio.getTime() + 30 * 60000), cantidad, estado]
  );
  return { reserva: rows[0], clienteId, empleadoId, sede, servicio };
}

async function limpiarFixture(fixture) {
  await limpiar({
    usuarios: [fixture.clienteId, fixture.empleadoId],
    sedes: [fixture.sede.id],
    servicios: [fixture.servicio.id],
  });
}

test('pagos: crearIntencion recalcula el monto en el servidor y firma la transaccion', async () => {
  const fixture = await crearReservaFixture({ cantidad: 3, precio: 25000 });
  try {
    const intencion = await pagosService.crearIntencion(
      { reserva_id: fixture.reserva.id },
      { id: fixture.clienteId, rol: 'cliente' }
    );
    assert.equal(intencion.monto, 75000);
    assert.equal(intencion.monto_en_centavos, 7500000);
    assert.equal(intencion.moneda, 'COP');
    assert.match(intencion.llave_publica, /^pub_test_/);
    assert.match(intencion.referencia, /^SGP-/);
    assert.match(intencion.firma_integridad, /^[0-9a-f]{64}$/);

    const pago = await pagosModel.findById(intencion.pago_id);
    assert.equal(pago.estado, 'pendiente');
    assert.equal(Number(pago.monto), 75000);
  } finally {
    await limpiarFixture(fixture);
  }
});

test('pagos: crearIntencion rechaza reservas de otro cliente y pagos ya aprobados', async () => {
  const fixture = await crearReservaFixture();
  const otroCliente = await crearUsuario({ rol: 'cliente' });
  try {
    await assert.rejects(
      () => pagosService.crearIntencion({ reserva_id: fixture.reserva.id }, { id: otroCliente, rol: 'cliente' }),
      (err) => err.statusCode === 403
    );

    const intencion = await pagosService.crearIntencion(
      { reserva_id: fixture.reserva.id },
      { id: fixture.clienteId, rol: 'cliente' }
    );
    await pagosModel.actualizarPago(intencion.pago_id, { estado: 'aprobado', transaction_id: 'TX-APROBADA' });

    await assert.rejects(
      () => pagosService.crearIntencion({ reserva_id: fixture.reserva.id }, { id: fixture.clienteId, rol: 'cliente' }),
      (err) => err.statusCode === 409
    );
  } finally {
    await limpiar({ usuarios: [otroCliente] });
    await limpiarFixture(fixture);
  }
});

test('pagos: sincronizarPago aprobado confirma la reserva y es idempotente', async () => {
  const fixture = await crearReservaFixture();
  try {
    const intencion = await pagosService.crearIntencion(
      { reserva_id: fixture.reserva.id },
      { id: fixture.clienteId, rol: 'cliente' }
    );
    const transaccion = {
      id: 'TX-1',
      status: 'APPROVED',
      amount_in_cents: intencion.monto_en_centavos,
      reference: intencion.referencia,
      payment_method_type: 'CARD',
    };

    const primera = await pagosService.sincronizarPago(intencion.pago_id, transaccion);
    assert.equal(primera.estado, 'aprobado');
    assert.equal(primera.reserva_estado, 'confirmada');
    assert.equal(primera.metodo, 'CARD');

    const { rows } = await pool.query('SELECT estado FROM reserva WHERE id = $1', [fixture.reserva.id]);
    assert.equal(rows[0].estado, 'confirmada');

    const segunda = await pagosService.sincronizarPago(intencion.pago_id, { ...transaccion, status: 'DECLINED' });
    assert.equal(segunda.estado, 'aprobado');
    assert.equal(segunda.idempotente, true);
  } finally {
    await limpiarFixture(fixture);
  }
});

test('pagos: sincronizarPago declinado registra el pago sin confirmar la reserva', async () => {
  const fixture = await crearReservaFixture();
  try {
    const intencion = await pagosService.crearIntencion(
      { reserva_id: fixture.reserva.id },
      { id: fixture.clienteId, rol: 'cliente' }
    );
    const resultado = await pagosService.sincronizarPago(intencion.pago_id, {
      id: 'TX-2',
      status: 'DECLINED',
      amount_in_cents: intencion.monto_en_centavos,
      reference: intencion.referencia,
    });
    assert.equal(resultado.estado, 'declinado');
    assert.equal(resultado.reserva_estado, 'pendiente');

    const { rows } = await pool.query('SELECT estado FROM reserva WHERE id = $1', [fixture.reserva.id]);
    assert.equal(rows[0].estado, 'pendiente');
  } finally {
    await limpiarFixture(fixture);
  }
});

test('pagos: procesarEvento valida la firma e ignora referencias desconocidas', async () => {
  const fixture = await crearReservaFixture();
  try {
    const eventoInvalido = {
      data: { transaction: { id: 'TX-3', status: 'APPROVED', reference: 'SGP-inexistente' } },
      signature: { properties: ['transaction.id'], checksum: '00' },
      timestamp: 1700000000,
    };
    await assert.rejects(() => pagosService.procesarEvento(eventoInvalido), (err) => err.statusCode === 401);

    const eventoDesconocido = {
      data: { transaction: { id: 'TX-4', status: 'APPROVED', reference: 'SGP-inexistente' } },
      signature: { properties: ['transaction.id', 'transaction.status', 'transaction.reference'] },
      timestamp: 1700000000,
    };
    eventoDesconocido.signature.checksum = wompi.checksumEventoConSecreto(
      process.env.WOMPI_EVENTS_SECRET,
      eventoDesconocido
    );
    const resultado = await pagosService.procesarEvento(eventoDesconocido);
    assert.equal(resultado.ignorado, true);
  } finally {
    await limpiarFixture(fixture);
  }
});

test('pagos: procesarEvento aprobado sincroniza el pago y confirma la reserva', async () => {
  const fixture = await crearReservaFixture();
  try {
    const intencion = await pagosService.crearIntencion(
      { reserva_id: fixture.reserva.id },
      { id: fixture.clienteId, rol: 'cliente' }
    );
    const evento = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'TX-5',
          status: 'APPROVED',
          amount_in_cents: intencion.monto_en_centavos,
          reference: intencion.referencia,
          payment_method_type: 'NEQUI',
        },
      },
      signature: {
        properties: ['transaction.id', 'transaction.status', 'transaction.reference'],
      },
      timestamp: 1700000000,
    };
    evento.signature.checksum = wompi.checksumEventoConSecreto(process.env.WOMPI_EVENTS_SECRET, evento);

    const resultado = await pagosService.procesarEvento(evento);
    assert.equal(resultado.estado, 'aprobado');
    assert.equal(resultado.reserva_estado, 'confirmada');
    assert.equal(resultado.metodo, 'NEQUI');

    const { rows } = await pool.query('SELECT estado FROM reserva WHERE id = $1', [fixture.reserva.id]);
    assert.equal(rows[0].estado, 'confirmada');
  } finally {
    await limpiarFixture(fixture);
  }
});
