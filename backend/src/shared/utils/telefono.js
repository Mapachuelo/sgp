const { encriptar, desencriptar } = require('./encriptacion');

const TELEFONO_REGEX = /^\+[1-9]\d{7,14}$/;
const COLOMBIA_REGEX = /^\+57\d{10}$/;

function normalizarTelefono(telefono) {
  if (typeof telefono !== 'string') return telefono;
  return telefono.trim().replace(/[\s().-]/g, '');
}

function validarTelefono(telefono) {
  const normalizado = normalizarTelefono(telefono);
  if (typeof normalizado !== 'string' || !TELEFONO_REGEX.test(normalizado)) {
    return false;
  }
  if (normalizado.startsWith('+57')) {
    return COLOMBIA_REGEX.test(normalizado);
  }
  return true;
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

module.exports = {
  TELEFONO_REGEX,
  COLOMBIA_REGEX,
  normalizarTelefono,
  validarTelefono,
  cifrarTelefono,
  descifrarTelefono,
};
