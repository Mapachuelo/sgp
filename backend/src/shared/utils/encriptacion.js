const crypto = require('crypto');
const env = require('../../config/env');

const ALGORITMO = 'aes-256-cbc';
const IV_LENGTH = 16;

function obtenerLlave() {
  return crypto.scryptSync(env.aesSecret, 'sgp-aes-salt', 32);
}

function encriptar(texto) {
  const key = obtenerLlave();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITMO, key, iv);
  let encrypted = cipher.update(texto, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encrypted };
}

function desencriptar(ivHex, encrypted) {
  const key = obtenerLlave();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITMO, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encriptar, desencriptar };
