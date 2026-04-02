const http = require("http");
const { app } = require("./app");
const { env } = require("./config/env");
const { initWsServer } = require("./integrations/realtime/wsHub");

const server = http.createServer(app);

initWsServer(server);

server.listen(env.port, () => {
  console.log(`SGP backend escuchando en puerto ${env.port}`);
});
