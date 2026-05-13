function clientDocument(title, stylesheetPath, body, scriptPath, bodyClass = "") {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SGP</title>
    <link rel="stylesheet" href="${stylesheetPath}" />
  </head>
  <body${bodyClass ? ` class="${bodyClass}"` : ""}>
    ${body}
    <div id="wsToast" class="ws-toast hidden" role="status" aria-live="polite"></div>
    <script>
      (function () {
        function ensureToggle(headerSelector, navSelector, buttonClassName) {
          document.querySelectorAll(headerSelector).forEach(function (header) {
            var nav = header.querySelector(navSelector);
            if (!nav || header.querySelector(".js-nav-toggle")) {
              return;
            }

            var toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = buttonClassName + " nav-toggle hamburger-toggle js-nav-toggle";
            toggle.textContent = "Menu";
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Mostrar navegacion");

            header.insertBefore(toggle, nav);

            toggle.addEventListener("click", function () {
              var isOpen = nav.classList.toggle("is-open");
              toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
              toggle.setAttribute("aria-label", isOpen ? "Ocultar navegacion" : "Mostrar navegacion");
            });

            nav.addEventListener("click", function (event) {
              if (window.innerWidth >= 768) {
                return;
              }

              var target = event.target;
              if (!(target instanceof HTMLElement)) {
                return;
              }

              if (!target.closest("a, button")) {
                return;
              }

              nav.classList.remove("is-open");
              toggle.setAttribute("aria-expanded", "false");
              toggle.setAttribute("aria-label", "Mostrar navegacion");
            });
          });
        }

        function syncDesktopState() {
          if (window.innerWidth < 768) {
            return;
          }

          document.querySelectorAll(".js-nav-toggle").forEach(function (toggle) {
            var nav = toggle.nextElementSibling;
            if (!nav) {
              return;
            }

            nav.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
          });
        }

        ensureToggle(".topbar", ".topbar-actions", "btn ghost");
        ensureToggle(".emp-topbar", ".emp-nav", "emp-btn ghost");
        ensureToggle(".admin-topbar", ".admin-nav", "admin-btn ghost");
        ensureToggle(".main-topbar", ".main-actions", "main-btn");

        syncDesktopState();
        window.addEventListener("resize", syncDesktopState);
      })();
    </script>
    <script src="/ui-assets/scripts/ws-client.js"></script>
${Array.isArray(scriptPath) ? scriptPath.map(function (s) { return '    <script src="' + s + '"></script>'; }).join("\n") : '    <script src="' + scriptPath + '"></script>'}
  </body>
</html>`;
}

function homeView() {
  const body = `
<header class="topbar">
  <a class="brand" href="/">SGP</a>
  <nav class="topbar-actions">
    <a class="btn ghost" href="/ui/client/calendar">Ver calendario</a>
    <a class="btn accent" href="/ui/login">Iniciar sesion</a>
  </nav>
</header>

<main class="dashboard-wrap home-shell" aria-label="inicio-principal">
  <section class="hero panel">
    <p class="eyebrow">Bienvenido a SGP</p>
    <h1>Tu estilo, nuestro compromiso</h1>
    <p>
      <!-- EDITAR AQUI: Descripción principal de la página de inicio -->
      Reserva tu cita de manera rápida y sencilla. Explora nuestro calendario, selecciona el servicio que necesitas y encuentra al profesional ideal para ti.
    </p>
    <div class="hero-actions">
      <a class="btn accent" href="/ui/client/calendar">Ver calendario</a>
      <a class="btn ghost" href="/ui/login">Iniciar sesion</a>
    </div>
  </section>

  <section class="info-grid">
    <article class="info-card panel">
      <h3>Como funciona</h3>
      <p>
        <!-- EDITAR AQUI: Explicación del proceso de reserva -->
        1. Inicia sesión o crea tu cuenta. 2. Explora el calendario y selecciona un horario disponible. 3. Elige tu servicio y confirma tu reserva.
      </p>
    </article>

    <article class="info-card panel">
      <h3>Nuestros servicios</h3>
      <p>
        <!-- EDITAR AQUI: Lista de servicios ofrecidos -->
        Cortes, coloración, tratamientos capilares y más. Consulta la disponibilidad de cada servicio en el calendario.
      </p>
    </article>

    <article class="info-card panel">
      <h3>Horarios de atención</h3>
      <p>
        <!-- EDITAR AQUI: Horarios de atención del negocio -->
        Lunes a Sábado: 8:00 AM - 8:00 PM. Domingos y festivos: Cerrado.
      </p>
    </article>
  </section>
</main>
  `;

  return clientDocument(
    "SGP - Inicio",
    "/ui-assets/styles/client-dashboard.css",
    body,
    "/ui-assets/scripts/main-dashboard.js",
    "home-page"
  );
}

function loginView() {
  const body = `
<header class="topbar">
  <a class="brand" href="/">SGP</a>
  <nav class="topbar-actions">
    <a class="btn ghost" href="/ui/client/calendar">Ver calendario</a>
    <a class="btn ghost" href="/ui/client">Volver</a>
  </nav>
</header>

<main class="dashboard-wrap login-wrap">
  <section class="panel login-panel">
    <p class="eyebrow">Acceso al sistema</p>
    <h1>Iniciar sesion</h1>

    <label>Correo</label>
    <input id="loginEmail" type="email" placeholder="correo@dominio.com" />

    <label>Contraseña</label>
    <input id="loginPassword" type="password" placeholder="Tu contraseña" />

    <button id="loginBtn" class="btn accent block" type="button">Entrar</button>

    <button id="openRegisterBtn" class="btn ghost block" type="button">Crear nueva cuenta de cliente</button>

    <p id="loginFeedback" class="feedback warn hidden"></p>
  </section>

  <div id="registerModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="registerTitle">
    <div class="modal-card">
      <div class="modal-head">
        <h2 id="registerTitle">Crear nueva cuenta (cliente)</h2>
        <button id="closeRegisterBtn" class="btn ghost" type="button">Cerrar</button>
      </div>

      <p id="registerFeedback" class="feedback info">Completa los datos y revisa el mensaje si alguna casilla falla.</p>

      <label>Nombre</label>
      <input id="registerFirstName" type="text" placeholder="Nombre" />

      <label>Apellido</label>
      <input id="registerLastName" type="text" placeholder="Apellido" />

      <label>Numero</label>
      <input id="registerPhone" type="text" placeholder="+573001234567" />

      <label>Correo</label>
      <input id="registerEmail" type="email" placeholder="correo@dominio.com" />

      <label>Contraseña</label>
      <input id="registerPassword" type="password" placeholder="Mínimo 6 caracteres" />

      <div class="modal-actions">
        <button id="cancelRegisterBtn" class="btn ghost" type="button">Cancelar</button>
        <button id="registerBtn" class="btn accent" type="button">Crear cuenta</button>
      </div>
    </div>
  </div>
</main>
  `;

    return clientDocument(
      "SGP - Iniciar sesion",
    "/ui-assets/styles/client-dashboard.css",
    body,
    "/ui-assets/scripts/main-dashboard.js"
  );
}

function clientView() {
  const body = `
<header class="topbar">
  <a class="brand" href="/ui/client">SGP</a>
  <nav class="topbar-actions">
    <a class="btn ghost" href="/ui/client/calendar">Ver calendario</a>
    <button id="openProfileEditBtn" class="btn ghost hidden" type="button">Editar cuenta</button>
    <button id="navLoginBtn" class="btn accent" type="button">Iniciar sesion</button>
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
    </div>
    <p id="authBadge" class="badge">Sesion no iniciada</p>
  </section>
</main>

<div id="clientProfileModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="clientProfileTitle">
  <div class="modal-card">
    <div class="modal-head">
      <h2 id="clientProfileTitle">Editar perfil de cliente</h2>
      <button id="closeProfileEditBtn" class="btn ghost" type="button">Cerrar</button>
    </div>

    <label>Nombre</label>
    <input id="clientProfileFirstName" type="text" placeholder="Nombre" />

    <label>Apellido</label>
    <input id="clientProfileLastName" type="text" placeholder="Apellido" />

    <label>Numero</label>
    <input id="clientProfilePhone" type="text" placeholder="+573001234567" />

    <label>Correo</label>
    <input id="clientProfileEmail" type="email" placeholder="correo@dominio.com" />

    <label>Contraseña</label>
    <input id="clientProfilePassword" type="password" placeholder="Mínimo 6 caracteres" />

    <p class="feedback info">Para guardar cambios debes completar todos los campos.</p>

    <div class="modal-actions">
      <button id="cancelProfileEditBtn" class="btn ghost" type="button">Cancelar</button>
      <button id="saveProfileEditBtn" class="btn accent" type="button">Guardar cambios</button>
    </div>
  </div>
</div>
`;

  return clientDocument(
    "SGP - Inicio Cliente",
    "/ui-assets/styles/client-dashboard.css",
    body,
    "/ui-assets/scripts/client-dashboard.js"
  );
}

function clientCalendarView() {
  const body = `
<header class="topbar">
  <a class="brand" href="/ui/client">SGP</a>
  <nav class="topbar-actions">
    <a class="btn ghost" href="/ui/client">Inicio</a>
    <button id="openProfileEditBtn" class="btn ghost hidden" type="button">Editar cuenta</button>
    <button id="navLoginBtn" class="btn accent" type="button">Iniciar sesion</button>
    <button id="navLogoutBtn" class="btn ghost hidden" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="calendar-layout">
  <!-- CALENDAR MAIN SECTION (Primary Display) -->
  <section class="calendar-main panel">
    <div class="calendar-title-wrap">
      <h1>Disponibilidad por hora</h1>
      <p>Selecciona una fecha y hora disponible para agendar</p>
    </div>

    <div class="calendar-toolbar">
      <label for="weekStart">Semana</label>
      <input id="weekStart" type="date" />
      <div class="employee-dropdown">
        <button id="employeeDropdownBtn" type="button" class="btn ghost">Seleccionar empleado</button>
        <div id="employeeDropdownList" class="dropdown-list hidden"></div>
      </div>
      <label for="slotIntervalSelect">Intervalo</label>
      <select id="slotIntervalSelect">
        <option value="15">15 min</option>
        <option value="30" selected>30 min</option>
        <option value="45">45 min</option>
        <option value="60">1 hora</option>
        <option value="90">1h 30min</option>
        <option value="120">2 horas</option>
      </select>
      <p id="slotSelectionBadge" class="slot-selection-badge">Sin horario seleccionado</p>
    </div>

    <div class="legend-row">
      <span class="legend available">Disponible</span>
      <span class="legend reserved">Ocupado</span>
      <span class="legend off-day">Cerrado</span>
    </div>

    <div class="calendar-shell">
      <table>
        <thead id="calendarHead"></thead>
        <tbody id="calendarBody"></tbody>
      </table>
    </div>
  </section>
</main>

<!-- BOOKING MODAL (Floating Window for All Reservations) -->
<div id="bookingModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="bookingModalTitle">
  <div class="modal-card booking-modal-card">
    <div class="modal-head">
      <h2 id="bookingModalTitle">Confirmar reserva</h2>
      <button id="closeBookingModalBtn" class="btn ghost" type="button">✕</button>
    </div>

    <div class="modal-body">
      <p id="selectedSlotText" class="selected-slot">Horario seleccionado</p>

      <label for="bookingStylistName">Peluquero</label>
      <select id="bookingStylistName">
        <option value="__any__">Selecciona al empleado</option>
      </select>

      <label for="bookingServiceName">Servicio</label>
      <select id="bookingServiceName">
        <option value="">Selecciona un servicio</option>
      </select>

      <label for="bookingClientCount">Cantidad de personas</label>
      <input id="bookingClientCount" type="number" min="1" max="5" value="1" />

      <p id="bookingTimeEstimate" class="time-estimate-info hidden"></p>
      <p id="bookingError" class="feedback warn hidden"></p>
      <p id="calendarFeedback" class="feedback info">Inicia sesión para confirmar la reserva</p>
      <a id="goLoginLink" class="inline-link hidden" href="/ui/login">Ir a iniciar sesión</a>
    </div>

    <div class="modal-actions">
      <button id="myReservationsBtn" class="btn ghost" type="button">Mis reservas</button>
      <button id="confirmBookingBtn" class="btn accent" type="button" disabled>Confirmar</button>
    </div>
  </div>
</div>

<div id="myReservationsModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="myReservationsModalTitle">
  <div class="modal-card reservations-modal-card">
    <div class="modal-head">
      <h3 id="myReservationsModalTitle">Mis reservas</h3>
      <div class="modal-head-actions">
        <button id="purgeMyReservationsBtn" class="btn ghost" type="button">Borrar canceladas/tardadas</button>
        <button id="closeMyReservationsModalBtn" class="btn ghost" type="button">Cerrar</button>
      </div>
    </div>
    <ul id="myReservationsList" class="reservations-list"></ul>
  </div>
</div>

<div id="clientProfileModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="clientProfileTitle">
  <div class="modal-card">
    <div class="modal-head">
      <h2 id="clientProfileTitle">Editar perfil de cliente</h2>
      <button id="closeProfileEditBtn" class="btn ghost" type="button">Cerrar</button>
    </div>

    <label>Nombre</label>
    <input id="clientProfileFirstName" type="text" placeholder="Nombre" />

    <label>Apellido</label>
    <input id="clientProfileLastName" type="text" placeholder="Apellido" />

    <label>Numero</label>
    <input id="clientProfilePhone" type="text" placeholder="+573001234567" />

    <label>Correo</label>
    <input id="clientProfileEmail" type="email" placeholder="correo@dominio.com" />

    <label>Contraseña</label>
    <input id="clientProfilePassword" type="password" placeholder="Mínimo 6 caracteres" />

      <p id="clientProfileFeedback" class="feedback info">Para guardar cambios debes completar todos los campos.</p>

    <div class="modal-actions">
      <button id="cancelProfileEditBtn" class="btn ghost" type="button">Cancelar</button>
      <button id="saveProfileEditBtn" class="btn accent" type="button">Guardar cambios</button>
    </div>
  </div>
</div>
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
  <a class="emp-brand" href="/ui/empleado">SGP</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/empleado">Inicio</a>
    <a class="emp-btn ghost" href="/ui/empleado/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/empleado/validate-qr">Validacion QR</a>
    <button id="openEmployeeAccountBtn" class="emp-btn ghost hidden" type="button">Editar cuenta</button>
    <a id="adminAccessLink" class="emp-btn ghost hidden" href="/ui/admin">Gestion empleados</a>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="emp-dashboard-wrap">
  <section class="emp-panel hero">
    <p class="eyebrow">Sitio web empleado</p>
    <h1>Panel de control de empleados</h1>
    <p>Gestiona clientes asignados y valida ingresos con QR.</p>
    <div class="hero-actions">
      <a class="emp-btn solid" href="/ui/empleado/verify-clients">Verificar clientes</a>
      <a class="emp-btn ghost" href="/ui/empleado/validate-qr">Validar QR</a>
    </div>
    <p id="sessionBadge" class="badge">Sesion activa</p>
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
  </section>
</main>

<div id="employeeAccountModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="employeeAccountTitle">
  <div class="modal-card">
    <div class="modal-head">
      <h2 id="employeeAccountTitle">Editar cuenta de empleado</h2>
      <button id="closeEmployeeAccountBtn" class="emp-btn ghost" type="button">Cerrar</button>
    </div>

    <label>Nombre</label>
    <input id="employeeAccountFirstName" type="text" readonly />

    <label>Apellido</label>
    <input id="employeeAccountLastName" type="text" readonly />

    <label>Numero de documento</label>
    <input id="employeeAccountIdentification" type="text" readonly />

    <label>Numero celular</label>
    <input id="employeeAccountPhone" type="text" placeholder="+573001234567" />

    <label>Correo</label>
    <input id="employeeAccountEmail" type="email" placeholder="Nuevo correo" />

    <label>Contraseña</label>
    <input id="employeeAccountPassword" type="password" placeholder="Mínimo 6 caracteres" />

    <p id="employeeAccountFeedback" class="feedback info">Completa numero celular, correo y password para guardar.</p>

    <div class="modal-actions">
      <button id="cancelEmployeeAccountBtn" class="emp-btn ghost" type="button">Cancelar</button>
      <button id="saveEmployeeAccountBtn" class="emp-btn solid" type="button">Guardar cambios</button>
    </div>
  </div>
</div>
`;

  return clientDocument(
    "SGP - Empleado Inicio",
    "/ui-assets/styles/empleado-dashboard.css",
    body,
    "/ui-assets/scripts/empleado-dashboard.js"
  );
}

function employeeCalendarView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/empleado">SGP</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/empleado">Inicio</a>
    <a class="emp-btn ghost" href="/ui/empleado/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/empleado/validate-qr">Validacion QR</a>
    <a id="adminAccessLink" class="emp-btn ghost hidden" href="/ui/admin">Gestion empleados</a>
    <button id="openEmployeeAccountBtn" class="emp-btn ghost hidden" type="button">Editar cuenta</button>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="calendar-layout">
  <section class="calendar-main panel">
    <div class="calendar-title-wrap">
      <h1>Calendario de disponibilidad</h1>
      <p>Visualiza cupos, horarios ocupados y disponibilidad por peluquero.</p>
    </div>

    <div class="calendar-toolbar">
      <label for="weekStart">Inicio del rango</label>
      <input id="weekStart" type="date" />
      <button id="refreshCalendarBtn" class="emp-btn ghost" type="button">Actualizar calendario</button>
      <p id="slotSelectionBadge" class="slot-selection-badge">Sin horario seleccionado</p>
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
    <input id="clientCount" type="number" min="1" max="5" value="1" />

    <button id="reserveBtn" class="emp-btn solid block hidden" type="button" disabled>Confirmar reserva</button>
    <button id="myReservationsBtn" class="emp-btn ghost block hidden" type="button">Mis reservas</button>

    <p id="calendarFeedback" class="feedback info">Calendario sincronizado para rol empleado.</p>
    <img id="qrImage" class="qr-image hidden" alt="QR de reserva" />

    <h3>Ultimas reservas</h3>
    <ul id="myReservationsList" class="reservations-list"></ul>
  </aside>
</main>

<div id="employeeAccountModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="employeeAccountTitle">
  <div class="modal-card">
    <div class="modal-head">
      <h2 id="employeeAccountTitle">Editar cuenta de empleado</h2>
      <button id="closeEmployeeAccountBtn" class="emp-btn ghost" type="button">Cerrar</button>
    </div>

    <label>Nombre</label>
    <input id="employeeAccountFirstName" type="text" readonly />

    <label>Apellido</label>
    <input id="employeeAccountLastName" type="text" readonly />

    <label>Numero de documento</label>
    <input id="employeeAccountIdentification" type="text" readonly />

    <label>Numero celular</label>
    <input id="employeeAccountPhone" type="text" placeholder="+573001234567" />

    <label>Correo</label>
    <input id="employeeAccountEmail" type="email" placeholder="Nuevo correo" />

    <label>Contraseña</label>
    <input id="employeeAccountPassword" type="password" placeholder="Mínimo 6 caracteres" />

    <p id="employeeAccountFeedback" class="feedback info">Completa numero celular, correo y password para guardar.</p>

    <div class="modal-actions">
      <button id="cancelEmployeeAccountBtn" class="emp-btn ghost" type="button">Cancelar</button>
      <button id="saveEmployeeAccountBtn" class="emp-btn solid" type="button">Guardar cambios</button>
    </div>
  </div>
</div>
`;

  return clientDocument(
    "SGP - Calendario Empleado",
    "/ui-assets/styles/client-calendar.css",
    body,
    ["/ui-assets/scripts/empleado-dashboard.js", "/ui-assets/scripts/client-calendar.js"]
  );
}

