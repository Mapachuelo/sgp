(function () {
  const path = window.location.pathname;
  const isClientContext = path.startsWith("/ui/client");
  const isAdminContext = path.startsWith("/ui/admin");
  const TOKEN_KEY = "sgp_token";
  const HOME_PATH = isClientContext
    ? "/ui/client"
    : isAdminContext
      ? "/ui/admin"
      : "/ui/empleado";
  const LOGIN_PATH = isClientContext
    ? "/ui/login"
    : isAdminContext
      ? "/ui/login"
      : "/ui/login";
  const ANY_STYLIST_VALUE = "__any__";
  const FULL_START_HOUR = 6;
  const FULL_END_HOUR = 22;
  const FULL_DAY_COUNT = 7;
  const DEFAULT_SLOT_STEP_MINUTES = 30;
  const MIN_SERVICE_DURATION_MINUTES = 1;
  const MAX_SERVICE_DURATION_MINUTES = 280;

  const state = {
    days: [],
    availabilityByDate: {},
    workScheduleByDate: {},
    selectedSlot: null,
    currentUser: null,
    stylists: [],
    selectedStylist: ANY_STYLIST_VALUE,
    selectedServiceDuration: DEFAULT_SLOT_STEP_MINUTES,
    serviceDurationByName: {},
    serviceDurationByNameAndStylist: {},
    viewportConfig: {
      dayCount: FULL_DAY_COUNT,
      startHour: FULL_START_HOUR,
      endHour: FULL_END_HOUR
    }
  };

  function byId(id) {
    return document.getElementById(id);
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
    localStorage.removeItem("client_token");
    localStorage.removeItem("employee_token");
    localStorage.removeItem("admin_token");
  }

  function splitName(fullName) {
    const normalized = String(fullName || "").trim().replace(/\s+/g, " ");
    if (!normalized) {
      return { firstName: "", lastName: "" };
    }

    const parts = normalized.split(" ");
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "" };
    }

    return {
      firstName: parts.shift(),
      lastName: parts.join(" ")
    };
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

  function toLocalDate(isoText) {
    const parsed = new Date(isoText);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    const year = String(parsed.getFullYear());
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function normalizeStepMinutes(minutesInput) {
    const parsed = Number(minutesInput);
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
    root.style.setProperty("--calendar-visible-days", String(state.viewportConfig.dayCount));
  }

  function getSlots(stepMinutes) {
    const normalizedStep = normalizeStepMinutes(stepMinutes);
    const slots = [];
    const viewportConfig = state.viewportConfig || resolveViewportConfig();

    for (
      let minuteCursor = viewportConfig.startHour * 60;
      minuteCursor + normalizedStep <= viewportConfig.endHour * 60;
      minuteCursor += normalizedStep
    ) {
      const hour = Math.floor(minuteCursor / 60);
      const minute = minuteCursor % 60;
      slots.push(String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0"));
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

  function isSlotInsideWorkingHours(slot, slotDurationMinutes, config) {
    const slotMinutes = toMinutes(slot);
    const slotEndMinutes = slotMinutes + normalizeStepMinutes(slotDurationMinutes);
    return slotMinutes >= toMinutes(config.start) && slotEndMinutes <= toMinutes(config.end);
  }

  function toLocalDateFromParts(dateText, timeText) {
    return new Date(dateText + "T" + timeText + ":00");
  }

  function getReservationRange(reservation) {
    const startsAt = new Date(reservation.starts_at);
    if (Number.isNaN(startsAt.getTime())) {
      return null;
    }

    const explicitEndsAt = reservation.ends_at ? new Date(reservation.ends_at) : null;
    if (explicitEndsAt && !Number.isNaN(explicitEndsAt.getTime()) && explicitEndsAt > startsAt) {
      return {
        start: startsAt,
        end: explicitEndsAt
      };
    }

    const fallbackDuration = normalizeStepMinutes(reservation.duration_minutes);
    return {
      start: startsAt,
      end: new Date(startsAt.getTime() + fallbackDuration * 60000)
    };
  }

  function overlapsSlot(reservation, dayKey, slot, slotDurationMinutes) {
    const range = getReservationRange(reservation);
    if (!range) {
      return false;
    }

    const slotStart = toLocalDateFromParts(dayKey, slot);
    const slotEnd = new Date(slotStart.getTime() + normalizeStepMinutes(slotDurationMinutes) * 60000);

    return range.start.getTime() < slotEnd.getTime() && range.end.getTime() > slotStart.getTime();
  }

  function getReservationsForSlot(dayKey, slot, slotDurationMinutes) {
    const reservations = state.availabilityByDate[dayKey] || [];

    return reservations.filter(function (reservation) {
      return overlapsSlot(reservation, dayKey, slot, slotDurationMinutes);
    });
  }

  function inferServiceDurationMinutes(serviceName) {
    const trimmedName = String(serviceName || "").trim();
    const selectedStylist = String(state.selectedStylist || ANY_STYLIST_VALUE);
    const byStylist = state.serviceDurationByNameAndStylist[trimmedName] || {};
    const configuredByStylist = Number(byStylist[selectedStylist]);

    if (Number.isInteger(configuredByStylist)) {
      return normalizeStepMinutes(configuredByStylist);
    }

    const configuredDuration = state.serviceDurationByName[trimmedName];
    if (Number.isInteger(configuredDuration)) {
      return normalizeStepMinutes(configuredDuration);
    }

    let inferred = null;
    Object.keys(state.availabilityByDate).forEach(function (dayKey) {
      const entries = state.availabilityByDate[dayKey] || [];
      entries.forEach(function (entry) {
        if (String(entry.service_name) !== trimmedName) {
          return;
        }

        const duration = normalizeStepMinutes(entry.duration_minutes);
        if (!inferred || duration < inferred) {
          inferred = duration;
        }
      });
    });

    return inferred || DEFAULT_SLOT_STEP_MINUTES;
  }

  function updateSelectedServiceDuration() {
    const serviceSelect = byId("serviceName");
    const serviceName = serviceSelect ? serviceSelect.value : "";
    state.selectedServiceDuration = inferServiceDurationMinutes(serviceName);
  }

  function setAuthUi() {
    const hasToken = Boolean(getToken());
    const hasClientSession = Boolean(hasToken && isClientContext && state.currentUser && state.currentUser.role === "client");
    const loginBtn = byId("navLoginBtn");
    const logoutBtn = byId("navLogoutBtn");
    const profileBtn = byId("openProfileEditBtn");
    const loginLink = byId("goLoginLink");
    const reserveBtn = byId("reserveBtn");
    const myReservationsBtn = byId("myReservationsBtn");

    if (loginBtn) {
      loginBtn.classList.toggle("hidden", hasToken || !isClientContext);
    }

    if (logoutBtn) {
      logoutBtn.classList.toggle("hidden", !hasToken);
    }

    if (profileBtn) {
      profileBtn.classList.toggle("hidden", !hasClientSession);
    }

    if (loginLink) {
      loginLink.classList.toggle("hidden", hasToken || !isClientContext);
    }

    if (myReservationsBtn) {
      myReservationsBtn.classList.toggle("hidden", !isClientContext);
    }

    if (reserveBtn) {
      reserveBtn.disabled = !hasClientSession || !state.selectedSlot;
    }
  }

  function isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
  }

  function normalizePhoneInput(value) {
    const compact = String(value || "").replace(/[^\d+]/g, "");
    if (!compact) {
      return "";
    }

    if (compact.startsWith("+")) {
      return compact;
    }

    if (compact.startsWith("57")) {
      return "+" + compact;
    }

    return "+57" + compact;
  }

  function isValidCoPhone(phone) {
    return /^\+57\d{10}$/.test(phone);
  }

  async function refreshClientSessionState() {
    if (!isClientContext) {
      return;
    }

    const token = getToken();
    if (!token) {
      state.currentUser = null;
      setAuthUi();
      return;
    }

    try {
      const payload = await callApi("/api/auth/me", "GET");
      const user = payload.data;
      state.currentUser = user && user.role === "client" ? user : null;
      if (!state.currentUser && user && user.role) {
        setFeedback("Esta vista es exclusiva para clientes autenticados.", "warn");
      }
    } catch (_error) {
      clearToken();
      state.currentUser = null;
    }

    setAuthUi();
  }

  function fillClientProfileForm(profile) {
    const nameParts = splitName(profile.name);
    byId("clientProfileFirstName").value = nameParts.firstName;
    byId("clientProfileLastName").value = nameParts.lastName;
    byId("clientProfilePhone").value = profile.phone || "";
    byId("clientProfileEmail").value = profile.email || "";
    byId("clientProfilePassword").value = "";
  }

  function openClientProfileModal() {
    const modal = byId("clientProfileModal");
    if (!modal) {
      return;
    }

    modal.classList.remove("hidden");
  }

  function closeClientProfileModal() {
    const modal = byId("clientProfileModal");
    if (!modal) {
      return;
    }

    modal.classList.add("hidden");
    const passwordInput = byId("clientProfilePassword");
    if (passwordInput) {
      passwordInput.value = "";
    }
  }

  async function openClientProfileEditor() {
    if (!isClientContext) {
      return;
    }

    try {
      await refreshClientSessionState();
      if (!state.currentUser) {
        setFeedback("Debes iniciar sesion como cliente para editar tu cuenta.", "warn");
        return;
      }

      const payload = await callApi("/api/clients/me", "GET");
      fillClientProfileForm(payload.data || {});
      openClientProfileModal();
      setFeedback("Actualiza tus datos y guarda los cambios.", "info");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function saveClientProfileEditor() {
    const firstName = (byId("clientProfileFirstName").value || "").trim();
    const lastName = (byId("clientProfileLastName").value || "").trim();
    const name = (firstName + " " + lastName).trim();
    const phone = normalizePhoneInput((byId("clientProfilePhone").value || "").trim());
    const email = (byId("clientProfileEmail").value || "").trim();
    const password = (byId("clientProfilePassword").value || "").trim();

    if (!firstName || !lastName || !phone || !email || !password) {
      setFeedback("Completa nombre, apellido, numero, correo y password para guardar.", "warn");
      return;
    }

    if (!isValidEmail(email)) {
      setFeedback("Ingresa un correo valido.", "warn");
      return;
    }

    if (!isValidCoPhone(phone)) {
      setFeedback("El numero debe tener formato +57XXXXXXXXXX.", "warn");
      return;
    }

    if (password.length < 6) {
      setFeedback("La password debe tener al menos 6 caracteres.", "warn");
      return;
    }

    try {
      byId("clientProfilePhone").value = phone;
      await callApi("/api/clients/me", "PUT", {
        name: name,
        phone: phone,
        email: email,
        password: password
      });

      await refreshClientSessionState();
      closeClientProfileModal();
      setFeedback("Perfil actualizado correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
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

    if (!response.ok || !payload.ok) {
      const message = payload.message || "Error en la solicitud";
      throw new Error(message);
    }

    return payload;
  }

  async function ensureRoleSessionIfNeeded() {
    if (isClientContext) {
      return;
    }

    const token = getToken();
    if (!token) {
      throw new Error("Sesion requerida");
    }

    const profile = await callApi("/api/auth/me", "GET");
    const user = profile.data;

    if (isAdminContext) {
      if (!user || user.role !== "admin") {
        throw new Error("Acceso restringido a administradores");
      }
      return;
    }

    if (!user || (user.role !== "empleado" && user.role !== "employee" && user.role !== "admin")) {
      throw new Error("Acceso restringido a empleados y administradores");
    }
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
      updateSelectionBadge();
      return;
    }

    el.textContent =
      "Horario seleccionado: " + state.selectedSlot.date + " a las " + state.selectedSlot.time;

    updateSelectionBadge();
  }

  function updateSelectionBadge() {
    const badge = byId("slotSelectionBadge");
    if (!badge) {
      return;
    }

    if (!state.selectedSlot) {
      badge.textContent = "Sin horario seleccionado";
      badge.className = "slot-selection-badge";
      return;
    }

    badge.textContent =
      "Seleccionado: " + state.selectedSlot.date + " " + state.selectedSlot.time;
    badge.className = "slot-selection-badge active";
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

    const slotDurationMinutes = normalizeStepMinutes(state.selectedServiceDuration);
    let selectedSlotIsVisible = false;

    getSlots(slotDurationMinutes).forEach(function (slot) {
      const row = document.createElement("tr");
      const slotTitle = document.createElement("th");
      slotTitle.textContent = slot;
      row.appendChild(slotTitle);

      state.days.forEach(function (day) {
        const dayKey = getDateKey(day);
        const schedule = state.workScheduleByDate[dayKey] || defaultSchedule();
        const slotReservations = getReservationsForSlot(dayKey, slot, slotDurationMinutes);
        const bookedStylists = Array.from(
          new Set(
            slotReservations
              .map(function (entry) {
                return entry.stylist_name;
              })
              .filter(Boolean)
          )
        );
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
        } else if (!isSlotInsideWorkingHours(slot, slotDurationMinutes, schedule)) {
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

          if (
            state.selectedSlot &&
            state.selectedSlot.date === dayKey &&
            state.selectedSlot.time === slot
          ) {
            button.classList.add("selected");
            button.textContent = "Seleccionado";
            selectedSlotIsVisible = true;
          }
        }

        cell.appendChild(button);
        row.appendChild(cell);
      });

      body.appendChild(row);
    });

    if (state.selectedSlot && !selectedSlotIsVisible) {
      state.selectedSlot = null;
      updateSelectedSlotLabel();
      setAuthUi();
    }
  }

  async function fetchAvailabilityByDay(dayKey) {
    const payload = await callApi(
      "/api/reservations/availability?date=" + encodeURIComponent(dayKey),
      "GET"
    );

    return (payload.data || []).filter(function (entry) {
      return entry && (entry.status === "booked" || entry.status === "checked_in");
    });
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

    state.viewportConfig = resolveViewportConfig();
    syncResponsiveCssVars();
    state.days = buildDateRange(startValue, state.viewportConfig.dayCount);
    state.availabilityByDate = {};
    state.workScheduleByDate = {};

    try {
      state.workScheduleByDate = await fetchWorkScheduleRange(startValue, state.viewportConfig.dayCount);
    } catch (error) {
      setFeedback("No se pudo cargar configuracion laboral: " + error.message, "warn");
    }

    const promises = state.days.map(async function (day) {
      const dayKey = getDateKey(day);
      try {
        const reservations = await fetchAvailabilityByDay(dayKey);
        state.availabilityByDate[dayKey] = reservations;
      } catch (error) {
        state.availabilityByDate[dayKey] = [];
        setFeedback("No se pudieron cargar todos los dias: " + error.message, "warn");
      }
    });

    await Promise.all(promises);
    updateSelectedServiceDuration();
    renderCalendar();
    setFeedback(
      "Calendario actualizado. Vista: " +
        String(state.viewportConfig.dayCount) +
        " dias, " +
        String(state.viewportConfig.startHour).padStart(2, "0") +
        ":00-" +
        String(state.viewportConfig.endHour).padStart(2, "0") +
        ":00.",
      "ok"
    );
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

        const serviceName = String(service.name || "").trim();
        const duration = normalizeStepMinutes(service.duration_minutes || service.durationMinutes);
        state.serviceDurationByName[serviceName] = duration;

        const stylistDurations = service.stylist_durations || {};
        const normalizedByStylist = {};
        Object.keys(stylistDurations).forEach(function (stylistId) {
          normalizedByStylist[String(stylistId)] = normalizeStepMinutes(stylistDurations[stylistId]);
        });
        state.serviceDurationByNameAndStylist[serviceName] = normalizedByStylist;
      });

      updateSelectedServiceDuration();
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

    if (!Number.isInteger(clientCount) || clientCount < 1 || clientCount > 5) {
      setFeedback("La cantidad de clientes debe estar entre 1 y 5.", "warn");
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

      const activeReservations = reservations.filter(function (reservation) {
        return reservation.status === "booked";
      }).length;

      setFeedback(
        "Reservas activas: " + String(activeReservations) + "/3.",
        "info"
      );

      if (reservations.length === 0) {
        const item = document.createElement("li");
        item.textContent = "No tienes reservas registradas.";
        list.appendChild(item);
        return;
      }

      reservations.forEach(function (reservation) {
        const item = document.createElement("li");
        item.className = "reservation-item reservation-card";

        const time = toLocalTime(reservation.starts_at);
        const date = toLocalDate(reservation.starts_at);
        const isActive = reservation.status === "booked";

        const status = document.createElement("span");
        status.className = "reservation-state " + (isActive ? "active" : "inactive");
        status.textContent = isActive ? "Activa" : "No activa";

        const details = document.createElement("div");
        details.className = "reservation-main";

        const lineDate = document.createElement("p");
        lineDate.className = "reservation-line";
        lineDate.textContent = "Fecha y hora: " + date + " " + time;

        const lineClient = document.createElement("p");
        lineClient.className = "reservation-line";
        lineClient.textContent = "Cliente: #" + String(reservation.client_id || "-");

        const lineService = document.createElement("p");
        lineService.className = "reservation-line";
        lineService.textContent =
          "Servicio: " +
          String(reservation.service_name || "-") +
          " con " +
          String(reservation.stylist_name || "-");

        details.appendChild(lineDate);
        details.appendChild(lineClient);
        details.appendChild(lineService);

        item.appendChild(status);
        item.appendChild(details);

        if (isActive) {
          const cancelBtn = document.createElement("button");
          cancelBtn.type = "button";
          cancelBtn.className = "btn accent cancel-reservation-btn";
          cancelBtn.textContent = "Eliminar activa";
          cancelBtn.dataset.reservationId = String(reservation.id || "");
          item.appendChild(cancelBtn);
        }

        list.appendChild(item);
      });
    } catch (error) {
      const item = document.createElement("li");
      item.textContent = error.message;
      list.appendChild(item);
    }
  }

  function openMyReservationsModal() {
    if (!isClientContext) {
      return;
    }

    const modal = byId("myReservationsModal");
    if (!modal) {
      return;
    }

    modal.classList.remove("hidden");
  }

  function closeMyReservationsModal() {
    const modal = byId("myReservationsModal");
    if (!modal) {
      return;
    }

    modal.classList.add("hidden");
  }

  async function cancelReservation(reservationId) {
    const parsedId = Number(reservationId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setFeedback("No se pudo identificar la reserva a eliminar.", "warn");
      return;
    }

    const accepted = window.confirm("Deseas eliminar esta reserva?");
    if (!accepted) {
      return;
    }

    try {
      await callApi(
        "/api/reservations/me/" + encodeURIComponent(String(parsedId)),
        "DELETE"
      );
      setFeedback("Reserva eliminada correctamente.", "ok");
      await refreshCalendar();
      await loadMyReservations();
    } catch (error) {
      setFeedback(error.message, "warn");
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

    document.querySelectorAll(".slot-btn.selected").forEach(function (button) {
      button.classList.remove("selected");
      if (button.classList.contains("available")) {
        button.textContent = "Reservar";
      }
    });

    state.selectedSlot = { date: date, time: time };
    target.classList.add("selected");
    target.textContent = "Seleccionado";
    updateSelectedSlotLabel();

    if (!getToken()) {
      setFeedback("Horario seleccionado. Para confirmar reserva debes iniciar sesion.", "warn");
    } else {
      setFeedback("Horario seleccionado y listo para reservar.", "info");
    }

    setAuthUi();
  });

  byId("refreshCalendarBtn").addEventListener("click", refreshCalendar);
  byId("reserveBtn").addEventListener("click", createReservation);
  const myReservationsBtn = byId("myReservationsBtn");
  if (myReservationsBtn) {
    myReservationsBtn.addEventListener("click", function () {
      loadMyReservations()
        .then(openMyReservationsModal)
        .catch(function (error) {
          setFeedback(error.message, "warn");
        });
    });
  }

  const closeReservationsModalBtn = byId("closeMyReservationsModalBtn");
  if (closeReservationsModalBtn) {
    closeReservationsModalBtn.addEventListener("click", closeMyReservationsModal);
  }

  const reservationsModal = byId("myReservationsModal");
  if (reservationsModal) {
    reservationsModal.addEventListener("click", function (event) {
      if (event.target === reservationsModal) {
        closeMyReservationsModal();
      }
    });
  }
  const myReservationsList = byId("myReservationsList");
  if (myReservationsList) {
    myReservationsList.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (!target.classList.contains("cancel-reservation-btn")) {
        return;
      }

      cancelReservation(target.dataset.reservationId);
    });
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
      state.currentUser = null;
      setAuthUi();
      setFeedback("Sesion cerrada.", "info");
      const qrImage = byId("qrImage");
      if (qrImage) {
        qrImage.classList.add("hidden");
      }

      if (!isClientContext) {
        window.location.href = LOGIN_PATH;
      }
    });
  }

  const openProfileEditBtn = byId("openProfileEditBtn");
  if (openProfileEditBtn) {
    openProfileEditBtn.addEventListener("click", openClientProfileEditor);
  }

  const saveProfileEditBtn = byId("saveProfileEditBtn");
  if (saveProfileEditBtn) {
    saveProfileEditBtn.addEventListener("click", saveClientProfileEditor);
  }

  const closeProfileEditBtn = byId("closeProfileEditBtn");
  if (closeProfileEditBtn) {
    closeProfileEditBtn.addEventListener("click", closeClientProfileModal);
  }

  const cancelProfileEditBtn = byId("cancelProfileEditBtn");
  if (cancelProfileEditBtn) {
    cancelProfileEditBtn.addEventListener("click", closeClientProfileModal);
  }

  const profileModal = byId("clientProfileModal");
  if (profileModal) {
    profileModal.addEventListener("click", function (event) {
      if (event.target === profileModal) {
        closeClientProfileModal();
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

  const serviceSelect = byId("serviceName");
  if (serviceSelect) {
    serviceSelect.addEventListener("change", function () {
      updateSelectedServiceDuration();
      state.selectedSlot = null;
      updateSelectedSlotLabel();
      setAuthUi();
      renderCalendar();
    });
  }

  byId("weekStart").value = toDateInputValue(new Date());
  state.viewportConfig = resolveViewportConfig();
  syncResponsiveCssVars();
  updateSelectedSlotLabel();
  setAuthUi();

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

      state.selectedSlot = null;
      updateSelectedSlotLabel();
      refreshCalendar();
    }, 180);
  });

  const boot = function () {
    refreshClientSessionState()
      .then(function () {
        return loadCatalogs();
      })
      .then(function () {
        return refreshCalendar();
      })
      .then(function () {
        return loadMyReservations();
      })
      .catch(function (error) {
        setFeedback(error.message, "warn");
      });
  };

  if (isClientContext) {
    boot();
  } else {
    ensureRoleSessionIfNeeded()
      .then(boot)
      .catch(function (error) {
        setFeedback(error.message, "warn");
        window.location.href = LOGIN_PATH;
      });
  }
})();
