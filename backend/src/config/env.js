const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const env = {
  port: parseInt(process.env.PORT || process.env.APP_PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://sgp_user:sgp_password@localhost:5432/sgp',
  jwtSecret: process.env.JWT_SECRET || 'sgp_super_secret_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30m',
  nodeEnv: process.env.NODE_ENV || 'development',
  viteApiUrl: process.env.VITE_API_URL || 'http://localhost:3000',
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || '',
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'SGP',
};

module.exports = env;
