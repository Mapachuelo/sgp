const { encriptar, desencriptar } = require('./encriptacion');

const TELEFONO_REGEX = /^\+57[0-9]{10}$/;

function validarTelefono(telefono) {
  return typeof telefono === 'string' && TELEFONO_REGEX.test(telefono);
}

function cifrarTelefono(telefono) {
  if (!telefono) return null;
  const { iv, encrypted } = encriptar(telefono);
  return `${iv}:${encrypted}`;
}

function descifrarTelefono(valor) {
  if (!valor) return null;
  if (!valor.includes(':')) return valor;
  const [iv, encrypted] = valor.split(':');
  try {
    return desencriptar(iv, encrypted);
  } catch {
    return valor;
  }
}

module.exports = { TELEFONO_REGEX, validarTelefono, cifrarTelefono, descifrarTelefono };
