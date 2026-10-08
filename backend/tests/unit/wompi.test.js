const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const wompi = require('../../src/integrations/pagos/wompi');

test('wompi: firma de integridad coincide con el vector de la documentacion', () => {
  const firma = wompi.firmaIntegridadConSecreto('prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6', {
    referencia: 'sk8-438k4-xmxm392-sn2m',
    montoEnCentavos: 2490000,
    moneda: 'COP',
  });
  assert.equal(firma, '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
});

test('wompi: checksum de evento se calcula sobre las propiedades en orden + timestamp + secreto', () => {
  const secreto = 'test_events_secreto';
  const evento = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: '01-1531231271-19365',
        status: 'APPROVED',
        amount_in_cents: 2490000,
        reference: 'SGP-1-abc',
      },
    },
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
        'transaction.reference',
      ],
    },
    timestamp: 1530291411,
  };
  const esperado = crypto
    .createHash('sha256')
    .update(`01-1531231271-19365APPROVED2490000SGP-1-abc1530291411${secreto}`)
    .digest('hex');
  assert.equal(wompi.checksumEventoConSecreto(secreto, evento), esperado);
});

test('wompi: validarChecksumEvento acepta firma valida y rechaza manipulada', () => {
  process.env.WOMPI_EVENTS_SECRET = 'test_events_unit';
  delete require.cache[require.resolve('../../src/config/env')];
  delete require.cache[require.resolve('../../src/integrations/pagos/wompi')];
  const modulo = require('../../src/integrations/pagos/wompi');

  const evento = {
    data: { transaction: { id: 'TX-1', status: 'APPROVED', reference: 'SGP-2-xyz' } },
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.reference'],
      checksum: '',
    },
    timestamp: 1700000000,
  };
  evento.signature.checksum = modulo.checksumEventoConSecreto('test_events_unit', evento);
  assert.equal(modulo.validarChecksumEvento(evento), true);

  evento.signature.checksum = evento.signature.checksum.replace(/.$/, (c) => (c === '0' ? '1' : '0'));
  assert.equal(modulo.validarChecksumEvento(evento), false);

  evento.signature.checksum = 'no-es-hex';
  assert.equal(modulo.validarChecksumEvento(evento), false);
});

test('wompi: consultarTransaccion usa Bearer con la llave publica y propaga el detalle', async () => {
  process.env.WOMPI_PUBLIC_KEY = 'pub_test_unit';
  process.env.WOMPI_BASE_URL = 'https://sandbox.wompi.co/v1';
  delete require.cache[require.resolve('../../src/config/env')];
  delete require.cache[require.resolve('../../src/integrations/pagos/wompi')];
  let capturado = null;
  global.fetch = async (url, opciones) => {
    capturado = { url, opciones };
    return { ok: true, json: async () => ({ data: { id: 'TX-9', status: 'APPROVED' } }) };
  };
  const modulo = require('../../src/integrations/pagos/wompi');
  const transaccion = await modulo.consultarTransaccion('TX-9');
  assert.equal(transaccion.id, 'TX-9');
  assert.match(capturado.url, /sandbox\.wompi\.co\/v1\/transactions\/TX-9$/);
  assert.equal(capturado.opciones.headers.Authorization, 'Bearer pub_test_unit');
});
