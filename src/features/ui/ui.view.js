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
    <select id="serviceName">
      <option value="">Selecciona un servicio</option>
    </select>

    <label>Peluquero</label>
    <select id="stylistName">
      <option value="__any__">Cualquier peluquero</option>
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
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/employee">Prueba</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/employee">Dashboard</a>
    <a class="emp-btn ghost" href="/ui/employee/calendar">Calendario</a>
    <a class="emp-btn ghost" href="/ui/employee/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/employee/validate-qr">Validacion QR</a>
    <a id="adminAccessLink" class="emp-btn ghost hidden" href="/ui/admin">Gestion empleados</a>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="emp-dashboard-wrap">
  <section class="emp-panel hero">
    <p class="eyebrow">Sitio web empleado</p>
    <h1>Panel de control de empleados</h1>
    <p>Gestiona reservas, calendario de disponibilidad y valida ingresos con QR.</p>
    <div class="hero-actions">
      <a class="emp-btn solid" href="/ui/employee/calendar">Abrir calendario</a>
      <a class="emp-btn ghost" href="/ui/employee/verify-clients">Verificar clientes</a>
    </div>
    <p id="sessionBadge" class="badge">Sesion no iniciada</p>
  </section>

  <section id="loginCard" class="emp-panel login-card">
    <h2>Ingreso de empleado</h2>
    <label>Email</label>
    <input id="loginEmail" type="email" placeholder="empleado@email.com" />
    <label>Password</label>
    <input id="loginPassword" type="password" placeholder="Tu password" />
    <button id="loginBtn" class="emp-btn solid block" type="button">Iniciar sesion</button>
    <p class="help-text">Solo cuentas con rol empleado pueden acceder a las secciones.</p>
  </section>

  <section class="emp-panel stats-grid">
    <article>
      <h3>Reservas activas</h3>
      <p id="activeReservationsCount">-</p>
    </article>
    <article>
      <h3>Clientes registrados</h3>
      <p id="clientsCount">-</p>
    </article>
    <article>
      <h3>Check-in hoy</h3>
      <p id="todayCheckinCount">-</p>
    </article>
  </section>

  <section class="emp-panel feedback-wrap">
    <p id="dashboardFeedback" class="feedback info">Conecta tu sesion para sincronizar datos.</p>
    <pre id="apiOutput"></pre>
  </section>
</main>
`;

  return clientDocument(
    "SGP - Empleado Dashboard",
    "/ui-assets/styles/employee-dashboard.css",
    body,
    "/ui-assets/scripts/employee-dashboard.js"
  );
}

function employeeCalendarView() {
  const body = `
<header class="topbar">
  <a class="brand" href="/ui/employee">Prueba</a>
  <nav class="topbar-actions">
    <a class="btn ghost" href="/ui/employee">Dashboard</a>
    <a class="btn ghost" href="/ui/employee/verify-clients">Verificar cliente</a>
    <a class="btn ghost" href="/ui/employee/validate-qr">Validacion QR</a>
    <button id="navLogoutBtn" class="btn ghost" type="button">Cerrar sesion</button>
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
    <select id="serviceName">
      <option value="">Selecciona un servicio</option>
    </select>

    <label>Peluquero</label>
    <select id="stylistName">
      <option value="__any__">Cualquier peluquero</option>
    </select>

    <label>Cantidad de clientes</label>
    <input id="clientCount" type="number" min="1" value="1" />

    <button id="reserveBtn" class="btn accent block" type="button" disabled>Confirmar reserva</button>
    <button id="myReservationsBtn" class="btn ghost block hidden" type="button">Mis reservas</button>

    <p id="calendarFeedback" class="feedback info">Calendario sincronizado para rol empleado.</p>
    <img id="qrImage" class="qr-image hidden" alt="QR de reserva" />

    <h3>Ultimas reservas</h3>
    <ul id="myReservationsList" class="reservations-list"></ul>
  </aside>
</main>

<section class="panel api-output-panel">
  <h2>Salida API</h2>
  <pre id="apiOutput"></pre>
