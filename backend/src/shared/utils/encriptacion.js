const crypto = require('crypto');

const ALGORITMO = 'aes-256-cbc';
const IV_LENGTH = 16;

function encriptar(texto) {
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'sgp_super_secret_2026', 'salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITMO, key, iv);
  let encrypted = cipher.update(texto, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encrypted };
}

function desencriptar(ivHex, encrypted) {
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'sgp_super_secret_2026', 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITMO, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encriptar, desencriptar };
