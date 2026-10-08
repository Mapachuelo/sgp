const test = require('node:test');
const assert = require('node:assert/strict');
const { encriptar, desencriptar } = require('../../src/shared/utils/encriptacion');
const { validarTelefono, cifrarTelefono, descifrarTelefono } = require('../../src/shared/utils/telefono');

test('encriptacion: roundtrip AES-256-CBC', () => {
  const { iv, encrypted } = encriptar('texto sensible');
  assert.equal(typeof iv, 'string');
  assert.equal(desencriptar(iv, encrypted), 'texto sensible');
});

test('encriptacion: dos cifrados del mismo texto difieren por IV', () => {
  const primero = encriptar('mismo texto');
  const segundo = encriptar('mismo texto');
  assert.notEqual(primero.encrypted, segundo.encrypted);
  assert.notEqual(primero.iv, segundo.iv);
});

test('telefono: valida formato colombiano +57', () => {
  assert.equal(validarTelefono('+573001112233'), true);
  assert.equal(validarTelefono('3001112233'), false);
  assert.equal(validarTelefono('+57300111223'), false);
  assert.equal(validarTelefono('+5730011122334'), false);
  assert.equal(validarTelefono(null), false);
});

test('telefono: cifra y descifra con formato iv:hex', () => {
  const cifrado = cifrarTelefono('+573001112233');
  assert.match(cifrado, /^[0-9a-f]+:[0-9a-f]+$/);
  assert.equal(descifrarTelefono(cifrado), '+573001112233');
});

test('telefono: texto plano legacy se devuelve tal cual', () => {
  assert.equal(descifrarTelefono('+573009998877'), '+573009998877');
});

test('telefono: valores vacios', () => {
  assert.equal(cifrarTelefono(null), null);
  assert.equal(descifrarTelefono(null), null);
});