function employeeVerifyClientsView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/empleado">SGP</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/empleado">Inicio</a>
    <a class="emp-btn ghost" href="/ui/empleado/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/empleado/validate-qr">Validacion QR</a>
    <a id="adminAccessLink" class="emp-btn ghost hidden" href="/ui/admin">Gestion empleados</a>
    <button id="openEmployeeAccountBtn" class="emp-btn ghost hidden" type="button">Editar cuenta</button>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="verify-layout">
  <section class="emp-panel verify-main">
    <div class="panel-head">
      <h1>Verificar clientes</h1>
    </div>
    <div class="verify-resume-grid">
      <article>
        <h3>Pendientes hoy</h3>
        <p id="verifyPendingTodayCount">-</p>
      </article>
      <article>
        <h3>Tomaron turno hoy</h3>
        <p id="verifyCheckedInTodayCount">-</p>
      </article>
      <article>
        <h3>No asistieron hoy</h3>
        <p id="verifyNoShowTodayCount">-</p>
      </article>
    </div>
    <div class="inline-controls verify-controls">
      <label for="weekStart">Semana</label>
      <input id="weekStart" type="date" />
      <label for="slotIntervalSelect">Intervalo</label>
      <select id="slotIntervalSelect">
        <option value="15">15 min</option>
        <option value="30" selected>30 min</option>
        <option value="45">45 min</option>
        <option value="60">60 min</option>
      </select>
    </div>
    <p id="verifySlotHelper" class="helper">Haz clic en un dia para marcarlo como no laboral. Haz clic en una hora vacia para bloquearla.</p>
    <div class="calendar-shell">
      <table>
        <thead id="verifyHead"></thead>
        <tbody id="verifyBody"></tbody>
      </table>
    </div>
  </section>

  <aside class="emp-panel config-panel">
    <h2>Configuracion</h2>
    <div class="config-tabs">
      <button id="configTabSchedule" class="config-tab active" type="button">Horario semanal</button>
      <button id="configTabPatterns" class="config-tab" type="button">Bloqueos recurrentes</button>
    </div>

    <div id="configSectionSchedule" class="config-section">
      <p>Define dias no laborales y rango de trabajo por dia.</p>
      <div id="workConfigList" class="config-list"></div>
      <button id="saveConfigBtn" class="emp-btn solid block" type="button">Guardar configuracion</button>
      <button id="resetConfigBtn" class="emp-btn ghost block" type="button">Restablecer</button>
    </div>

    <div id="configSectionPatterns" class="config-section hidden">
      <p>Horas fijas que se bloquean automaticamente cada semana.</p>
      <div class="pattern-form">
        <select id="patternPreset">
          <option value="custom">Seleccionar dias</option>
          <option value="weekdays">Lunes a Viernes</option>
          <option value="weekend">Sabado y Domingo</option>
        </select>
      </div>
      <div id="patternDayCheckboxes" class="pattern-days">
        <label><input type="checkbox" value="1" /> Lun</label>
        <label><input type="checkbox" value="2" /> Mar</label>
        <label><input type="checkbox" value="3" /> Mie</label>
        <label><input type="checkbox" value="4" /> Jue</label>
        <label><input type="checkbox" value="5" /> Vie</label>
        <label><input type="checkbox" value="6" /> Sab</label>
        <label><input type="checkbox" value="0" /> Dom</label>
      </div>
      <div class="pattern-form">
        <input id="patternStart" type="time" value="17:00" />
        <input id="patternEnd" type="time" value="19:00" />
        <button id="addPatternBtn" class="emp-btn solid" type="button">Agregar</button>
      </div>
      <div id="blockedPatternsList" class="pattern-list"></div>
    </div>

    <p id="verifyFeedback" class="feedback info">La configuracion se guarda localmente en el navegador.</p>
  </aside>
