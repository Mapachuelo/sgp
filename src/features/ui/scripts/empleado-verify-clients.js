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
  const MIN_CALENDAR_STEP_MINUTES = 5;
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
    return (
      String(date.getFullYear()) +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  function toDateInputValue(date) {
    return toDateKey(date);
  }

  function toLocalDateKey(dateText) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))) {
      return String(dateText);
    }

    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return toDateKey(date);
  }

  function toLocalSlot(isoText) {
    const date = new Date(isoText);
    return {
      dayKey: toDateKey(date),
      time: String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0")
    };
  }

  function normalizeSlotStep(stepInput) {
    return Math.max(MIN_CALENDAR_STEP_MINUTES, normalizeDuration(stepInput));
  }

  function gcd(a, b) {
    let left = Math.abs(Number(a) || 0);
    let right = Math.abs(Number(b) || 0);

    while (right !== 0) {
      const remainder = left % right;
      left = right;
      right = remainder;
    }

    return left;
  }

  function gcdMany(values, fallback) {
    const normalized = (values || []).filter(function (value) {
      return Number.isInteger(value) && value > 0;
    });

    if (normalized.length === 0) {
      return fallback;
    }

    return normalized.reduce(function (accumulator, current) {
      return gcd(accumulator, current);
    });
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
    const normalizedStep = normalizeSlotStep(stepMinutes);
    const slots = [];
    const slotSet = new Set();
    const viewportConfig = state.viewportConfig || resolveViewportConfig();

    for (
      let minuteCursor = viewportConfig.startHour * 60;
      minuteCursor + normalizedStep <= viewportConfig.endHour * 60;
      minuteCursor += normalizedStep
    ) {
      const hour = Math.floor(minuteCursor / 60);
      const minutes = minuteCursor % 60;
      const slotText = String(hour).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
      if (!slotSet.has(slotText)) {
        slotSet.add(slotText);
        slots.push(slotText);
      }
    }

    (state.reservations || []).forEach(function (reservation) {
      const start = new Date(reservation.starts_at);
      if (Number.isNaN(start.getTime())) {
        return;
      }

      const minutesFromStart = start.getHours() * 60 + start.getMinutes();
      if (
        minutesFromStart < viewportConfig.startHour * 60 ||
        minutesFromStart >= viewportConfig.endHour * 60
      ) {
        return;
      }

      const slotText = String(start.getHours()).padStart(2, "0") + ":" + String(start.getMinutes()).padStart(2, "0");
      if (!slotSet.has(slotText)) {
        slotSet.add(slotText);
        slots.push(slotText);
      }
    });

    slots.sort(function (a, b) {
      return parseTimeToMinutes(a) - parseTimeToMinutes(b);
    });

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
    const slotEndMinutes = slotMinutes + normalizeSlotStep(slotStepMinutes);
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

    const minuteMarks = (state.reservations || [])
      .map(function (reservation) {
        const start = new Date(reservation.starts_at);
        if (Number.isNaN(start.getTime())) {
          return null;
        }

        return start.getMinutes();
      })
      .filter(function (minute) {
        return Number.isInteger(minute) && minute > 0;
      });

    const gcdStep = gcdMany(
      durations.concat(minuteMarks).concat([DEFAULT_SLOT_STEP_MINUTES]),
      DEFAULT_SLOT_STEP_MINUTES
    );

    return normalizeSlotStep(gcdStep);
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

  function indexReservationsByDay() {
    const map = {};

    state.reservations.forEach(function (reservation) {
      const start = new Date(reservation.starts_at);
      if (Number.isNaN(start.getTime())) {
        return;
      }

      const dayKey = toDateKey(start);
      if (!map[dayKey]) {
        map[dayKey] = [];
      }

      map[dayKey].push(reservation);
    });

    return map;
  }

  function toLocalHourMinute(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  function getReservationRangeLabel(reservation) {
    const start = new Date(reservation.starts_at);
    if (Number.isNaN(start.getTime())) {
      return "Hora no disponible";
    }

    let end = null;
    if (reservation.ends_at) {
      const explicitEnd = new Date(reservation.ends_at);
      if (!Number.isNaN(explicitEnd.getTime()) && explicitEnd.getTime() > start.getTime()) {
        end = explicitEnd;
      }
    }

    if (!end) {
      const durationMinutes = normalizeDuration(reservation.duration_minutes);
      end = new Date(start.getTime() + durationMinutes * 60000);
    }

    const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    return (
      toLocalHourMinute(start) +
      " - " +
      toLocalHourMinute(end) +
      " (" +
      String(durationMinutes) +
      " min)"
    );
  }

  function getReservationRangeDates(reservation) {
    const start = new Date(reservation.starts_at);
    if (Number.isNaN(start.getTime())) {
      return null;
    }

    let end = null;
    if (reservation.ends_at) {
      const explicitEnd = new Date(reservation.ends_at);
      if (!Number.isNaN(explicitEnd.getTime()) && explicitEnd.getTime() > start.getTime()) {
        end = explicitEnd;
      }
    }

    if (!end) {
      end = new Date(start.getTime() + normalizeDuration(reservation.duration_minutes) * 60000);
    }

    return {
      start,
      end
    };
  }

  function toLocalDateFromParts(dayKey, timeText) {
    return new Date(dayKey + "T" + timeText + ":00");
  }

  function isReservationStartSlot(reservation, dayKey, slot) {
    const range = getReservationRangeDates(reservation);
    if (!range) {
      return false;
    }

    return toDateKey(range.start) === dayKey && toLocalHourMinute(range.start) === slot;
  }

  function getReservationsForSlot(reservationsByDay, dayKey, slot, slotStepMinutes) {
    const dayReservations = reservationsByDay[dayKey] || [];
    const slotStart = toLocalDateFromParts(dayKey, slot);
    const slotEnd = new Date(slotStart.getTime() + normalizeSlotStep(slotStepMinutes) * 60000);

    return dayReservations.filter(function (reservation) {
      const range = getReservationRangeDates(reservation);
      if (!range) {
        return false;
      }

      return range.start.getTime() < slotEnd.getTime() && range.end.getTime() > slotStart.getTime();
    });
  }

  function isNoShowReservation(reservation) {
    if (!reservation || reservation.status !== "booked") {
      return false;
    }

    const startsAt = new Date(reservation.starts_at);
    if (Number.isNaN(startsAt.getTime())) {
      return false;
    }

    return startsAt.getTime() < Date.now();
  }

  function updateTodaySummary() {
    const pendingElement = byId("verifyPendingTodayCount");
    const checkedInElement = byId("verifyCheckedInTodayCount");
    const noShowElement = byId("verifyNoShowTodayCount");

    if (!pendingElement || !checkedInElement || !noShowElement) {
      return;
    }

    const todayKey = toDateKey(new Date());
    const reservationsToday = (state.reservations || []).filter(function (reservation) {
      return toLocalDateKey(reservation.starts_at) === todayKey;
    });

    const pendingCount = reservationsToday.filter(function (reservation) {
      return reservation.status === "booked" && !isNoShowReservation(reservation);
    }).length;

    const checkedInCount = reservationsToday.filter(function (reservation) {
      return reservation.status === "checked_in";
    }).length;

    const noShowCount = reservationsToday.filter(function (reservation) {
      return reservation.status === "booked" && isNoShowReservation(reservation);
    }).length;

    pendingElement.textContent = String(pendingCount);
    checkedInElement.textContent = String(checkedInCount);
    noShowElement.textContent = String(noShowCount);
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

    const reservationsByDay = indexReservationsByDay();
    const slotStepMinutes = normalizeSlotStep(state.slotStepMinutes);

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

        const reservations = getReservationsForSlot(reservationsByDay, dayKey, slot, slotStepMinutes).filter(function (reservation) {
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
          const startsInCurrentSlot = isReservationStartSlot(reservation, dayKey, slot);

          if (!startsInCurrentSlot) {
            const continuationWrap = document.createElement("div");
            continuationWrap.className = "reservation-item continued";

            const continuationText = document.createElement("span");
            continuationText.className = "reservation-main-text";
            continuationText.textContent = reservation.service_name + " / En curso";
            continuationWrap.appendChild(continuationText);

            const continuationTimeLabel = document.createElement("span");
            continuationTimeLabel.className = "reservation-time continued-time";
            continuationTimeLabel.textContent = "Horario: " + getReservationRangeLabel(reservation);
            continuationWrap.appendChild(continuationTimeLabel);

            cell.appendChild(continuationWrap);
            return;
          }

          const rowWrap = document.createElement("div");
          rowWrap.className = "reservation-item";

          const noShow = isNoShowReservation(reservation);

          const text = document.createElement("span");
          text.className = "reservation-main-text";
          const clientLabel = reservation.client_name
            ? String(reservation.client_name)
            : "Cliente #" + String(reservation.client_id || "-");
          const reservationStatus = reservation.status === "checked_in" ? "Ingreso validado" : "Reserva activa";
          text.textContent = reservation.service_name + " / " + clientLabel + " / " + reservationStatus;
          rowWrap.appendChild(text);

          const timeLabel = document.createElement("span");
          timeLabel.className = "reservation-time";
          timeLabel.textContent = "Horario: " + getReservationRangeLabel(reservation);
          rowWrap.appendChild(timeLabel);

          if (reservation.status === "checked_in") {
            rowWrap.classList.add("checked-in");

            const chip = document.createElement("span");
            chip.className = "validation-chip";
            chip.textContent = "Registro validado";
            rowWrap.appendChild(chip);
          } else if (noShow) {
            rowWrap.classList.add("no-show");

            const chip = document.createElement("span");
            chip.className = "validation-chip no-show";
            chip.textContent = "No asistio";
            rowWrap.appendChild(chip);
          } else {
            rowWrap.classList.add("pending");

            const chip = document.createElement("span");
            chip.className = "validation-chip pending";
            chip.textContent = "Pendiente";
            rowWrap.appendChild(chip);

            if (!reservation.qr_token) {
              cell.appendChild(rowWrap);
              return;
            }

            const actions = document.createElement("div");
            actions.className = "reservation-actions";

            const button = document.createElement("button");
            button.type = "button";
            button.className = "verify-btn";
            button.dataset.qrToken = reservation.qr_token;
            button.textContent = "Validar QR";
            actions.appendChild(button);

            rowWrap.appendChild(actions);
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
      updateTodaySummary();
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

    if (target.classList.contains("verify-btn")) {
      goToQrValidation(target.dataset.qrToken);
      return;
    }
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
