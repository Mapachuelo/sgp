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

function clientDocument(title, stylesheetPath, body, scriptPath) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="${stylesheetPath}" />
  </head>
  <body>
    ${body}
    <script src="${scriptPath}"></script>
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
<header class="topbar">
  <a class="brand" href="/ui/client">Prueba</a>
  <nav class="topbar-actions">
    <a class="btn ghost" href="/ui/client/calendar">Ver calendario</a>
    <button id="navLoginBtn" class="btn accent" type="button">Login</button>
    <button id="navLogoutBtn" class="btn ghost hidden" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="dashboard-wrap">
  <section class="hero panel">
    <p class="eyebrow">Gestion para clientes</p>
    <h1>Reserva tu cita en menos pasos</h1>
    <p>
      Este dashboard sigue el flujo del diagrama: ingresar al sitio, validar acceso,
      revisar cupos del calendario y avanzar a reserva.
    </p>
    <div class="hero-actions">
      <a class="btn accent" href="/ui/client/calendar">Ver calendario</a>
      <button id="loadProfileBtn" class="btn ghost" type="button">Validar sesion</button>
    </div>
    <p id="authBadge" class="badge">Sesion no iniciada</p>
  </section>

  <section id="loginSection" class="auth-grid">
    <article id="registerCard" class="panel">
      <h2>Registro cliente</h2>
      <label>Nombre</label>
      <input id="registerName" type="text" placeholder="Nombre completo" />
      <label>Email</label>
      <input id="registerEmail" type="email" placeholder="nombre@email.com" />
      <label>Telefono</label>
      <input id="registerPhone" type="text" placeholder="+56 9 1234 5678" />
      <label>Password</label>
      <input id="registerPassword" type="password" placeholder="Minimo 6 caracteres" />
      <button id="registerBtn" class="btn accent block" type="button">Crear cuenta</button>
    </article>

    <article class="panel">
      <h2>Login cliente</h2>
      <label>Email</label>
      <input id="loginEmail" type="email" placeholder="nombre@email.com" />
      <label>Password</label>
      <input id="loginPassword" type="password" placeholder="Tu password" />
      <button id="loginBtn" class="btn accent block" type="button">Iniciar sesion</button>
      <button id="goCalendarBtn" class="btn ghost block" type="button">Ir al calendario</button>
    </article>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>Cupos de referencia</h2>
      <div class="inline-actions">
        <input id="availabilityDate" type="date" />
        <button id="availabilityBtn" class="btn ghost" type="button">Actualizar</button>
      </div>
    </div>
    <ul id="availabilityList" class="availability-list"></ul>
  </section>

  <section class="panel feedback-panel">
    <p id="dashboardFeedback" class="feedback info">Listo para conectar con el backend.</p>
    <pre id="apiOutput"></pre>
  </section>
</main>
`;

  return clientDocument(
    "SGP - Dashboard Cliente",
    "/ui-assets/styles/client-dashboard.css",
    body,
    "/ui-assets/scripts/client-dashboard.js"
  );
}

function clientCalendarView() {
  const body = `
<header class="topbar">
  <a class="brand" href="/ui/client">Prueba</a>
  <nav class="topbar-actions">
    <a class="btn ghost" href="/ui/client">Dashboard</a>
    <button id="navLoginBtn" class="btn accent" type="button">Login</button>
    <button id="navLogoutBtn" class="btn ghost hidden" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="calendar-layout">
  <section class="calendar-main panel">
    <div class="calendar-title-wrap">
      <h1>Calendario de disponibilidad</h1>
      <p>Visualiza cupos, selecciona horario y confirma reserva.</p>
    </div>

    <div class="calendar-toolbar">
      <label for="weekStart">Inicio del rango</label>
      <input id="weekStart" type="date" />
      <button id="refreshCalendarBtn" class="btn ghost" type="button">Actualizar calendario</button>
    </div>

    <div class="legend-row">
      <span class="legend available">Disponible</span>
      <span class="legend reserved">Reservado</span>
    </div>

    <div class="calendar-shell">
      <table>
        <thead id="calendarHead"></thead>
        <tbody id="calendarBody"></tbody>
      </table>
    </div>
  </section>

  <aside class="booking-panel panel">
    <h2>Ingreso de reserva</h2>
    <p id="selectedSlotText" class="selected-slot">Selecciona un horario disponible.</p>

    <label>Servicio</label>
    <input id="serviceName" type="text" placeholder="Corte, Barba, Color" />

    <label>Peluquero</label>
    <select id="stylistName">
      <option value="">Selecciona un peluquero</option>
      <option value="Paola">Paola</option>
      <option value="Sergio">Sergio</option>
      <option value="Camila">Camila</option>
      <option value="Max">Max</option>
    </select>

    <label>Cantidad de clientes</label>
    <input id="clientCount" type="number" min="1" value="1" />

    <button id="reserveBtn" class="btn accent block" type="button" disabled>Confirmar reserva</button>
    <button id="myReservationsBtn" class="btn ghost block" type="button">Mis reservas</button>
    <a id="goLoginLink" class="inline-link hidden" href="/ui/client#loginSection">Ir a login</a>

    <p id="calendarFeedback" class="feedback info">Puedes revisar cupos sin iniciar sesion.</p>
    <img id="qrImage" class="qr-image hidden" alt="QR de reserva" />

    <h3>Mis ultimas reservas</h3>
    <ul id="myReservationsList" class="reservations-list"></ul>
  </aside>
</main>

<section class="panel api-output-panel">
  <h2>Salida API</h2>
  <pre id="apiOutput"></pre>
</section>
`;

  return clientDocument(
    "SGP - Calendario Cliente",
    "/ui-assets/styles/client-calendar.css",
    body,
    "/ui-assets/scripts/client-calendar.js"
  );
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
  clientCalendarView,
  employeeView,
  adminView
};