</section>
`;

  return clientDocument(
    "SGP - Calendario Empleado",
    "/ui-assets/styles/client-calendar.css",
    body,
    "/ui-assets/scripts/client-calendar.js"
  );
}

function employeeVerifyClientsView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/employee">Prueba</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/employee">Dashboard</a>
    <a class="emp-btn ghost" href="/ui/employee/calendar">Calendario</a>
    <a class="emp-btn ghost" href="/ui/employee/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/employee/validate-qr">Validacion QR</a>
    <a id="adminAccessLink" class="emp-btn ghost hidden" href="/ui/admin">Gestion empleados</a>
    <button id="logoutBtn" class="emp-btn ghost hidden" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="verify-layout">
  <section class="emp-panel verify-main">
    <div class="panel-head">
      <h1>Verificar clientes</h1>
      <div class="inline-controls">
        <label for="weekStart">Semana</label>
        <input id="weekStart" type="date" />
        <button id="reloadBtn" class="emp-btn ghost" type="button">Actualizar</button>
      </div>
    </div>
    <p class="helper">Horario de 06:00 a 22:00 en bloques de 30 minutos.</p>
    <div class="calendar-shell">
      <table>
        <thead id="verifyHead"></thead>
        <tbody id="verifyBody"></tbody>
      </table>
    </div>
  </section>

  <aside class="emp-panel config-panel">
    <h2>Configuracion laboral</h2>
    <p>Define dias no laborales y rango de trabajo por dia.</p>
    <div id="workConfigList" class="config-list"></div>
    <button id="saveConfigBtn" class="emp-btn solid block" type="button">Guardar configuracion</button>
    <button id="resetConfigBtn" class="emp-btn ghost block" type="button">Restablecer</button>
    <p id="verifyFeedback" class="feedback info">La configuracion se guarda localmente en el navegador.</p>
  </aside>
</main>

<section class="emp-panel output-panel">
  <h2>Salida API</h2>
  <pre id="apiOutput"></pre>
</section>
`;

  return clientDocument(
    "SGP - Verificar Clientes",
    "/ui-assets/styles/employee-verify-clients.css",
    body,
    "/ui-assets/scripts/employee-verify-clients.js"
  );
}

function employeeValidateQrView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/employee">Prueba</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/employee">Dashboard</a>
    <a class="emp-btn ghost" href="/ui/employee/calendar">Calendario</a>
    <a class="emp-btn ghost" href="/ui/employee/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/employee/validate-qr">Validacion QR</a>
    <a id="adminAccessLink" class="emp-btn ghost hidden" href="/ui/admin">Gestion empleados</a>
    <button id="logoutBtn" class="emp-btn ghost hidden" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="qr-layout">
  <section class="emp-panel scanner-panel">
    <h1>Validacion QR</h1>
    <p class="helper">Solo empleado autenticado puede validar el ingreso.</p>
    <div class="camera-box">
      <video id="cameraPreview" autoplay playsinline muted></video>
    </div>
    <div class="scan-actions">
      <button id="startScanBtn" class="emp-btn solid" type="button">Iniciar camara</button>
      <button id="stopScanBtn" class="emp-btn ghost" type="button" disabled>Detener</button>
    </div>
  </section>

  <aside class="emp-panel side-panel">
    <h2>Validacion manual</h2>
    <label>Token QR</label>
    <input id="qrTokenInput" type="text" placeholder="Pega o escanea el token" />
    <button id="validateBtn" class="emp-btn solid block" type="button">Validar ingreso</button>
    <p id="qrFeedback" class="feedback info">Esperando lectura de QR.</p>
    <h3>Ultima validacion</h3>
    <div id="lastValidationCard" class="last-validation">Sin validaciones recientes.</div>
  </aside>
</main>

<section class="emp-panel output-panel">
  <h2>Salida API</h2>
  <pre id="apiOutput"></pre>
