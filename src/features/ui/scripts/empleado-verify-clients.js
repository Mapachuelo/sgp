(function () {
  const isAdminContext = window.location.pathname.startsWith("/ui/admin");
  const TOKEN_KEY = "sgp_token";
  const HOME_PATH = isAdminContext ? "/ui/admin" : "/ui/empleado";
  const LOGIN_PATH = "/ui/login";
  const VALIDATE_QR_PATH = isAdminContext ? "/ui/admin/validate-qr" : "/ui/empleado/validate-qr";
  const FULL_START_HOUR = 6;
  const FULL_END_HOUR = 22;
  const FULL_DAY_COUNT = 7;
  const DEFAULT_SLOT_STEP_MINUTES = 30;
  const MIN_SERVICE_DURATION_MINUTES = 1;
  const MAX_SERVICE_DURATION_MINUTES = 280;

  const state = {
    days: [],
    reservations: [],
    scheduleConfig: {},
    slotStepMinutes: DEFAULT_SLOT_STEP_MINUTES,
    viewportConfig: {
      dayCount: FULL_DAY_COUNT,
      startHour: FULL_START_HOUR,
      endHour: FULL_END_HOUR
    }
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
    const element = byId("verifyFeedback");
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

  function normalizeDuration(durationInput) {
    const parsed = Number(durationInput);
    if (!Number.isInteger(parsed)) {
      return DEFAULT_SLOT_STEP_MINUTES;
    }

    if (parsed < MIN_SERVICE_DURATION_MINUTES || parsed > MAX_SERVICE_DURATION_MINUTES) {
      return DEFAULT_SLOT_STEP_MINUTES;
    }

    return parsed;
  }

  function getViewportWidth() {
    if (window.visualViewport && Number(window.visualViewport.width) > 0) {
      return Number(window.visualViewport.width);
    }

    if (window.innerWidth > 0) {
      return Number(window.innerWidth);
    }

    return 1440;
  }

  function resolveViewportConfig() {
    const width = getViewportWidth();

    if (width < 420) {
      return {
        dayCount: 2,
        startHour: FULL_START_HOUR,
        endHour: FULL_END_HOUR
      };
    }

    if (width < 700) {
      return {
        dayCount: 3,
        startHour: FULL_START_HOUR,
        endHour: FULL_END_HOUR
      };
    }

    if (width < 900) {
      return {
        dayCount: 4,
        startHour: FULL_START_HOUR,
        endHour: FULL_END_HOUR
      };
    }

    if (width < 1200) {
      return {
        dayCount: 5,
        startHour: FULL_START_HOUR,
        endHour: FULL_END_HOUR
      };
    }

    return {
      dayCount: FULL_DAY_COUNT,
      startHour: FULL_START_HOUR,
      endHour: FULL_END_HOUR
    };
  }

  function syncResponsiveCssVars() {
    const root = document.documentElement;
    root.style.setProperty("--verify-visible-days", String(state.viewportConfig.dayCount));
  }

  function getTimeSlots(stepMinutes) {
    const normalizedStep = normalizeDuration(stepMinutes);
    const slots = [];
    const viewportConfig = state.viewportConfig || resolveViewportConfig();

    for (
      let minuteCursor = viewportConfig.startHour * 60;
      minuteCursor + normalizedStep <= viewportConfig.endHour * 60;
      minuteCursor += normalizedStep
    ) {
      const hour = Math.floor(minuteCursor / 60);
      const minutes = minuteCursor % 60;
      slots.push(String(hour).padStart(2, "0") + ":" + String(minutes).padStart(2, "0"));
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

  function isSlotInsideWorkingHours(slot, config, slotStepMinutes) {
    const slotMinutes = parseTimeToMinutes(slot);
    const slotEndMinutes = slotMinutes + normalizeDuration(slotStepMinutes);
    return slotMinutes >= parseTimeToMinutes(config.start) && slotEndMinutes <= parseTimeToMinutes(config.end);
  }

  function resolveSlotStepFromReservations() {
    const durations = (state.reservations || [])
      .map(function (reservation) {
        return Number(reservation.duration_minutes);
      })
      .filter(function (duration) {
        return Number.isInteger(duration) && duration >= MIN_SERVICE_DURATION_MINUTES && duration <= MAX_SERVICE_DURATION_MINUTES;
      });

    if (durations.length === 0) {
      return DEFAULT_SLOT_STEP_MINUTES;
    }

    return Math.min(...durations);
  }

  function updateSlotHelper() {
    const helper = byId("verifySlotHelper");
    if (!helper) {
      return;
    }

    const viewportConfig = state.viewportConfig || resolveViewportConfig();
    helper.textContent =
      "Vista actual: " +
      String(viewportConfig.dayCount) +
      " dias, " +
      String(viewportConfig.startHour).padStart(2, "0") +
      ":00-" +
      String(viewportConfig.endHour).padStart(2, "0") +
      ":00 en bloques de " +
      String(state.slotStepMinutes) +
      " minutos.";
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
      throw new Error(payload.message || "Error en la solicitud");
    }

    return payload;
  }

  async function ensureEmployeeSession() {
    const profile = await callApi("/api/auth/me", "GET");
    const user = profile.data;
    const allowed = isAdminContext
      ? Boolean(user && user.role === "admin")
      : Boolean(user && (user.role === "empleado" || user.role === "employee" || user.role === "admin"));

    if (!allowed) {
      throw new Error("Acceso restringido a empleados y administradores");
    }

    return user;
  }

  function buildDayRange(startText, dayCount) {
    const start = new Date(startText + "T00:00:00");
    const days = [];

    for (let index = 0; index < dayCount; index += 1) {
      const next = new Date(start);
      next.setDate(start.getDate() + index);
      days.push(next);
    }

    return days;
  }

  function indexReservations() {
    const map = {};
    const slotStepMinutes = normalizeDuration(state.slotStepMinutes);

    state.reservations.forEach(function (reservation) {
      const start = new Date(reservation.starts_at);
      const durationMinutes = normalizeDuration(reservation.duration_minutes);
      const steps = Math.max(Math.ceil(durationMinutes / slotStepMinutes), 1);

      for (let i = 0; i < steps; i += 1) {
        const slotDate = new Date(start.getTime() + i * slotStepMinutes * 60000);
        const slot = toLocalSlot(slotDate.toISOString());
        const key = slot.dayKey + "|" + slot.time;

        if (!map[key]) {
          map[key] = [];
        }

        map[key].push(reservation);
      }
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
    const slotStepMinutes = normalizeDuration(state.slotStepMinutes);

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

    getTimeSlots(slotStepMinutes).forEach(function (slot) {
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

        if (!isSlotInsideWorkingHours(slot, config, slotStepMinutes)) {
          cell.className = "outside-hours";
          cell.textContent = "Fuera horario";
          row.appendChild(cell);
          return;
        }

        const slotKey = dayKey + "|" + slot;
        const reservations = (indexed[slotKey] || []).filter(function (reservation) {
          return reservation.status === "booked" || reservation.status === "checked_in";
        });

        if (reservations.length === 0) {
          cell.className = "empty";
          cell.textContent = "-";
          row.appendChild(cell);
          return;
        }

        cell.className = "booked";

        reservations.forEach(function (reservation) {
          const rowWrap = document.createElement("div");
          rowWrap.className = "reservation-item";

          const text = document.createElement("span");
          const clientLabel = reservation.client_name
            ? String(reservation.client_name)
            : "Cliente #" + String(reservation.client_id || "-");
          text.textContent = reservation.service_name + " / " + clientLabel;
          rowWrap.appendChild(text);

          if (reservation.status === "checked_in") {
            rowWrap.classList.add("checked-in");

            const chip = document.createElement("span");
            chip.className = "validation-chip";
            chip.textContent = "Registro validado";
            rowWrap.appendChild(chip);
          } else if (reservation.qr_token) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "verify-btn";
            button.dataset.qrToken = reservation.qr_token;
            button.textContent = "Validar QR";
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
    const currentUser = await ensureEmployeeSession();
    setRoleUi(currentUser);
    setSessionUi(true);

    const reservationsPayload = await callApi("/api/reservations", "GET");
    const viewportConfig = state.viewportConfig || resolveViewportConfig();
    const schedulePayload = await callApi(
      "/api/reservations/work-schedule/editable?start=" +
        encodeURIComponent(byId("weekStart").value) +
        "&days=" +
        encodeURIComponent(String(viewportConfig.dayCount)),
      "GET"
    );

    state.reservations = reservationsPayload.data || [];
    state.slotStepMinutes = resolveSlotStepFromReservations();
    state.scheduleConfig = {};

    (schedulePayload.data || []).forEach(function (entry) {
      if (!entry || !entry.date) {
        return;
      }

      state.scheduleConfig[entry.date] = {
        offDay: Boolean(entry.offDay),
        start: entry.start || "06:00",
        end: entry.end || "22:00"
      };
    });
  }

  async function refreshAll() {
    try {
      const start = byId("weekStart").value;
      state.viewportConfig = resolveViewportConfig();
      syncResponsiveCssVars();
      state.days = buildDayRange(start, state.viewportConfig.dayCount);

      await loadData();
      updateSlotHelper();
      renderConfigPanel();
      renderCalendar();
      setFeedback("Calendario de verificacion actualizado.", "ok");
    } catch (error) {
      setSessionUi(false);
      setRoleUi(null);
      setFeedback(error.message, "warn");
      if (String(error.message).toLowerCase().includes("token")) {
        window.location.href = LOGIN_PATH;
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

  function goToQrValidation(qrToken) {
    const params = new URLSearchParams();
    if (qrToken) {
      params.set("qrToken", String(qrToken));
    }

    const query = params.toString();
    window.location.href = VALIDATE_QR_PATH + (query ? "?" + query : "");
  }

  byId("reloadBtn").addEventListener("click", refreshAll);
  byId("saveConfigBtn").addEventListener("click", function () {
    updateConfigFromForm();
    callApi("/api/reservations/work-schedule", "PUT", {
      entries: state.days.map(function (day) {
        const dayKey = toDateKey(day);
        const config = getDayConfig(dayKey);
        return {
          date: dayKey,
          offDay: Boolean(config.offDay),
          start: config.start,
          end: config.end
        };
      })
    })
      .then(function () {
        setFeedback("Configuracion guardada.", "ok");
        return refreshAll();
      })
      .catch(function (error) {
        setFeedback(error.message, "warn");
      });
  });
  byId("resetConfigBtn").addEventListener("click", function () {
    callApi(
      "/api/reservations/work-schedule?start=" +
        encodeURIComponent(byId("weekStart").value) +
        "&days=" +
        encodeURIComponent(String((state.viewportConfig || resolveViewportConfig()).dayCount)),
      "DELETE"
    )
      .then(function () {
        state.scheduleConfig = {};
        setFeedback("Configuracion restablecida.", "info");
        return refreshAll();
      })
      .catch(function (error) {
        setFeedback(error.message, "warn");
      });
  });
  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    setSessionUi(false);
    window.location.href = LOGIN_PATH;
  });

  byId("verifyBody").addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (!target.classList.contains("verify-btn")) {
      return;
    }

    goToQrValidation(target.dataset.qrToken);
  });

  const today = new Date();
  byId("weekStart").value = toDateInputValue(today);
  state.viewportConfig = resolveViewportConfig();
  syncResponsiveCssVars();
  setSessionUi(Boolean(getToken()));

  let resizeDebounce = null;
  window.addEventListener("resize", function () {
    if (resizeDebounce) {
      clearTimeout(resizeDebounce);
    }

    resizeDebounce = setTimeout(function () {
      const nextConfig = resolveViewportConfig();
      const current = state.viewportConfig || {};
      const changed =
        nextConfig.dayCount !== current.dayCount ||
        nextConfig.startHour !== current.startHour ||
        nextConfig.endHour !== current.endHour;

      if (!changed) {
        return;
      }

      refreshAll();
    }, 180);
  });

  if (!getToken()) {
    window.location.href = LOGIN_PATH;
  } else {
    refreshAll();
  }
})();