</main>

<div id="employeeAccountModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="employeeAccountTitle">
  <div class="modal-card">
    <div class="modal-head">
      <h2 id="employeeAccountTitle">Editar cuenta de empleado</h2>
      <button id="closeEmployeeAccountBtn" class="emp-btn ghost" type="button">Cerrar</button>
    </div>

    <label>Nombre</label>
    <input id="employeeAccountFirstName" type="text" readonly />

    <label>Apellido</label>
    <input id="employeeAccountLastName" type="text" readonly />

    <label>Numero de documento</label>
    <input id="employeeAccountIdentification" type="text" readonly />

    <label>Numero celular</label>
    <input id="employeeAccountPhone" type="text" placeholder="+573001234567" />

    <label>Correo</label>
    <input id="employeeAccountEmail" type="email" placeholder="Nuevo correo" />

    <label>Contraseña</label>
    <input id="employeeAccountPassword" type="password" placeholder="Mínimo 6 caracteres" />

    <p id="employeeAccountFeedback" class="feedback info">Completa numero celular, correo y password para guardar.</p>

    <div class="modal-actions">
      <button id="cancelEmployeeAccountBtn" class="emp-btn ghost" type="button">Cancelar</button>
      <button id="saveEmployeeAccountBtn" class="emp-btn solid" type="button">Guardar cambios</button>
    </div>
  </div>