</section>
`;

  return clientDocument(
    "SGP - Validacion QR",
    "/ui-assets/styles/employee-validate-qr.css",
    body,
    "/ui-assets/scripts/employee-validate-qr.js"
  );
}

function adminView() {
  const body = `
<header class="admin-topbar">
  <a class="admin-brand" href="/ui/admin">Prueba</a>
  <nav class="admin-nav">
    <a class="admin-btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="admin-btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="admin-btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <button id="logoutBtn" class="admin-btn ghost hidden" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="admin-layout">
  <section class="admin-panel form-panel">
    <h1>Ingreso empleado y administrador</h1>
    <p class="helper">Solo administradores pueden registrar usuarios internos.</p>

    <div id="loginCard" class="login-card">
      <h2>Login administrador</h2>
      <label>Email</label>
      <input id="adminEmail" type="email" placeholder="admin@sgp.local" />
      <label>Password</label>
      <input id="adminPassword" type="password" placeholder="Tu password" />
      <button id="loginBtn" class="admin-btn solid block" type="button">Iniciar sesion</button>
    </div>

    <form id="employeeForm" class="hidden">
      <label>Rol</label>
      <select id="role">
        <option value="employee">Empleado</option>
        <option value="admin">Administrador</option>
      </select>
      <label>Nombre</label>
      <input id="firstName" type="text" placeholder="Nombre" />
      <label>Apellido</label>
      <input id="lastName" type="text" placeholder="Apellido" />
      <label>Numero</label>
      <input id="phone" type="text" placeholder="Numero de telefono" />
      <label>Identificacion</label>
      <input id="identification" type="text" placeholder="ID empleado" />
      <label>Correo</label>
      <input id="email" type="email" placeholder="correo@dominio.com" />
      <label>Password asignada</label>
      <input id="password" type="text" placeholder="Minimo 6 caracteres" />
      <button id="createEmployeeBtn" class="admin-btn solid block" type="submit">Agregar empleado</button>
    </form>

    <p id="adminFeedback" class="feedback info">Inicia sesion para administrar empleados.</p>

    <hr />
    <h2>Servicios disponibles</h2>
    <label>Nuevo servicio</label>
    <input id="serviceNameInput" type="text" placeholder="Corte clasico" />
    <button id="addServiceBtn" class="admin-btn ghost block" type="button">Agregar servicio</button>
    <ul id="servicesList"></ul>
  </section>

  <section class="admin-panel list-panel">
    <div class="list-head">
      <h2>Lista registrados</h2>
      <button id="refreshEmployeesBtn" class="admin-btn ghost" type="button">Actualizar</button>
    </div>
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>Numero</th>
            <th>Identificacion</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Password</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody id="employeesTableBody"></tbody>
      </table>
    </div>
    <p id="tempPasswordHint" class="temp-password hidden"></p>
  </section>
</main>

<section class="admin-panel output-panel">
  <h2>Salida API</h2>
  <pre id="apiOutput"></pre>
</section>
`;

  return clientDocument(
    "SGP - Administrador Empleados",
    "/ui-assets/styles/admin-add-employee.css",
    body,
    "/ui-assets/scripts/admin-add-employee.js"
  );
}

function adminCalendarView() {
  const body = `
<header class="topbar">
  <a class="brand" href="/ui/admin">Prueba</a>
  <nav class="topbar-actions">
    <a class="btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <button id="navLogoutBtn" class="btn ghost" type="button">Cerrar sesion</button>
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
    <select id="serviceName">
      <option value="">Selecciona un servicio</option>
    </select>

    <label>Peluquero</label>
    <select id="stylistName">
      <option value="__any__">Cualquier peluquero</option>
    </select>

    <label>Cantidad de clientes</label>
    <input id="clientCount" type="number" min="1" value="1" />

    <button id="reserveBtn" class="btn accent block" type="button" disabled>Confirmar reserva</button>
    <button id="myReservationsBtn" class="btn ghost block hidden" type="button">Mis reservas</button>

    <p id="calendarFeedback" class="feedback info">Calendario sincronizado para rol administrador.</p>
    <img id="qrImage" class="qr-image hidden" alt="QR de reserva" />

    <h3>Ultimas reservas</h3>
    <ul id="myReservationsList" class="reservations-list"></ul>
  </aside>
