const http = require("http");
const { app } = require("./app");
const { env } = require("./config/env");
const { initializeDatabase } = require("./config/databaseInit");
const { initWsServer } = require("./integrations/realtime/wsHub");

async function start() {
  await initializeDatabase();

  const server = http.createServer(app);

  initWsServer(server);

  server.listen(env.port, () => {
    console.log(`SGP backend escuchando en puerto ${env.port}`);
  });
}

start().catch((error) => {
  console.error("Error iniciando el servidor:", error);
  process.exit(1);
});