</div>
`;

  return clientDocument(
    "SGP - Verificar Clientes",
    "/ui-assets/styles/empleado-verify-clients.css",
    body,
    ["/ui-assets/scripts/empleado-dashboard.js", "/ui-assets/scripts/empleado-verify-clients.js"]
  );
}

function employeeValidateQrView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/empleado">SGP</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/empleado">Inicio</a>
    <a class="emp-btn ghost" href="/ui/empleado/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/empleado/validate-qr">Validacion QR</a>
    <a id="adminAccessLink" class="emp-btn ghost hidden" href="/ui/admin">Gestion empleados</a>
    <button id="openEmployeeAccountBtn" class="emp-btn ghost hidden" type="button">Editar cuenta</button>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="qr-layout">
  <section class="emp-panel scanner-panel">
    <h1>Validacion QR</h1>
    <p class="helper">Solo empleado autenticado puede validar el ingreso.</p>
    <div class="camera-box">
      <video id="cameraPreview" autoplay playsinline muted></video>
    </div>
  </section>

  <aside class="emp-panel side-panel">
    <h2>Validacion manual</h2>
    <div class="camera-quick-actions">
      <button id="startScanBtn" class="emp-btn solid" type="button">Iniciar camara</button>
      <button id="stopScanBtn" class="emp-btn ghost" type="button" disabled>Detener</button>
    </div>
    <label>Token QR</label>
    <input id="qrTokenInput" type="text" placeholder="Pega o escanea el token" />
    <button id="validateBtn" class="emp-btn solid block" type="button">Validar ingreso</button>
    <p id="qrFeedback" class="feedback info">Esperando lectura de QR.</p>
    <h3>Ultima validacion</h3>
    <div id="lastValidationCard" class="last-validation">Sin validaciones recientes.</div>
  </aside>
</main>

<div id="employeeAccountModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="employeeAccountTitle">
  <div class="modal-card">
    <div class="modal-head">
      <h2 id="employeeAccountTitle">Editar cuenta de empleado</h2>
      <button id="closeEmployeeAccountBtn" class="emp-btn ghost" type="button">Cerrar</button>
    </div>

    <label>Nombre</label>
    <input id="employeeAccountFirstName" type="text" readonly />

    <label>Apellido</label>
    <input id="employeeAccountLastName" type="text" readonly />

    <label>Numero de documento</label>
    <input id="employeeAccountIdentification" type="text" readonly />

    <label>Numero celular</label>
    <input id="employeeAccountPhone" type="text" placeholder="+573001234567" />

    <label>Correo</label>
    <input id="employeeAccountEmail" type="email" placeholder="Nuevo correo" />

    <label>Contraseña</label>
    <input id="employeeAccountPassword" type="password" placeholder="Mínimo 6 caracteres" />

    <p id="employeeAccountFeedback" class="feedback info">Completa numero celular, correo y password para guardar.</p>

    <div class="modal-actions">
      <button id="cancelEmployeeAccountBtn" class="emp-btn ghost" type="button">Cancelar</button>
      <button id="saveEmployeeAccountBtn" class="emp-btn solid" type="button">Guardar cambios</button>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
`;

  return clientDocument(
    "SGP - Validacion QR",
    "/ui-assets/styles/empleado-validate-qr.css",
    body,
    ["/ui-assets/scripts/empleado-dashboard.js", "/ui-assets/scripts/empleado-validate-qr.js"]
  );
}

