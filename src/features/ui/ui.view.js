function baseDocument(title, body, script = "") {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <h1>${title}</h1>
    <p><a href="/">Inicio</a></p>
    ${body}
    <hr />
    <h3>Salida</h3>
    <pre id="output"></pre>
    <script>
${script}
    </script>
  </body>
</html>`;
}

function commonScript(roleKey) {
  return `
const TOKEN_KEY = "${roleKey}_token";

function setOutput(data) {
  document.getElementById("output").textContent = JSON.stringify(data, null, 2);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

async function callApi(path, method, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  setOutput(data);
  return data;
}

function byId(id) {
  return document.getElementById(id);
}
`;
}

function homeView() {
  const body = `
    <p>Demostracion funcional sin CSS del Sistema de Gestion de Peluqueria.</p>
    <ul>
      <li><a href="/ui/client">Modulo Cliente</a></li>
      <li><a href="/ui/employee">Modulo Empleado</a></li>
      <li><a href="/ui/admin">Modulo Administrador</a></li>
      <li><a href="/health">Health</a></li>
    </ul>
  `;

  return baseDocument("SGP - Inicio", body);
}

function clientView() {
  const body = `
<section>
  <h2>Registro cliente</h2>
  <input id="c_name" placeholder="Nombre" />
  <input id="c_email" placeholder="Email" />
  <input id="c_phone" placeholder="Telefono" />
  <input id="c_password" placeholder="Password" type="password" />
  <button id="registerBtn">Registrar</button>
</section>
<section>
  <h2>Login cliente</h2>
  <input id="l_email" placeholder="Email" />
  <input id="l_password" placeholder="Password" type="password" />
  <button id="loginBtn">Login</button>
  <button id="meBtn">Ver mi perfil</button>
</section>
<section>
  <h2>Actualizar perfil</h2>
  <input id="u_name" placeholder="Nuevo nombre" />
  <input id="u_phone" placeholder="Nuevo telefono" />
  <button id="updateProfileBtn">Actualizar perfil</button>
  <button id="deleteProfileBtn">Eliminar perfil</button>
</section>
<section>
  <h2>Reservar cita</h2>
  <input id="r_service" placeholder="Servicio" />
  <input id="r_stylist" placeholder="Peluquero" />
  <input id="r_startsAt" placeholder="2026-12-30T14:00:00Z" />
  <input id="r_count" placeholder="Cantidad clientes" value="1" />
  <button id="reserveBtn">Crear reserva</button>
  <button id="myReservationsBtn">Mis reservas</button>
</section>
<section>
  <h2>Disponibilidad</h2>
  <input id="a_date" placeholder="YYYY-MM-DD" />
  <button id="availabilityBtn">Ver cupos ocupados</button>
</section>
<section>
  <h2>Tiempo real</h2>
  <button id="wsBtn">Conectar websocket</button>
</section>
`;

  const script = `${commonScript("client")}
byId("registerBtn").onclick = () => callApi("/api/auth/register", "POST", {
  name: byId("c_name").value,
  email: byId("c_email").value,
  phone: byId("c_phone").value,
  password: byId("c_password").value
});

byId("loginBtn").onclick = async () => {
  const result = await callApi("/api/auth/login", "POST", {
    email: byId("l_email").value,
    password: byId("l_password").value
  });
  if (result.ok) {
    setToken(result.data.token);
  }
};

byId("meBtn").onclick = () => callApi("/api/auth/me", "GET");

byId("updateProfileBtn").onclick = () => callApi("/api/clients/me", "PUT", {
  name: byId("u_name").value,
  phone: byId("u_phone").value
});

byId("deleteProfileBtn").onclick = () => callApi("/api/clients/me", "DELETE");

byId("reserveBtn").onclick = () => callApi("/api/reservations", "POST", {
  serviceName: byId("r_service").value,
  stylistName: byId("r_stylist").value,
  startsAt: byId("r_startsAt").value,
  clientCount: Number(byId("r_count").value || 1)
});

byId("myReservationsBtn").onclick = () => callApi("/api/reservations/me", "GET");

byId("availabilityBtn").onclick = () => callApi("/api/reservations/availability?date=" + encodeURIComponent(byId("a_date").value), "GET");

byId("wsBtn").onclick = () => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(protocol + "//" + location.host + "/ws");
  ws.onmessage = (event) => {
    try {
      setOutput(JSON.parse(event.data));
    } catch (_error) {
      setOutput(event.data);
    }
  };
};`;

  return baseDocument("SGP - Cliente", body, script);
}

function employeeView() {
  const body = `
<section>
  <h2>Login empleado</h2>
  <input id="e_email" placeholder="Email" />
  <input id="e_password" placeholder="Password" type="password" />
  <button id="e_loginBtn">Login</button>
</section>
<section>
  <h2>Operaciones</h2>
  <button id="clientsBtn">Listar clientes</button>
  <button id="reservationsBtn">Listar reservas</button>
</section>
<section>
  <h2>Validar QR</h2>
  <input id="qr_token" placeholder="QR token" />
  <button id="validateQrBtn">Validar ingreso</button>
</section>
<section>
  <h2>Cobro manual</h2>
  <input id="p_reservation" placeholder="Reservation ID" />
  <input id="p_amount" placeholder="Monto" />
  <button id="manualPayBtn">Registrar cobro efectivo</button>
</section>
`;

  const script = `${commonScript("employee")}
byId("e_loginBtn").onclick = async () => {
  const result = await callApi("/api/auth/login", "POST", {
    email: byId("e_email").value,
    password: byId("e_password").value
  });
  if (result.ok) {
    setToken(result.data.token);
  }
};

byId("clientsBtn").onclick = () => callApi("/api/clients", "GET");
byId("reservationsBtn").onclick = () => callApi("/api/reservations", "GET");

byId("validateQrBtn").onclick = () => callApi("/api/checkin/validate", "POST", {
  qrToken: byId("qr_token").value
});

byId("manualPayBtn").onclick = () => callApi("/api/payments/manual", "POST", {
  reservationId: Number(byId("p_reservation").value),
  amount: Number(byId("p_amount").value)
});`;

  return baseDocument("SGP - Empleado", body, script);
}

function adminView() {
  const body = `
<section>
  <h2>Login administrador</h2>
  <input id="a_email" placeholder="Email" />
  <input id="a_password" placeholder="Password" type="password" />
  <button id="a_loginBtn">Login</button>
</section>
<section>
  <h2>Reportes administrativos</h2>
  <input id="r_date" placeholder="YYYY-MM-DD" />
  <button id="salesBtn">Ventas del dia</button>
  <button id="occupancyBtn">Ocupacion del dia</button>
  <button id="recurrentBtn">Clientes recurrentes</button>
</section>
`;

  const script = `${commonScript("admin")}
byId("a_loginBtn").onclick = async () => {
  const result = await callApi("/api/auth/login", "POST", {
    email: byId("a_email").value,
    password: byId("a_password").value
  });
  if (result.ok) {
    setToken(result.data.token);
  }
};

byId("salesBtn").onclick = () => callApi("/api/reports/daily-sales?date=" + encodeURIComponent(byId("r_date").value), "GET");
byId("occupancyBtn").onclick = () => callApi("/api/reports/occupancy?date=" + encodeURIComponent(byId("r_date").value), "GET");
byId("recurrentBtn").onclick = () => callApi("/api/reports/recurrent-clients?limit=20", "GET");`;

  return baseDocument("SGP - Administrador", body, script);
}

module.exports = {
  homeView,
  clientView,
  employeeView,
  adminView
};
