const { Pool } = require("pg");
const { env } = require("./env");

const pool = new Pool({
  connectionString: env.databaseUrl
});

const db = {
  query(text, params) {
    return pool.query(text, params);
  },
  async withTransaction(work) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  close() {
    return pool.end();
  }
};

module.exports = { db };