function employeeClientModerationView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/empleado">SGP</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/empleado">Inicio</a>
    <a class="emp-btn ghost" href="/ui/empleado/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/empleado/validate-qr">Validacion QR</a>
    <a id="adminAccessLink" class="emp-btn ghost hidden" href="/ui/admin">Gestion empleados</a>
    <button id="openEmployeeAccountBtn" class="emp-btn ghost hidden" type="button">Editar cuenta</button>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="moderation-layout">
  <section class="moderation-panel">
    <div class="panel-head">
      <h1>Control de mal uso de clientes</h1>
    </div>
    <div class="access-denied">
      <h2>Acceso restringido</h2>
      <p>Solo los administradores pueden gestionar sanciones de clientes.</p>
      <a class="emp-btn solid" href="/ui/empleado">Volver al panel</a>
    </div>
  </section>
</main>

<div id="employeeAccountModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="employeeAccountTitle">
  <div class="modal-card">
    <div class="modal-head">
      <h2 id="employeeAccountTitle">Editar cuenta de empleado</h2>
      <button id="closeEmployeeAccountBtn" class="emp-btn ghost" type="button">Cerrar</button>
    </div>

    <label>Nombre</label>
    <input id="employeeAccountFirstName" type="text" readonly />

    <label>Apellido</label>
    <input id="employeeAccountLastName" type="text" readonly />

    <label>Numero de documento</label>
    <input id="employeeAccountIdentification" type="text" readonly />

    <label>Numero celular</label>
    <input id="employeeAccountPhone" type="text" placeholder="+573001234567" />

    <label>Correo</label>
    <input id="employeeAccountEmail" type="email" placeholder="Nuevo correo" />

    <label>Contraseña</label>
    <input id="employeeAccountPassword" type="password" placeholder="Mínimo 6 caracteres" />

    <p id="employeeAccountFeedback" class="feedback info">Completa numero celular, correo y password para guardar.</p>

    <div class="modal-actions">
      <button id="cancelEmployeeAccountBtn" class="emp-btn ghost" type="button">Cancelar</button>
      <button id="saveEmployeeAccountBtn" class="emp-btn solid" type="button">Guardar cambios</button>
    </div>
  </div>
