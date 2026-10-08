const crypto = require('crypto');
const env = require('../../config/env');

const TTL_ESTADO_MS = 5 * 60 * 1000;
let estadoCache = { estado: 'no-configurado', detalle: null, verificadoEn: 0 };

function firmaIntegridadConSecreto(secreto, { referencia, montoEnCentavos, moneda = 'COP' }) {
  const cadena = `${referencia}${montoEnCentavos}${moneda}${secreto}`;
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

function firmaIntegridad(datos) {
  if (!env.wompiIntegritySecret) {
    const err = new Error('Wompi no configurado: define WOMPI_INTEGRITY_SECRET');
    err.statusCode = 500;
    throw err;
  }
  return firmaIntegridadConSecreto(env.wompiIntegritySecret, datos);
}

function checksumEventoConSecreto(secreto, evento) {
  const propiedades = evento?.signature?.properties || [];
  const valores = propiedades.map((ruta) =>
    ruta.split('.').reduce((actual, clave) => (actual == null ? undefined : actual[clave]), evento.data)
  );
  const cadena = `${valores.join('')}${evento.timestamp}${secreto}`;
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

function validarChecksumEvento(evento) {
  if (!env.wompiEventsSecret) return false;
  const recibido = evento?.signature?.checksum;
  if (!recibido || typeof recibido !== 'string') return false;
  const calculado = checksumEventoConSecreto(env.wompiEventsSecret, evento);
  const esperado = Buffer.from(calculado, 'hex');
  const entrante = Buffer.from(recibido.toLowerCase(), 'hex');
  if (esperado.length !== entrante.length) return false;
  return crypto.timingSafeEqual(esperado, entrante);
}

async function consultarTransaccion(transactionId) {
  if (!env.wompiPublicKey) {
    const err = new Error('Wompi no configurado: define WOMPI_PUBLIC_KEY');
    err.statusCode = 500;
    throw err;
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 8000);
  try {
    const respuesta = await fetch(
      `${env.wompiBaseUrl}/transactions/${encodeURIComponent(transactionId)}`,
      {
        headers: { accept: 'application/json', Authorization: `Bearer ${env.wompiPublicKey}` },
        signal: controlador.signal,
      }
    );
    const cuerpo = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const motivo = cuerpo?.error?.reason || cuerpo?.error?.type || `HTTP ${respuesta.status}`;
      const err = new Error(`Wompi API ${respuesta.status}: ${motivo}`);
      err.statusCode = respuesta.status === 404 ? 404 : 502;
      throw err;
    }
    return cuerpo?.data || null;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutError = new Error('Wompi API: timeout consultando la transaccion');
      timeoutError.statusCode = 502;
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(temporizador);
  }
}

async function verificarCredencialesWompi() {
  if (!env.wompiPublicKey) {
    estadoCache = { estado: 'no-configurado', detalle: null, verificadoEn: Date.now() };
    return estadoCache;
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 5000);
  try {
    const respuesta = await fetch(`${env.wompiBaseUrl}/merchants/${env.wompiPublicKey}`, {
      headers: { accept: 'application/json' },
      signal: controlador.signal,
    });
    if (respuesta.ok) {
      estadoCache = { estado: 'ok', detalle: null, verificadoEn: Date.now() };
    } else {
      estadoCache = { estado: 'error', detalle: `HTTP ${respuesta.status}`, verificadoEn: Date.now() };
    }
  } catch (err) {
    estadoCache = {
      estado: 'error',
      detalle: err.name === 'AbortError' ? 'timeout' : err.message,
      verificadoEn: Date.now(),
    };
  } finally {
    clearTimeout(temporizador);
  }
  return estadoCache;
}

function estadoWompi() {
  return estadoCache;
}

module.exports = {
  firmaIntegridad,
  firmaIntegridadConSecreto,
  checksumEventoConSecreto,
  validarChecksumEvento,
  consultarTransaccion,
  verificarCredencialesWompi,
  estadoWompi,
  TTL_ESTADO_MS,
};
