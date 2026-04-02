const { WebSocketServer } = require("ws");

let wss;

function initWsServer(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "connected",
        message: "Canal en tiempo real activo"
      })
    );
  });
}

function broadcast(type, payload) {
  if (!wss) {
    return;
  }

  const message = JSON.stringify({ type, payload });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

module.exports = { initWsServer, broadcast };