</div>
`;

  return clientDocument(
    "SGP - Sancionar Clientes",
    "/ui-assets/styles/client-moderation.css",
    body,
    ["/ui-assets/scripts/empleado-dashboard.js"]
  );
}

function adminView() {
  const body = `
<header class="admin-topbar">
  <a class="admin-brand" href="/ui/admin">SGP</a>
  <nav class="admin-nav">
    <a class="admin-btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="admin-btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="admin-btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <button id="logoutBtn" class="admin-btn ghost hidden" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="admin-layout admin-console">
  <section class="admin-panel admin-launcher">
    <h1>Gestion administrativa</h1>
    <p class="helper">Abre cada modulo en ventana flotante sin salir de esta vista.</p>
    <div class="admin-launcher-grid">
      <button id="openEmployeeModalBtn" class="admin-btn solid admin-session-only launcher-entry-btn" type="button">Ingreso empleado y administrador</button>
      <button id="openServicesModalBtn" class="admin-btn ghost admin-session-only" type="button">Servicios disponibles</button>
      <button id="openRegisteredModalBtn" class="admin-btn ghost admin-session-only" type="button">Lista registrados</button>
      <button id="openModerationModalBtn" class="admin-btn ghost admin-session-only" type="button">Sancionar clientes</button>
    </div>
    <p id="adminFeedback" class="feedback info">Panel de administracion listo.</p>
  </section>

  <div id="adminEmployeeModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminEmployeeTitle">
    <div class="modal-card admin-modal-card">
      <div class="modal-head">
        <h2 id="adminEmployeeTitle">Ingreso empleado y administrador</h2>
        <button id="closeEmployeeModalBtn" class="admin-btn ghost" type="button">Cerrar</button>
      </div>
      <p class="helper">Solo administradores pueden registrar usuarios internos.</p>
      <p id="adminEmployeeFeedback" class="feedback info">Completa todos los campos para crear un usuario interno.</p>

      <form id="employeeForm">
        <label>Rol</label>
        <select id="role" class="role-select">
          <option value="empleado">Empleado</option>
          <option value="admin">Administrador</option>
        </select>
        <label>Nombre</label>
        <input id="firstName" type="text" placeholder="Nombre" />
        <label>Apellido</label>
        <input id="lastName" type="text" placeholder="Apellido" />
        <label>Numero</label>
        <input id="phone" type="text" placeholder="+573001234567" />
        <label>Identificacion</label>
        <input id="identification" type="text" placeholder="ID empleado" />
        <label>Correo</label>
        <input id="email" type="email" placeholder="correo@dominio.com" />
        <label>Contraseña asignada</label>
        <input id="password" type="text" placeholder="Mínimo 6 caracteres" />
        <button id="createEmployeeBtn" class="admin-btn solid block" type="submit">Agregar empleado</button>
      </form>
    </div>
  </div>

  <div id="adminServicesModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminServicesTitle">
    <div class="modal-card admin-modal-card">
      <div class="modal-head">
        <h2 id="adminServicesTitle">Servicios disponibles</h2>
        <button id="closeServicesModalBtn" class="admin-btn ghost" type="button">Cerrar</button>
      </div>
      <p id="adminServicesFeedback" class="feedback info">Agrega servicios que luego podras asignar a empleados.</p>
      <label>Nuevo servicio</label>
      <input id="serviceNameInput" type="text" placeholder="Corte clasico" />
      <button id="addServiceBtn" class="admin-btn ghost block" type="button">Agregar servicio</button>
      <ul id="servicesList"></ul>
    </div>
  </div>

  <div id="adminRegisteredModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminRegisteredTitle">
    <div class="modal-card admin-modal-card wide list-panel">
      <div class="modal-head">
        <h2 id="adminRegisteredTitle">Lista registrados</h2>
        <button id="closeRegisteredModalBtn" class="admin-btn ghost" type="button">Cerrar</button>
      </div>
      <div class="list-head">
        <input id="employeeSearchInput" type="text" placeholder="Buscar por nombre, correo o identificacion..." />
        <button id="refreshEmployeesBtn" class="admin-btn ghost" type="button">Actualizar</button>
      </div>
      <p id="adminRegisteredFeedback" class="feedback info">Desde esta tabla puedes editar, eliminar o configurar tiempos de servicios.</p>
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
              <th>Accion</th>
            </tr>
          </thead>
          <tbody id="employeesTableBody"></tbody>
        </table>
      </div>
      <p id="tempPasswordHint" class="temp-password hidden"></p>
    </div>
  </div>

  <div id="adminModerationModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminModerationTitle">
    <div class="modal-card admin-modal-card wide list-panel">
      <div class="modal-head">
        <h2 id="adminModerationTitle">Control de mal uso de clientes</h2>
        <button id="closeModerationModalBtn" class="admin-btn ghost" type="button">Cerrar</button>
      </div>
      <p class="helper">Bloquea o desbloquea clientes por spam o uso indebido de la aplicacion.</p>
      <div class="list-head">
        <input id="moderationSearchInput" type="text" placeholder="Buscar por nombre o correo..." />
        <button id="refreshModerationBtn" class="admin-btn ghost" type="button">Actualizar tabla</button>
      </div>
      <p id="moderationFeedback" class="feedback info">Cargando clientes...</p>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Correo</th>
              <th>Numero</th>
              <th>Activas</th>
              <th>No Show</th>
              <th>Estado</th>
              <th>Motivo</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody id="moderationTableBody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <div id="editUserModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="editUserTitle">
    <div class="modal-card">
      <div class="modal-head">
        <h2 id="editUserTitle">Editar perfil registrado</h2>
        <button id="closeEditUserBtn" class="admin-btn ghost" type="button">Cerrar</button>
      </div>
      <p id="editUserSubtitle" class="helper">Ajusta numero, correo y password del perfil seleccionado.</p>
      <p id="editUserFeedback" class="feedback info">Puedes guardar numero y correo sin cambiar la contraseña.</p>

      <form id="editUserForm">
        <input id="editUserId" type="hidden" />

        <label>Identificacion (fija)</label>
        <input id="editIdentification" type="text" readonly />

        <label>Numero</label>
        <input id="editPhone" type="text" placeholder="+573001234567" />

        <label>Correo</label>
        <input id="editEmail" type="email" placeholder="Nuevo correo" />

        <label>Contraseña</label>
        <input id="editPassword" type="text" placeholder="Mínimo 6 caracteres" />

        <div class="modal-actions">
          <button id="cancelEditUserBtn" class="admin-btn ghost" type="button">Cancelar</button>
          <button id="saveEditUserBtn" class="admin-btn solid" type="submit">Guardar cambios</button>
        </div>
      </form>
    </div>
  </div>

  <div id="employeeServiceTimesModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="employeeServiceTimesTitle">
    <div class="modal-card admin-modal-card">
      <div class="modal-head">
        <h2 id="employeeServiceTimesTitle">Servicios y tiempos por empleado</h2>
        <button id="closeEmployeeServiceTimesBtn" class="admin-btn ghost" type="button">Cerrar</button>
      </div>

      <p id="employeeServiceTimesSubtitle" class="helper">
        Configura que servicios puede realizar el empleado y su duracion estimada en minutos.
      </p>

      <input id="employeeServiceTimesUserId" type="hidden" />
      <div id="employeeServiceTimesList" class="service-time-list"></div>

      <div class="modal-actions">
        <button id="cancelEmployeeServiceTimesBtn" class="admin-btn ghost" type="button">Cancelar</button>
        <button id="saveEmployeeServiceTimesBtn" class="admin-btn solid" type="button">Guardar tiempos</button>
      </div>
    </div>
  </div>
