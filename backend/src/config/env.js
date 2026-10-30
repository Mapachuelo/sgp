const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const databaseUrl = process.env.DATABASE_URL || 'postgresql://sgp_user:sgp_password@localhost:5432/sgp';

function normalizarUrlPresentacion(valor) {
  try {
    const principal = new URL(databaseUrl);
    const presentacion = new URL(valor);
    const hostsLocales = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    if (hostsLocales.has(presentacion.hostname) && !hostsLocales.has(principal.hostname)) {
      presentacion.hostname = principal.hostname;
      presentacion.port = principal.port;
    }
    return presentacion.toString();
  } catch {
    return valor;
  }
}

function derivarUrlPresentacion() {
  try {
    const url = new URL(databaseUrl);
    url.pathname = '/sgp_presentacion';
    return url.toString();
  } catch {
    return 'postgresql://sgp_user:sgp_password@localhost:5432/sgp_presentacion';
  }
}

const presentacionDatabaseUrl = process.env.PRESENTACION_DATABASE_URL
  ? normalizarUrlPresentacion(process.env.PRESENTACION_DATABASE_URL)
  : derivarUrlPresentacion();

const env = {
  port: parseInt(process.env.PORT || process.env.APP_PORT || '3000', 10),
  databaseUrl,
  presentacionDatabaseUrl,
  presentacionMediaDir: process.env.PRESENTACION_MEDIA_DIR || '/app/presentacion-media',
  jwtSecret: process.env.JWT_SECRET || 'sgp_super_secret_2026',
  aesSecret: process.env.AES_SECRET || process.env.JWT_SECRET || 'sgp_super_secret_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30m',
  registroTtlMinutos: parseInt(process.env.REGISTRO_TTL_MINUTOS || '5', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  viteApiUrl: process.env.VITE_API_URL || 'http://localhost:3000',
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || '',
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'SGP',
  wompiBaseUrl: process.env.WOMPI_BASE_URL || 'https://sandbox.wompi.co/v1',
  wompiPublicKey: process.env.WOMPI_PUBLIC_KEY || '',
  wompiPrivateKey: process.env.WOMPI_PRIVATE_KEY || '',
  wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET || '',
  wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET || '',
  wompiRedirectUrl: process.env.WOMPI_REDIRECT_URL || '',
};

module.exports = env;
