(function () {
  const path = window.location.pathname;
  const isClientContext = path.startsWith("/ui/client");
  const isAdminContext = path.startsWith("/ui/admin");
  const TOKEN_KEY = isClientContext
    ? "client_token"
    : isAdminContext
      ? "admin_token"
      : "employee_token";
  const HOME_PATH = isClientContext
    ? "/ui/client"
    : isAdminContext
      ? "/ui/admin"
      : "/ui/employee";
  const LOGIN_PATH = HOME_PATH;
  const ANY_STYLIST_VALUE = "__any__";
  const START_HOUR = 6;
  const END_HOUR = 22;
  const DAY_COUNT = 7;

  const state = {
    days: [],
    availabilityByDate: {},
    workScheduleByDate: {},
    selectedSlot: null,
    stylists: [],
    selectedStylist: ANY_STYLIST_VALUE
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setOutput(data) {
    const output = byId("apiOutput");
    if (!output) {
      return;
    }

    output.textContent = JSON.stringify(data, null, 2);
  }

  function setFeedback(message, tone) {
    const feedback = byId("calendarFeedback");
    if (!feedback) {
      return;
    }

    feedback.textContent = message;
    feedback.className = "feedback " + tone;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    if (isAdminContext) {
      localStorage.removeItem("employee_token");
    }
  }

  function toDateInputValue(date) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function toHumanDate(date) {
    const dayName = new Intl.DateTimeFormat("es-CL", { weekday: "short" })
      .format(date)
      .replace(".", "");
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return dayName + " " + day + "-" + month;
  }

  function toLocalTime(isoText) {
    const parsed = new Date(isoText);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
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

  function defaultSchedule() {
    return {
      offDay: false,
      start: "06:00",
      end: "22:00"
    };
  }

  function toMinutes(timeText) {
    const parts = String(timeText || "00:00").split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function isSlotInsideWorkingHours(slot, config) {
    const slotMinutes = toMinutes(slot);
    return slotMinutes >= toMinutes(config.start) && slotMinutes <= toMinutes(config.end);
  }

  function setAuthUi() {
    const hasToken = Boolean(getToken());
    const loginBtn = byId("navLoginBtn");
    const logoutBtn = byId("navLogoutBtn");
    const loginLink = byId("goLoginLink");
    const reserveBtn = byId("reserveBtn");
    const myReservationsBtn = byId("myReservationsBtn");

    if (loginBtn) {
      loginBtn.classList.toggle("hidden", hasToken || !isClientContext);
    }

    if (logoutBtn) {
      logoutBtn.classList.toggle("hidden", !hasToken);
    }

    if (loginLink) {
      loginLink.classList.toggle("hidden", hasToken || !isClientContext);
    }

    if (myReservationsBtn) {
      myReservationsBtn.classList.toggle("hidden", !isClientContext);
    }

    if (reserveBtn) {
      reserveBtn.disabled = !isClientContext || !hasToken || !state.selectedSlot;
    }
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
      method,
      headers,
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
      const message = payload.message || "Error en la solicitud";
      throw new Error(message);
    }

    return payload;
  }

  function buildDateRange(startValue, count) {
    const start = new Date(startValue + "T00:00:00");
    const days = [];

    for (let i = 0; i < count; i += 1) {
      const next = new Date(start);
      next.setDate(start.getDate() + i);
      days.push(next);
    }

    return days;
  }

  function getDateKey(date) {
    return toDateInputValue(date);
  }

  function updateSelectedSlotLabel() {
    const el = byId("selectedSlotText");
    if (!el) {
      return;
    }

    if (!state.selectedSlot) {
      el.textContent = "Selecciona un horario disponible.";
      return;
    }

    el.textContent =
      "Horario seleccionado: " + state.selectedSlot.date + " a las " + state.selectedSlot.time;
  }

  function renderCalendar() {
    const head = byId("calendarHead");
    const body = byId("calendarBody");

    head.innerHTML = "";
    body.innerHTML = "";

    const headRow = document.createElement("tr");
    const firstHead = document.createElement("th");
    firstHead.textContent = "Hora / Fecha";
    headRow.appendChild(firstHead);

    state.days.forEach(function (day) {
      const dayHead = document.createElement("th");
      dayHead.textContent = toHumanDate(day);
      headRow.appendChild(dayHead);
    });

    head.appendChild(headRow);

    getSlots().forEach(function (slot) {
      const row = document.createElement("tr");
      const slotTitle = document.createElement("th");
      slotTitle.textContent = slot;
      row.appendChild(slotTitle);

      state.days.forEach(function (day) {
        const dayKey = getDateKey(day);
        const schedule = state.workScheduleByDate[dayKey] || defaultSchedule();
        const reservedSlots = state.availabilityByDate[dayKey] || {};
        const bookedStylists = reservedSlots[slot] || [];
        const selectedStylist = state.selectedStylist;
        const selectedStylistName = state.stylists
          .filter(function (entry) {
            return String(entry.id) === String(selectedStylist);
          })
          .map(function (entry) {
            return entry.name;
          })[0];

        let isOccupied = false;
        if (selectedStylist && selectedStylist !== ANY_STYLIST_VALUE) {
          isOccupied = Boolean(selectedStylistName && bookedStylists.includes(selectedStylistName));
        } else {
          isOccupied =
            state.stylists.length === 0 || bookedStylists.length >= Math.max(state.stylists.length, 1);
        }

        const cell = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.date = dayKey;
        button.dataset.time = slot;
        button.className = "slot-btn";

        if (schedule.offDay) {
          button.classList.add("reserved");
          button.textContent = "No laboral";
          button.disabled = true;
        } else if (!isSlotInsideWorkingHours(slot, schedule)) {
          button.classList.add("reserved");
          button.textContent = "Fuera horario";
          button.disabled = true;
        } else if (isOccupied) {
          button.classList.add("reserved");
          button.textContent = "Ocupado";
          button.disabled = true;
          cell.title = bookedStylists.join(", ");
        } else {
          button.classList.add("available");
          button.textContent = "Reservar";
        }

        cell.appendChild(button);
        row.appendChild(cell);
      });

      body.appendChild(row);
    });
  }

  async function fetchAvailabilityByDay(dayKey) {
    const payload = await callApi(
      "/api/reservations/availability?date=" + encodeURIComponent(dayKey),
      "GET"
    );

    const dayMap = {};
    (payload.data || []).forEach(function (entry) {
      const hourKey = toLocalTime(entry.starts_at);
      if (!hourKey) {
        return;
      }

      if (!dayMap[hourKey]) {
        dayMap[hourKey] = [];
      }

      dayMap[hourKey].push(entry.stylist_name);
    });

    return dayMap;
  }

  async function fetchWorkScheduleRange(startDate, daysCount) {
    const params = new URLSearchParams({
      start: startDate,
      days: String(daysCount)
    });

    if (state.selectedStylist && state.selectedStylist !== ANY_STYLIST_VALUE) {
      params.set("stylistId", String(state.selectedStylist));
    }

    const payload = await callApi(
      "/api/reservations/work-schedule?" + params.toString(),
      "GET"
    );

    const map = {};
    (payload.data || []).forEach(function (entry) {
      if (!entry || !entry.date) {
        return;
      }

      map[entry.date] = {
        offDay: Boolean(entry.offDay),
        start: entry.start || "06:00",
        end: entry.end || "22:00"
      };
    });

    return map;
  }

  async function refreshCalendar() {
    const startValue = byId("weekStart").value;
    if (!startValue) {
      setFeedback("Selecciona una fecha de inicio.", "warn");
      return;
    }

    state.days = buildDateRange(startValue, DAY_COUNT);
    state.availabilityByDate = {};
    state.workScheduleByDate = {};

    try {
      state.workScheduleByDate = await fetchWorkScheduleRange(startValue, DAY_COUNT);
    } catch (error) {
      setFeedback("No se pudo cargar configuracion laboral: " + error.message, "warn");
    }

    const promises = state.days.map(async function (day) {
      const dayKey = getDateKey(day);
      try {
        const dayMap = await fetchAvailabilityByDay(dayKey);
        state.availabilityByDate[dayKey] = dayMap;
      } catch (error) {
        state.availabilityByDate[dayKey] = {};
        setFeedback("No se pudieron cargar todos los dias: " + error.message, "warn");
      }
    });

    await Promise.all(promises);
    renderCalendar();
    setFeedback("Calendario actualizado.", "ok");
  }

  async function loadCatalogs() {
    const [stylistsPayload, servicesPayload] = await Promise.all([
      callApi("/api/auth/stylists", "GET"),
      callApi("/api/reservations/services", "GET")
    ]);

    state.stylists = stylistsPayload.data || [];

    const stylistSelect = byId("stylistName");
    if (stylistSelect) {
      stylistSelect.innerHTML = "";

      const anyOption = document.createElement("option");
      anyOption.value = ANY_STYLIST_VALUE;
      anyOption.textContent = "Cualquier peluquero";
      stylistSelect.appendChild(anyOption);

      state.stylists.forEach(function (stylist) {
        const option = document.createElement("option");
        option.value = String(stylist.id);
        option.textContent = stylist.name;
        stylistSelect.appendChild(option);
      });

      state.selectedStylist = stylistSelect.value || ANY_STYLIST_VALUE;
    }

    const serviceSelect = byId("serviceName");
    if (serviceSelect) {
      serviceSelect.innerHTML = "";

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Selecciona un servicio";
      serviceSelect.appendChild(defaultOption);

      (servicesPayload.data || []).forEach(function (service) {
        const option = document.createElement("option");
        option.value = service.name;
        option.textContent = service.name;
        serviceSelect.appendChild(option);
      });
    }
  }

  function toIsoFromSelection(selection) {
    const localDate = new Date(selection.date + "T" + selection.time + ":00");
    return localDate.toISOString();
  }

  async function createReservation() {
    if (!isClientContext) {
      setFeedback("Solo clientes pueden confirmar reservas.", "warn");
      return;
    }

    if (!state.selectedSlot) {
      setFeedback("Selecciona un horario para reservar.", "warn");
      return;
    }

    if (!getToken()) {
      setFeedback("Necesitas iniciar sesion para reservar.", "warn");
      setAuthUi();
      return;
    }

    const serviceName = byId("serviceName").value.trim();
    const stylistId = byId("stylistName").value;
    const clientCount = Number(byId("clientCount").value || 1);

    if (!serviceName || !stylistId) {
      setFeedback("Servicio y peluquero son obligatorios.", "warn");
      return;
    }

    try {
      const payload = await callApi("/api/reservations", "POST", {
        serviceName: serviceName,
        stylistId: stylistId,
        startsAt: toIsoFromSelection(state.selectedSlot),
        clientCount: clientCount
      });

      const qrImage = byId("qrImage");
      if (payload.data && payload.data.qr_data_url) {
        qrImage.src = payload.data.qr_data_url;
        qrImage.classList.remove("hidden");
      } else {
        qrImage.classList.add("hidden");
      }

      setFeedback("Reserva registrada con exito.", "ok");
      await refreshCalendar();
      await loadMyReservations();
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function loadMyReservations() {
    const list = byId("myReservationsList");
    if (!list) {
      return;
    }

    list.innerHTML = "";

    if (!isClientContext) {
      const item = document.createElement("li");
      item.textContent = "Reservas visibles solo para rol cliente.";
      list.appendChild(item);
      return;
    }

    if (!getToken()) {
      const item = document.createElement("li");
      item.textContent = "Inicia sesion para ver tus reservas.";
      list.appendChild(item);
      return;
    }

    try {
      const payload = await callApi("/api/reservations/me", "GET");
      const reservations = payload.data || [];

      if (reservations.length === 0) {
        const item = document.createElement("li");
        item.textContent = "No tienes reservas registradas.";
        list.appendChild(item);
        return;
      }

      reservations.slice(0, 6).forEach(function (reservation) {
        const item = document.createElement("li");
        const time = toLocalTime(reservation.starts_at);
        const date = reservation.starts_at.slice(0, 10);
        item.textContent =
          date +
          " " +
          time +
          " - " +
          reservation.service_name +
          " con " +
          reservation.stylist_name;
        list.appendChild(item);
      });
    } catch (error) {
      const item = document.createElement("li");
      item.textContent = error.message;
      list.appendChild(item);
    }
  }

  byId("calendarBody").addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (!target.classList.contains("available")) {
      return;
    }

    const date = target.dataset.date;
    const time = target.dataset.time;

    state.selectedSlot = { date: date, time: time };
    updateSelectedSlotLabel();

    if (!getToken()) {
      setFeedback("Para confirmar reserva debes iniciar sesion.", "warn");
    } else {
      setFeedback("Horario listo para reservar.", "info");
    }

    setAuthUi();
  });

  byId("refreshCalendarBtn").addEventListener("click", refreshCalendar);
  byId("reserveBtn").addEventListener("click", createReservation);
  const myReservationsBtn = byId("myReservationsBtn");
  if (myReservationsBtn) {
    myReservationsBtn.addEventListener("click", loadMyReservations);
  }

  const navLoginBtn = byId("navLoginBtn");
  if (navLoginBtn) {
    navLoginBtn.addEventListener("click", function () {
      location.href = LOGIN_PATH;
    });
  }

  const navLogoutBtn = byId("navLogoutBtn");
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener("click", function () {
      clearToken();
      setAuthUi();
      setFeedback("Sesion cerrada.", "info");
      const qrImage = byId("qrImage");
      if (qrImage) {
        qrImage.classList.add("hidden");
      }

      if (!isClientContext) {
        window.location.href = HOME_PATH;
      }
    });
  }

  const stylistSelect = byId("stylistName");
  if (stylistSelect) {
    stylistSelect.addEventListener("change", function () {
      state.selectedStylist = stylistSelect.value || ANY_STYLIST_VALUE;
      refreshCalendar();
    });
  }

  byId("weekStart").value = toDateInputValue(new Date());
  updateSelectedSlotLabel();
  setAuthUi();
  loadCatalogs()
    .then(function () {
      return refreshCalendar();
    })
    .then(function () {
      return loadMyReservations();
    })
    .catch(function (error) {
      setFeedback(error.message, "warn");
    });
})();