</main>
`;

  return clientDocument(
    "SGP - Administrador Empleados",
    "/ui-assets/styles/admin-add-empleado.css",
    body,
    "/ui-assets/scripts/admin-add-empleado.js"
  );
}

function adminCalendarView() {
  const body = `
<header class="admin-topbar">
  <a class="admin-brand" href="/ui/admin">SGP</a>
  <nav class="admin-nav">
    <a class="admin-btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="admin-btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="admin-btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <a class="admin-btn ghost" href="/ui/admin/client-moderation">Sancionar clientes</a>
    <button id="navLogoutBtn" class="admin-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="calendar-layout">
  <section class="calendar-main panel">
    <div class="calendar-title-wrap">
      <h1>Calendario de disponibilidad</h1>
      <p>Visualiza cupos, horarios ocupados y disponibilidad por peluquero.</p>
    </div>

    <div class="calendar-toolbar">
      <label for="weekStart">Inicio del rango</label>
      <input id="weekStart" type="date" />
      <button id="refreshCalendarBtn" class="btn ghost" type="button">Actualizar calendario</button>
      <p id="slotSelectionBadge" class="slot-selection-badge">Sin horario seleccionado</p>
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
    <input id="clientCount" type="number" min="1" max="5" value="1" />

    <button id="reserveBtn" class="btn accent block hidden" type="button" disabled>Confirmar reserva</button>
    <button id="myReservationsBtn" class="btn ghost block hidden" type="button">Mis reservas</button>

    <p id="calendarFeedback" class="feedback info">Calendario sincronizado para rol administrador.</p>
    <img id="qrImage" class="qr-image hidden" alt="QR de reserva" />

    <h3>Ultimas reservas</h3>
    <ul id="myReservationsList" class="reservations-list"></ul>
  </aside>