</main>

<section class="panel api-output-panel">
  <h2>Salida API</h2>
  <pre id="apiOutput"></pre>
</section>
`;

  return clientDocument(
    "SGP - Calendario Administrador",
    "/ui-assets/styles/client-calendar.css",
    body,
    "/ui-assets/scripts/client-calendar.js"
  );
}

function adminVerifyClientsView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/admin">Prueba</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="emp-btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="verify-layout">
  <section class="emp-panel verify-main">
    <div class="panel-head">
      <h1>Verificar clientes</h1>
      <div class="inline-controls">
        <label for="weekStart">Semana</label>
        <input id="weekStart" type="date" />
        <button id="reloadBtn" class="emp-btn ghost" type="button">Actualizar</button>
      </div>
    </div>
    <p class="helper">Horario de 06:00 a 22:00 en bloques de 30 minutos.</p>
    <div class="calendar-shell">
      <table>
        <thead id="verifyHead"></thead>
        <tbody id="verifyBody"></tbody>
      </table>
    </div>
  </section>

  <aside class="emp-panel config-panel">
    <h2>Configuracion laboral</h2>
    <p>Define dias no laborales y rango de trabajo por dia.</p>
    <div id="workConfigList" class="config-list"></div>
    <button id="saveConfigBtn" class="emp-btn solid block" type="button">Guardar configuracion</button>
    <button id="resetConfigBtn" class="emp-btn ghost block" type="button">Restablecer</button>
    <p id="verifyFeedback" class="feedback info">La configuracion se guarda localmente en el navegador.</p>
  </aside>
</main>

<section class="emp-panel output-panel">
  <h2>Salida API</h2>
  <pre id="apiOutput"></pre>
</section>
`;

  return clientDocument(
    "SGP - Administrador Verificar Clientes",
    "/ui-assets/styles/employee-verify-clients.css",
    body,
    "/ui-assets/scripts/employee-verify-clients.js"
  );
}

function adminValidateQrView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/admin">Prueba</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="emp-btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <button id="logoutBtn" class="emp-btn ghost hidden" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="qr-layout">
  <section class="emp-panel scanner-panel">
    <h1>Validacion QR</h1>
    <p class="helper">Solo administrador autenticado puede validar el ingreso.</p>
    <div class="camera-box">
      <video id="cameraPreview" autoplay playsinline muted></video>
    </div>
    <div class="scan-actions">
      <button id="startScanBtn" class="emp-btn solid" type="button">Iniciar camara</button>
      <button id="stopScanBtn" class="emp-btn ghost" type="button" disabled>Detener</button>
    </div>
  </section>

  <aside class="emp-panel side-panel">
    <h2>Validacion manual</h2>
    <label>Token QR</label>
    <input id="qrTokenInput" type="text" placeholder="Pega o escanea el token" />
    <button id="validateBtn" class="emp-btn solid block" type="button">Validar ingreso</button>
    <p id="qrFeedback" class="feedback info">Esperando lectura de QR.</p>
    <h3>Ultima validacion</h3>
    <div id="lastValidationCard" class="last-validation">Sin validaciones recientes.</div>
  </aside>
</main>

<section class="emp-panel output-panel">
  <h2>Salida API</h2>
  <pre id="apiOutput"></pre>
</section>
`;

  return clientDocument(
    "SGP - Administrador Validacion QR",
    "/ui-assets/styles/employee-validate-qr.css",
    body,
    "/ui-assets/scripts/employee-validate-qr.js"
  );
}

module.exports = {
  homeView,
  clientView,
  clientCalendarView,
  employeeView,
  employeeCalendarView,
  employeeVerifyClientsView,
  employeeValidateQrView,
  adminView,
  adminCalendarView,
  adminVerifyClientsView,
  adminValidateQrView
};
