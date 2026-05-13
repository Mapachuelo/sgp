(function () {
  var TOKEN_KEY = "sgp_token";
  var RECONNECT_DELAY = 3000;
  var MAX_RECONNECT_DELAY = 30000;
  var ws = null;
  var reconnectTimeout = null;
  var currentDelay = RECONNECT_DELAY;
  var handlers = {};

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    var token = getToken();
    if (!token) {
      return;
    }

    var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    var url = protocol + "//" + window.location.host + "/ws";

    try {
      ws = new WebSocket(url);
    } catch (error) {
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      currentDelay = RECONNECT_DELAY;
      console.log("[WS] Conectado al servidor de notificaciones");
    };

    ws.onmessage = function (event) {
      try {
        var data = JSON.parse(event.data);
        var type = data.type;
        var payload = data.payload || {};

        if (handlers[type]) {
          handlers[type].forEach(function (handler) {
            handler(payload);
          });
        }

        if (handlers["*"]) {
          handlers["*"].forEach(function (handler) {
            handler(type, payload);
          });
        }
      } catch (error) {
        console.error("[WS] Error procesando mensaje:", error);
      }
    };

    ws.onclose = function () {
      console.log("[WS] Conexion cerrada, reconectando...");
      scheduleReconnect();
    };

    ws.onerror = function (error) {
      console.error("[WS] Error de conexion:", error);
    };
  }

  function scheduleReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    reconnectTimeout = setTimeout(function () {
      currentDelay = Math.min(currentDelay * 1.5, MAX_RECONNECT_DELAY);
      connect();
    }, currentDelay);
  }

  function on(eventType, handler) {
    if (!handlers[eventType]) {
      handlers[eventType] = [];
    }
    handlers[eventType].push(handler);
  }

  function off(eventType, handler) {
    if (!handlers[eventType]) return;

    if (handler) {
      handlers[eventType] = handlers[eventType].filter(function (h) {
        return h !== handler;
      });
    } else {
      handlers[eventType] = [];
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (ws) {
      ws.close();
      ws = null;
    }

    handlers = {};
  }

  window.SgpWebSocket = {
    connect: connect,
    disconnect: disconnect,
    on: on,
    off: off
  };
})();
