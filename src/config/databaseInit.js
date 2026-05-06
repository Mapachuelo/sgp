const fs = require("fs");
const path = require("path");
const { db } = require("./db");

const SCHEMA_PATH = path.join(__dirname, "../../db/init.sql");
const WAIT_ATTEMPTS = 30;
const WAIT_DELAY_MS = 2000;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForDatabase() {
  let lastError;

  for (let attempt = 1; attempt <= WAIT_ATTEMPTS; attempt += 1) {
    try {
      await db.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      if (attempt < WAIT_ATTEMPTS) {
        await delay(WAIT_DELAY_MS);
      }
    }
  }

  throw lastError;
}

async function initializeDatabase() {
  await waitForDatabase();

  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf8");
  await db.query(schemaSql);
}

module.exports = { initializeDatabase };