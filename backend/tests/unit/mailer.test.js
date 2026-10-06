const test = require('node:test');
const assert = require('node:assert/strict');

function cargarMailer({ key, fetchImpl }) {
  process.env.BREVO_API_KEY = key;
  delete require.cache[require.resolve('../../src/config/env')];
  delete require.cache[require.resolve('../../src/integrations/email/mailer')];
  global.fetch = fetchImpl;
  return require('../../src/integrations/email/mailer');
}

test('brevo: sin key queda no-configurado sin llamar a la red', async () => {
  let llamadas = 0;
  const mailer = cargarMailer({
    key: '',
    fetchImpl: async () => {
      llamadas += 1;
      return { ok: true };
    },
  });
  const estado = await mailer.verificarCredencialesBrevo();
  assert.equal(estado.estado, 'no-configurado');
  assert.equal(llamadas, 0);
  assert.equal(mailer.estadoBrevo().estado, 'no-configurado');
});

test('brevo: cuenta 200 marca estado ok', async () => {
  const mailer = cargarMailer({ key: 'xkeysib-test', fetchImpl: async () => ({ ok: true }) });
  const estado = await mailer.verificarCredencialesBrevo();
  assert.equal(estado.estado, 'ok');
  assert.ok(estado.verificadoEn > 0);
  assert.equal(mailer.estadoBrevo().estado, 'ok');
});

test('brevo: 401 marca error con detalle HTTP', async () => {
  const mailer = cargarMailer({
    key: 'xkeysib-test',
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'unauthorized' }),
  });
  const estado = await mailer.verificarCredencialesBrevo();
  assert.equal(estado.estado, 'error');
  assert.match(estado.detalle, /401/);
});

test('brevo: fallo de red marca error con mensaje', async () => {
  const mailer = cargarMailer({
    key: 'xkeysib-test',
    fetchImpl: async () => {
      throw new Error('sin red');
    },
  });
  const estado = await mailer.verificarCredencialesBrevo();
  assert.equal(estado.estado, 'error');
  assert.match(estado.detalle, /sin red/);
});
