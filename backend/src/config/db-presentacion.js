const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.presentacionDatabaseUrl,
  max: 4,
});

module.exports = pool;
