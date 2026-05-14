(function () {
  const isAdminContext = window.location.pathname.startsWith("/ui/admin");
  const TOKEN_KEY = "sgp_token";
  const HOME_PATH = isAdminContext ? "/ui/admin" : "/ui/empleado";
  const START_HOUR = 6;
  const END_HOUR = 22;
  const DAY_COUNT = 7;

  const state = {
    reservations: [],
    days: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("client_token");
    localStorage.removeItem("employee_token");
    localStorage.removeItem("admin_token");
  }

  function setFeedback(message, tone) {
    const element = byId("calendarFeedback");
    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setSessionUi(logged) {
    byId("logoutBtn").classList.toggle("hidden", !logged);
  }

  function setRoleUi(user) {
    const adminLink = byId("adminAccessLink");
    if (!adminLink) {
      return;
    }

    const isAdmin = Boolean(user && user.role === "admin");
    adminLink.classList.toggle("hidden", !isAdmin);
  }

  async function callApi(path, method, body) {
    const headers = {
      "Content-Type": "application/json"
    };

    const token = getToken();
    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    const response = await fetch(path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = { ok: false, message: "Respuesta no valida del servidor" };
    }

    if (!response.ok || !payload.ok) {
      console.error("API Error:", { path, method, status: response.status, payload });
      throw new Error(payload.message || "Error en la solicitud");
    }

    return payload;
  }

  function canUseEmployeeArea(user) {
    if (!user) {
      return false;
    }

    if (isAdminContext) {
      return user.role === "admin";
    }

    return user.role === "empleado" || user.role === "employee" || user.role === "admin";
  }

  function toDateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function toDateInput(date) {
    return toDateKey(date);
  }

  function formatDayLabel(date) {
    const weekday = new Intl.DateTimeFormat("es-CL", { weekday: "short" })
      .format(date)
      .replace(".", "");
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return weekday + " " + day + "-" + month;
  }

  function getSlots() {
    const slots = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
      slots.push(String(hour).padStart(2, "0") + ":00");
      if (hour !== END_HOUR) {
        slots.push(String(hour).padStart(2, "0") + ":30");
      }
    }
    return slots;
  }

  function toLocalSlot(isoText) {
    const date = new Date(isoText);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return {
      dayKey: toDateKey(date),
      time: hours + ":" + minutes
    };
  }

  function buildDayRange(startDateText) {
    const startDate = new Date(startDateText + "T00:00:00");
    const days = [];

    for (let index = 0; index < DAY_COUNT; index += 1) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + index);
      days.push(day);
    }

    return days;
  }

  function indexReservationsBySlot() {
    const map = {};

    state.reservations.forEach(function (reservation) {
      const slot = toLocalSlot(reservation.starts_at);
      const key = slot.dayKey + "|" + slot.time;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(reservation);
    });

    return map;
  }

  function renderCalendar() {
    const head = byId("calendarHead");
    const body = byId("calendarBody");
    head.innerHTML = "";
    body.innerHTML = "";

    const indexed = indexReservationsBySlot();

    const row = document.createElement("tr");
    const first = document.createElement("th");
    first.textContent = "Hora";
    row.appendChild(first);

    state.days.forEach(function (day) {
      const cell = document.createElement("th");
      cell.textContent = formatDayLabel(day);
      row.appendChild(cell);
    });

    head.appendChild(row);

    getSlots().forEach(function (slot) {
      const tr = document.createElement("tr");
      const timeCell = document.createElement("th");
      timeCell.textContent = slot;
      tr.appendChild(timeCell);

      state.days.forEach(function (day) {
        const dateKey = toDateKey(day);
        const slotKey = dateKey + "|" + slot;
        const reservations = indexed[slotKey] || [];

        const td = document.createElement("td");
        if (reservations.length === 0) {
          td.textContent = "-";
          td.className = "empty";
        } else {
          td.className = "booked";
          td.textContent = reservations
            .map(function (entry) {
              const clientLabel = entry.client_name
                ? String(entry.client_name)
                : "Cliente #" + String(entry.client_id || "-");
              return entry.service_name + " / " + clientLabel;
            })
            .join(" | ");
        }

        tr.appendChild(td);
      });

      body.appendChild(tr);
    });
  }

  function renderDayReservations() {
    const list = byId("dayReservationsList");
    list.innerHTML = "";

    const dayFilter = byId("dayFilter").value;
    const reservations = state.reservations.filter(function (reservation) {
      return String(reservation.starts_at).slice(0, 10) === dayFilter;
    });

    if (reservations.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No hay reservas para el dia seleccionado.";
      list.appendChild(item);
      return;
    }

    reservations.forEach(function (reservation) {
      const item = document.createElement("li");
      const slot = toLocalSlot(reservation.starts_at);
      item.textContent =
        slot.time +
        " - " +
        reservation.service_name +
        " con " +
        reservation.stylist_name +
        " (" +
        reservation.status +
        ")";
      list.appendChild(item);
    });
  }

  async function ensureEmployeeSession() {
    const profile = await callApi("/api/auth/me", "GET");
    if (!canUseEmployeeArea(profile.data)) {
      throw new Error("Acceso restringido a empleados y administradores");
    }

    return profile.data;
  }

  async function refreshData() {
    try {
      const currentUser = await ensureEmployeeSession();
      setRoleUi(currentUser);

      const startText = byId("weekStart").value;
      state.days = buildDayRange(startText);

      const reservationsPayload = await callApi("/api/reservations", "GET");
      state.reservations = reservationsPayload.data || [];

      renderCalendar();
      renderDayReservations();
      setFeedback("Calendario actualizado.", "ok");
      setSessionUi(true);
    } catch (error) {
      setRoleUi(null);
      setFeedback(error.message, "warn");
      if (String(error.message).toLowerCase().includes("token")) {
        window.location.href = HOME_PATH;
      }
    }
  }

  byId("refreshCalendarBtn").addEventListener("click", refreshData);
  byId("dayFilter").addEventListener("change", renderDayReservations);
  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    window.location.href = HOME_PATH;
  });

  const today = new Date();
  byId("weekStart").value = toDateInput(today);
  byId("dayFilter").value = toDateInput(today);

  if (!getToken()) {
    window.location.href = HOME_PATH;
  } else {
    refreshData();
  }
})();
