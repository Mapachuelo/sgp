(function () {
  const TOKEN_KEY = "employee_token";
  const SETTINGS_KEY = "employee_verify_schedule_v1";
  const START_HOUR = 6;
  const END_HOUR = 22;
  const DAY_COUNT = 7;

  const state = {
    days: [],
    reservations: [],
    clientsMap: {},
    scheduleConfig: {}
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function setOutput(payload) {
    byId("apiOutput").textContent = JSON.stringify(payload, null, 2);
  }

  function setFeedback(message, tone) {
    const element = byId("verifyFeedback");
    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function toDateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function toDateInputValue(date) {
    return toDateKey(date);
  }

  function toLocalSlot(isoText) {
    const date = new Date(isoText);
    return {
      dayKey: toDateKey(date),
      time: String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0")
    };
  }

  function toLabel(date) {
    const weekday = new Intl.DateTimeFormat("es-CL", { weekday: "short" })
      .format(date)
      .replace(".", "");
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return weekday + " " + day + "-" + month;
  }

  function getTimeSlots() {
    const slots = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
      slots.push(String(hour).padStart(2, "0") + ":00");
      if (hour !== END_HOUR) {
        slots.push(String(hour).padStart(2, "0") + ":30");
      }
    }
    return slots;
  }

  function defaultSchedule() {
    return {
      offDay: false,
      start: "06:00",
      end: "22:00"
    };
  }

  function getDayConfig(dayKey) {
    return state.scheduleConfig[dayKey] || defaultSchedule();
  }

  function parseTimeToMinutes(timeText) {
    const parts = String(timeText || "00:00").split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function isSlotInsideWorkingHours(slot, config) {
    const slotMinutes = parseTimeToMinutes(slot);
    return slotMinutes >= parseTimeToMinutes(config.start) && slotMinutes <= parseTimeToMinutes(config.end);
  }

  function readLocalSchedule() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeLocalSchedule() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.scheduleConfig));
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

    setOutput(payload);

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "Error en la solicitud");
    }

    return payload;
  }

  async function ensureEmployeeSession() {
    const profile = await callApi("/api/auth/me", "GET");
    if (!profile.data || (profile.data.role !== "employee" && profile.data.role !== "admin")) {
      throw new Error("Acceso restringido a empleados y administradores");
    }
  }

  function buildDayRange(startText) {
    const start = new Date(startText + "T00:00:00");
    const days = [];

    for (let index = 0; index < DAY_COUNT; index += 1) {
      const next = new Date(start);
      next.setDate(start.getDate() + index);
      days.push(next);
    }

    return days;
  }

  function indexReservations() {
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

  function renderConfigPanel() {
    const container = byId("workConfigList");
    container.innerHTML = "";

    state.days.forEach(function (day) {
      const dayKey = toDateKey(day);
      const config = getDayConfig(dayKey);

      const card = document.createElement("article");
      card.className = "config-item";

      const title = document.createElement("h4");
      title.textContent = toLabel(day);
      card.appendChild(title);

      const offLabel = document.createElement("label");
      const offCheckbox = document.createElement("input");
      offCheckbox.type = "checkbox";
      offCheckbox.dataset.dayKey = dayKey;
      offCheckbox.dataset.field = "offDay";
      offCheckbox.checked = Boolean(config.offDay);
      offLabel.appendChild(offCheckbox);
      offLabel.appendChild(document.createTextNode(" Dia no laboral"));
      card.appendChild(offLabel);

      const rangeWrap = document.createElement("div");
      rangeWrap.className = "hours-row";

      const startInput = document.createElement("input");
      startInput.type = "time";
      startInput.value = config.start;
      startInput.dataset.dayKey = dayKey;
      startInput.dataset.field = "start";

      const endInput = document.createElement("input");
      endInput.type = "time";
      endInput.value = config.end;
      endInput.dataset.dayKey = dayKey;
      endInput.dataset.field = "end";

      rangeWrap.appendChild(startInput);
      rangeWrap.appendChild(endInput);
      card.appendChild(rangeWrap);

      container.appendChild(card);
    });
  }

  function renderCalendar() {
    const head = byId("verifyHead");
    const body = byId("verifyBody");
    head.innerHTML = "";
    body.innerHTML = "";

    const indexed = indexReservations();

    const headRow = document.createElement("tr");
    const firstHead = document.createElement("th");
    firstHead.textContent = "Hora";
    headRow.appendChild(firstHead);

    state.days.forEach(function (day) {
      const cell = document.createElement("th");
      cell.textContent = toLabel(day);
      headRow.appendChild(cell);
    });

    head.appendChild(headRow);

    getTimeSlots().forEach(function (slot) {
      const row = document.createElement("tr");
      const slotHead = document.createElement("th");
      slotHead.textContent = slot;
      row.appendChild(slotHead);

      state.days.forEach(function (day) {
        const dayKey = toDateKey(day);
        const config = getDayConfig(dayKey);
        const cell = document.createElement("td");

        if (config.offDay) {
          cell.className = "off-day";
          cell.textContent = "No laboral";
          row.appendChild(cell);
          return;
        }

        if (!isSlotInsideWorkingHours(slot, config)) {
          cell.className = "outside-hours";
          cell.textContent = "Fuera horario";
          row.appendChild(cell);
          return;
        }

        const slotKey = dayKey + "|" + slot;
        const reservations = (indexed[slotKey] || []).filter(function (reservation) {
          return reservation.status === "booked";
        });

        if (reservations.length === 0) {
          cell.className = "empty";
          cell.textContent = "-";
          row.appendChild(cell);
          return;
        }

        cell.className = "booked";

        reservations.forEach(function (reservation) {
          const isValidClient = Boolean(state.clientsMap[String(reservation.client_id)]);
          const rowWrap = document.createElement("div");
          rowWrap.className = "reservation-item";

          const text = document.createElement("span");
          text.textContent = reservation.service_name + " / Cliente #" + reservation.client_id;
          rowWrap.appendChild(text);

          if (isValidClient) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "verify-btn";
            button.dataset.qrToken = reservation.qr_token;
            button.textContent = "Verificar";
            rowWrap.appendChild(button);
          }

          cell.appendChild(rowWrap);
        });

        row.appendChild(cell);
      });

      body.appendChild(row);
    });
  }

  async function loadData() {
    await ensureEmployeeSession();

    const reservationsPayload = await callApi("/api/reservations", "GET");
    const clientsPayload = await callApi("/api/clients", "GET");

    state.reservations = reservationsPayload.data || [];
    state.clientsMap = {};

    (clientsPayload.data || []).forEach(function (client) {
      state.clientsMap[String(client.id)] = client;
    });
  }

  async function refreshAll() {
    try {
      const start = byId("weekStart").value;
      state.days = buildDayRange(start);

      await loadData();
      renderConfigPanel();
      renderCalendar();
      setFeedback("Calendario de verificacion actualizado.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
      if (String(error.message).toLowerCase().includes("token")) {
        window.location.href = "/ui/employee";
      }
    }
  }

  function updateConfigFromForm() {
    const elements = byId("workConfigList").querySelectorAll("input");

    elements.forEach(function (element) {
      const dayKey = element.dataset.dayKey;
      const field = element.dataset.field;
      if (!dayKey || !field) {
        return;
      }

      if (!state.scheduleConfig[dayKey]) {
        state.scheduleConfig[dayKey] = defaultSchedule();
      }

      if (field === "offDay") {
        state.scheduleConfig[dayKey].offDay = element.checked;
      } else {
        state.scheduleConfig[dayKey][field] = element.value;
      }
    });
  }

  async function validateByQr(qrToken) {
    try {
      await callApi("/api/checkin/validate", "POST", { qrToken: qrToken });
      setFeedback("Cliente verificado correctamente.", "ok");
      await refreshAll();
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  byId("reloadBtn").addEventListener("click", refreshAll);
  byId("saveConfigBtn").addEventListener("click", function () {
    updateConfigFromForm();
    writeLocalSchedule();
    renderCalendar();
    setFeedback("Configuracion guardada.", "ok");
  });
  byId("resetConfigBtn").addEventListener("click", function () {
    state.scheduleConfig = {};
    localStorage.removeItem(SETTINGS_KEY);
    renderConfigPanel();
    renderCalendar();
    setFeedback("Configuracion restablecida.", "info");
  });
  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    window.location.href = "/ui/employee";
  });

  byId("verifyBody").addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (!target.classList.contains("verify-btn")) {
      return;
    }

    validateByQr(target.dataset.qrToken);
  });

  const today = new Date();
  byId("weekStart").value = toDateInputValue(today);
  state.scheduleConfig = readLocalSchedule();

  if (!getToken()) {
    window.location.href = "/ui/employee";
  } else {
    refreshAll();
  }
})();
