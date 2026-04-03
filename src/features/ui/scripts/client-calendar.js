(function () {
  const TOKEN_KEY = "client_token";
  const DAY_COUNT = 9;
  const SLOT_TIMES = [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00"
  ];

  const state = {
    days: [],
    availabilityByDate: {},
    selectedSlot: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setOutput(data) {
    byId("apiOutput").textContent = JSON.stringify(data, null, 2);
  }

  function setFeedback(message, tone) {
    const feedback = byId("calendarFeedback");
    feedback.textContent = message;
    feedback.className = "feedback " + tone;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
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

  function setAuthUi() {
    const hasToken = Boolean(getToken());
    byId("navLoginBtn").classList.toggle("hidden", hasToken);
    byId("navLogoutBtn").classList.toggle("hidden", !hasToken);
    byId("goLoginLink").classList.toggle("hidden", hasToken);
    byId("reserveBtn").disabled = !hasToken || !state.selectedSlot;
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

    SLOT_TIMES.forEach(function (slot) {
      const row = document.createElement("tr");
      const slotTitle = document.createElement("th");
      slotTitle.textContent = slot;
      row.appendChild(slotTitle);

      state.days.forEach(function (day) {
        const dayKey = getDateKey(day);
        const reservedSlots = state.availabilityByDate[dayKey] || {};
        const stylists = reservedSlots[slot] || [];

        const cell = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.date = dayKey;
        button.dataset.time = slot;
        button.className = "slot-btn";

        if (stylists.length > 0) {
          button.classList.add("reserved");
          button.textContent = "Ocupado";
          button.disabled = true;
          cell.title = stylists.join(", ");
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

  async function refreshCalendar() {
    const startValue = byId("weekStart").value;
    if (!startValue) {
      setFeedback("Selecciona una fecha de inicio.", "warn");
      return;
    }

    state.days = buildDateRange(startValue, DAY_COUNT);
    state.availabilityByDate = {};

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

  function toIsoFromSelection(selection) {
    const localDate = new Date(selection.date + "T" + selection.time + ":00");
    return localDate.toISOString();
  }

  async function createReservation() {
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
    const stylistName = byId("stylistName").value;
    const clientCount = Number(byId("clientCount").value || 1);

    if (!serviceName || !stylistName) {
      setFeedback("Servicio y peluquero son obligatorios.", "warn");
      return;
    }

    try {
      const payload = await callApi("/api/reservations", "POST", {
        serviceName: serviceName,
        stylistName: stylistName,
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
    list.innerHTML = "";

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
  byId("myReservationsBtn").addEventListener("click", loadMyReservations);
  byId("navLoginBtn").addEventListener("click", function () {
    location.href = "/ui/client#loginSection";
  });
  byId("navLogoutBtn").addEventListener("click", function () {
    clearToken();
    setAuthUi();
    setFeedback("Sesion cerrada.", "info");
    byId("qrImage").classList.add("hidden");
  });

  byId("weekStart").value = toDateInputValue(new Date());
  updateSelectedSlotLabel();
  setAuthUi();
  refreshCalendar();
  loadMyReservations();
})();