</main>
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
  <a class="emp-brand" href="/ui/admin">SGP</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="emp-btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <a class="emp-btn ghost" href="/ui/admin/client-moderation">Sancionar clientes</a>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="verify-layout">
  <section class="emp-panel verify-main">
    <div class="panel-head">
      <h1>Verificar clientes</h1>
    </div>
    <div class="verify-resume-grid">
      <article>
        <h3>Pendientes hoy</h3>
        <p id="verifyPendingTodayCount">-</p>
      </article>
      <article>
        <h3>Tomaron turno hoy</h3>
        <p id="verifyCheckedInTodayCount">-</p>
      </article>
      <article>
        <h3>No asistieron hoy</h3>
        <p id="verifyNoShowTodayCount">-</p>
      </article>
    </div>
    <div class="inline-controls verify-controls">
      <label for="weekStart">Semana</label>
      <input id="weekStart" type="date" />
      <label for="verifyEmployeeFilter">Empleado</label>
      <select id="verifyEmployeeFilter">
        <option value="__all_employees__">Todos los empleados</option>
      </select>
      <button id="reloadBtn" class="emp-btn ghost" type="button">Actualizar calendario</button>
    </div>
    <p id="verifySlotHelper" class="helper">Horario de 06:00 a 22:00 con intervalo dinamico.</p>
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
`;

  return clientDocument(
    "SGP - Administrador Verificar Clientes",
    "/ui-assets/styles/empleado-verify-clients.css",
    body,
    "/ui-assets/scripts/empleado-verify-clients.js"
  );
}

function adminValidateQrView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/admin">SGP</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="emp-btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <a class="emp-btn ghost" href="/ui/admin/client-moderation">Sancionar clientes</a>
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
  </section>

  <aside class="emp-panel side-panel">
    <h2>Validacion manual</h2>
    <div class="camera-quick-actions">
      <button id="startScanBtn" class="emp-btn solid" type="button">Iniciar camara</button>
      <button id="stopScanBtn" class="emp-btn ghost" type="button" disabled>Detener</button>
    </div>
    <label>Token QR</label>
    <input id="qrTokenInput" type="text" placeholder="Pega o escanea el token" />
    <button id="validateBtn" class="emp-btn solid block" type="button">Validar ingreso</button>
    <p id="qrFeedback" class="feedback info">Esperando lectura de QR.</p>
    <h3>Ultima validacion</h3>
    <div id="lastValidationCard" class="last-validation">Sin validaciones recientes.</div>
  </aside>
</main>

<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
`;

  return clientDocument(
    "SGP - Administrador Validacion QR",
    "/ui-assets/styles/empleado-validate-qr.css",
    body,
    "/ui-assets/scripts/empleado-validate-qr.js"
  );
}

function adminClientModerationView() {
  const body = `
<header class="emp-topbar">
  <a class="emp-brand" href="/ui/admin">SGP</a>
  <nav class="emp-nav">
    <a class="emp-btn ghost" href="/ui/admin">Gestion empleados</a>
    <a class="emp-btn ghost" href="/ui/admin/verify-clients">Verificar cliente</a>
    <a class="emp-btn ghost" href="/ui/admin/validate-qr">Validacion QR</a>
    <a class="emp-btn ghost" href="/ui/admin/client-moderation">Sancionar clientes</a>
    <button id="logoutBtn" class="emp-btn ghost" type="button">Cerrar sesion</button>
  </nav>
</header>

<main class="moderation-layout">
  <section class="moderation-panel">
    <div class="panel-head">
      <h1>Control de mal uso de clientes</h1>
      <input id="moderationSearchInput" type="text" placeholder="Buscar por nombre o correo..." />
      <button id="refreshModerationBtn" class="emp-btn ghost" type="button">Actualizar tabla</button>
    </div>
    <p class="helper">Bloquea o desbloquea clientes por spam o uso indebido de la aplicacion.</p>
    <p id="moderationFeedback" class="feedback info">Cargando clientes...</p>
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Correo</th>
            <th>Numero</th>
            <th>Activas</th>
            <th>No Show</th>
            <th>Estado</th>
            <th>Motivo</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody id="moderationTableBody"></tbody>
      </table>
    </div>
  </section>
</main>
`;

  return clientDocument(
    "SGP - Admin Sancionar Clientes",
    "/ui-assets/styles/client-moderation.css",
    body,
    "/ui-assets/scripts/client-moderation.js"
  );
}

module.exports = {
  homeView,
  loginView,
  clientView,
  clientCalendarView,
  employeeView,
  employeeCalendarView,
  employeeVerifyClientsView,
  employeeValidateQrView,
  employeeClientModerationView,
  adminView,
  adminCalendarView,
  adminVerifyClientsView,
  adminValidateQrView,
  adminClientModerationView
};
