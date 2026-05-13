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
  const HIDDEN_CLIENT_RESERVATIONS_PREFIX = "sgp_hidden_client_reservations_";
  const FULL_START_HOUR = 6;
  const FULL_END_HOUR = 22;
  const FULL_DAY_COUNT = 7;
  const DEFAULT_SLOT_STEP_MINUTES = 30;
  const MIN_SERVICE_DURATION_MINUTES = 1;
  const MAX_SERVICE_DURATION_MINUTES = 280;
  const MAX_CALENDAR_SLOT_DURATION_MINUTES = 24 * 60;
  const MAX_ACTIVE_RESERVATIONS_PER_CLIENT = 5;

  const state = {
    days: [],
    weekStart: "",
    availabilityByDate: {},
    workScheduleByDate: {},
    selectedSlot: null,
    currentUser: null,
    stylists: [],
    services: [],
    selectedStylist: ANY_STYLIST_VALUE,
    selectedServiceName: "",
    selectedServiceDuration: DEFAULT_SLOT_STEP_MINUTES,
    selectedSlotInterval: 30,
    serviceDurationByName: {},
    serviceDurationByNameAndStylist: {},
    reservationQrById: {},
    myReservations: [],
    myReservationsLoadVersion: 0,
    viewportConfig: {
      dayCount: FULL_DAY_COUNT,
      startHour: FULL_START_HOUR,
      endHour: FULL_END_HOUR
    }
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function getToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function setFeedback(message, tone) {
    const feedback = byId("calendarFeedback");
    if (!feedback) {
      return;
    }

    feedback.textContent = message;
    feedback.className = "feedback " + tone;
  }

  function setClientProfileFeedback(message, tone) {
    const feedback = byId("clientProfileFeedback");
    if (!feedback) {
      return;
    }

    feedback.textContent = message;
    feedback.className = "feedback " + tone;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getHiddenReservationsStorageKey() {
    const clientId = Number(state.currentUser && state.currentUser.id);
    if (Number.isInteger(clientId) && clientId > 0) {
      return HIDDEN_CLIENT_RESERVATIONS_PREFIX + String(clientId);
    }

    const token = getToken();
    if (!token) {
      return HIDDEN_CLIENT_RESERVATIONS_PREFIX + "guest";
    }

    return HIDDEN_CLIENT_RESERVATIONS_PREFIX + token.slice(0, 24);
  }

  function getHiddenReservationIds() {
    const key = getHiddenReservationsStorageKey();
    const raw = localStorage.getItem(key);

    if (!raw) {
      return new Set();
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return new Set();
      }

      return new Set(
        parsed
          .map(function (value) {
            return String(value || "").trim();
          })
          .filter(Boolean)
      );
    } catch (_error) {
      return new Set();
    }
  }

  function saveHiddenReservationIds(hiddenIds) {
    const key = getHiddenReservationsStorageKey();
    const values = Array.from(hiddenIds.values());
    localStorage.setItem(key, JSON.stringify(values));
  }

  function hideReservationsInHistory(reservations) {
    const hiddenIds = getHiddenReservationIds();

    (reservations || []).forEach(function (reservation) {
      const reservationId = Number(reservation && reservation.id);
      if (!Number.isInteger(reservationId) || reservationId <= 0) {
        return;
      }

      hiddenIds.add(String(reservationId));
    });

    saveHiddenReservationIds(hiddenIds);
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

  function normalizeCalendarDuration(minutesInput, fallback) {
    const parsed = Number(minutesInput);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.min(parsed, MAX_CALENDAR_SLOT_DURATION_MINUTES);
  }

  function getSelectedClientCount() {
    const input = byId("clientCount");
    const parsed = Number(input ? input.value : 1);

    if (!Number.isInteger(parsed)) {
      return 1;
    }

    if (parsed < 1) {
      return 1;
    }

    if (parsed > 5) {
      return 5;
    }

    return parsed;
  }

  function getEffectiveSlotDurationMinutes() {
    const baseDuration = normalizeStepMinutes(state.selectedServiceDuration);
    const clientCount = getSelectedClientCount();
    const calculated = normalizeCalendarDuration(baseDuration * clientCount, baseDuration);

    if (calculated > DEFAULT_SLOT_STEP_MINUTES) {
      return calculated;
    }

    return normalizeCalendarDuration(state.selectedSlotInterval, DEFAULT_SLOT_STEP_MINUTES);
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
    const normalizedStep = normalizeCalendarDuration(stepMinutes, DEFAULT_SLOT_STEP_MINUTES);
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
      end: "22:00",
      blockedHours: []
    };
  }

  function toMinutes(timeText) {
    const parts = String(timeText || "00:00").split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function isSlotInsideWorkingHours(slot, slotDurationMinutes, config) {
    const slotMinutes = toMinutes(slot);
    const slotEndMinutes = slotMinutes + normalizeCalendarDuration(slotDurationMinutes, DEFAULT_SLOT_STEP_MINUTES);
    return slotMinutes >= toMinutes(config.start) && slotEndMinutes <= toMinutes(config.end);
  }

  function isHourBlocked(dayKey, slot, schedule) {
    const blocked = Array.isArray(schedule.blockedHours) ? schedule.blockedHours : [];
    return blocked.includes(slot);
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

    const fallbackDuration = normalizeCalendarDuration(
      reservation.duration_minutes,
      DEFAULT_SLOT_STEP_MINUTES
    );
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
    const slotEnd = new Date(
      slotStart.getTime() +
        normalizeCalendarDuration(slotDurationMinutes, DEFAULT_SLOT_STEP_MINUTES) * 60000
    );

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
    if (!trimmedName) {
      return DEFAULT_SLOT_STEP_MINUTES;
    }

    const selectedStylist = String(state.selectedStylist || ANY_STYLIST_VALUE);
    const byStylist = state.serviceDurationByNameAndStylist[trimmedName] || {};
    
    // First try to get duration for specific stylist
    const configuredByStylist = Number(byStylist[selectedStylist]);
    if (Number.isInteger(configuredByStylist) && configuredByStylist > 0) {
      return normalizeStepMinutes(configuredByStylist);
    }

    // If no stylist-specific duration, use general service duration
    const configuredDuration = state.serviceDurationByName[trimmedName];
    if (Number.isInteger(configuredDuration) && configuredDuration > 0) {
      return normalizeStepMinutes(configuredDuration);
    }

    // Fallback: try to get any stylist duration for this service
    const stylistIds = Object.keys(byStylist);
    if (stylistIds.length > 0) {
      const firstStylistDuration = Number(byStylist[stylistIds[0]]);
      if (Number.isInteger(firstStylistDuration) && firstStylistDuration > 0) {
        return normalizeStepMinutes(firstStylistDuration);
      }
    }

    // Last resort: infer from availability data
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
      reserveBtn.classList.toggle("hidden", !isClientContext);
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

    setClientProfileFeedback("Para guardar cambios debes completar todos los campos.", "info");
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
      setClientProfileFeedback("Actualiza tus datos y guarda los cambios.", "info");
      setFeedback("Actualiza tus datos y guarda los cambios.", "info");
    } catch (error) {
      setClientProfileFeedback(error.message, "warn");
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
      setClientProfileFeedback("Completa nombre, apellido, numero, correo y password para guardar.", "warn");
      setFeedback("Completa nombre, apellido, numero, correo y password para guardar.", "warn");
      return;
    }

    if (!isValidEmail(email)) {
      setClientProfileFeedback("Ingresa un correo valido.", "warn");
      setFeedback("Ingresa un correo valido.", "warn");
      return;
    }

    if (!isValidCoPhone(phone)) {
      setClientProfileFeedback("El numero debe tener formato +57XXXXXXXXXX.", "warn");
      setFeedback("El numero debe tener formato +57XXXXXXXXXX.", "warn");
      return;
    }

    if (password.length < 6) {
      setClientProfileFeedback("La password debe tener al menos 6 caracteres.", "warn");
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
      setClientProfileFeedback("Perfil actualizado correctamente.", "ok");
      setFeedback("Perfil actualizado correctamente.", "ok");
    } catch (error) {
      setClientProfileFeedback(error.message, "warn");
      setFeedback(error.message, "warn");
    }
  }

  function applyCoPhonePrefix(inputElement) {
    if (!inputElement) {
      return;
    }

    const current = String(inputElement.value || "").trim();
    if (!current) {
      inputElement.value = "+57";
      return;
    }

    inputElement.value = normalizePhoneInput(current);
  }

  function handleCoPhoneTyping(inputElement) {
    if (!inputElement) {
      return;
    }

    const compact = String(inputElement.value || "").replace(/[^\d+]/g, "");
    if (!compact) {
      inputElement.value = "+57";
      return;
    }

    if (!compact.startsWith("+57") && !compact.startsWith("57")) {
      inputElement.value = "+57" + compact.replace(/^\+/, "");
      return;
    }

    if (compact.startsWith("57")) {
      inputElement.value = "+" + compact;
      return;
    }

    inputElement.value = compact;
  }

  function closeAllReservationMenus(exceptMenuId) {
    document.querySelectorAll(".reservation-actions-menu").forEach(function (menu) {
      if (exceptMenuId && menu.id === exceptMenuId) {
        return;
      }

      menu.classList.add("hidden");
      const reservationId = String(menu.dataset.reservationId || "");
      const toggle = byId("reservationMenuToggle-" + reservationId);
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function isReservationRemovable(reservation) {
    if (!reservation) {
      return false;
    }

    const status = String(reservation.status || "").toLowerCase();
    const isLateService = Boolean(reservation.is_inasistencia);

    if (status === "cancelled") {
      return true;
    }

    if (isLateService) {
      return true;
    }

    const statusLabel = String(reservation.status_label || "").toLowerCase();
    return statusLabel.includes("atrasado") || statusLabel.includes("tardado");
  }

  function updatePurgeReservationsButton() {
    const button = byId("purgeMyReservationsBtn");
    if (!button) {
      return;
    }

    const removableCount = (state.myReservations || []).filter(isReservationRemovable).length;
    button.disabled = removableCount === 0;
    button.textContent = removableCount > 0
      ? "Borrar canceladas/tardadas (" + String(removableCount) + ")"
      : "Borrar canceladas/tardadas";
  }

  function downloadReservationQr(reservationId) {
    const parsedId = Number(reservationId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setFeedback("No se pudo identificar la reserva para descargar el QR.", "warn");
      return;
    }

    const qrDataUrl = state.reservationQrById[String(parsedId)] || "";
    if (!qrDataUrl) {
      setFeedback("No hay QR disponible para esta reserva.", "warn");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = "qr-reserva-" + String(parsedId) + ".png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setFeedback("Descarga de QR iniciada.", "ok");
  }

  function toggleReservationQrPreview(reservationId) {
    const parsedId = Number(reservationId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setFeedback("No se pudo identificar la reserva para mostrar el QR.", "warn");
      return;
    }

    const qrDataUrl = state.reservationQrById[String(parsedId)] || "";
    if (!qrDataUrl) {
      setFeedback("No hay QR disponible para esta reserva.", "warn");
      return;
    }

    const preview = byId("reservationQrPreview-" + String(parsedId));
    if (!preview) {
      setFeedback("No se pudo mostrar el QR de la reserva.", "warn");
      return;
    }

    const shouldShow = preview.classList.contains("hidden");
    preview.classList.toggle("hidden", !shouldShow);
    setFeedback(
      shouldShow
        ? "QR de ingreso visible para la reserva seleccionada."
        : "QR de ingreso oculto.",
      "info"
    );
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
      const error = new Error(message);
      error.status = response.status;
      throw error;
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

    const slotDurationMinutes = getEffectiveSlotDurationMinutes();
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
          button.textContent = "Horario no laboral";
          button.disabled = true;
        } else if (!isSlotInsideWorkingHours(slot, slotDurationMinutes, schedule)) {
          button.classList.add("reserved");
          button.textContent = "Fuera horario";
          button.disabled = true;
        } else if (isHourBlocked(dayKey, slot, schedule)) {
          button.classList.add("reserved");
          button.textContent = "Horario no laboral";
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
        end: entry.end || "22:00",
        blockedHours: Array.isArray(entry.blockedHours) ? entry.blockedHours : []
      };
    });

    return map;
  }

  async function refreshCalendar() {
    const weekStartInput = byId("weekStart");
    const startValue = state.weekStart || (weekStartInput ? weekStartInput.value : "");
    if (!startValue) {
      setFeedback("Selecciona una fecha de inicio.", "warn");
      return;
    }

    state.weekStart = startValue;
    if (weekStartInput && weekStartInput.value !== startValue) {
      weekStartInput.value = startValue;
    }

    state.viewportConfig = resolveViewportConfig();
    syncResponsiveCssVars();
    state.days = buildDateRange(startValue, state.viewportConfig.dayCount);
    state.availabilityByDate = {};
    state.workScheduleByDate = {};

    try {
      state.workScheduleByDate = await fetchWorkScheduleRange(startValue, state.viewportConfig.dayCount);
    } catch (error) {
      if (error && (error.status === 401 || error.status === 403)) {
        clearToken();
      }
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
    let profile = {};
    if (getToken()) {
      try {
        const profilePayload = await callApi("/api/auth/me", "GET");
        profile = profilePayload.data || {};
      } catch (_error) {
        profile = {};
      }
    }

    const [stylistsPayload, servicesPayload] = await Promise.all([
      callApi("/api/auth/stylists", "GET"),
      callApi("/api/reservations/services", "GET")
    ]);

    const isEmployeeContext = profile.role === "empleado" || profile.role === "employee";

    state.stylists = stylistsPayload.data || [];
    state.services = servicesPayload.data || [];

    // Populate stylist selector in booking modal
    const bookingStylistSelect = byId("bookingStylistName");
    if (bookingStylistSelect) {
      bookingStylistSelect.innerHTML = "";

      const anyOption = document.createElement("option");
      anyOption.value = ANY_STYLIST_VALUE;
      anyOption.textContent = "Selecciona al empleado";
      bookingStylistSelect.appendChild(anyOption);

      state.stylists.forEach(function (stylist) {
        if (isEmployeeContext && Number(stylist.id) !== Number(profile.id)) {
          return;
        }

        const option = document.createElement("option");
        option.value = String(stylist.id);
        option.textContent = stylist.name;
        bookingStylistSelect.appendChild(option);
      });

      state.selectedStylist = bookingStylistSelect.value || ANY_STYLIST_VALUE;
    }

    // Also populate legacy stylist selector (for employee/admin views)
    const stylistSelect = byId("stylistName");
    if (stylistSelect) {
      stylistSelect.innerHTML = "";

      const anyOption = document.createElement("option");
      anyOption.value = ANY_STYLIST_VALUE;
      anyOption.textContent = "Selecciona al empleado";
      stylistSelect.appendChild(anyOption);

      state.stylists.forEach(function (stylist) {
        if (isEmployeeContext && Number(stylist.id) !== Number(profile.id)) {
          return;
        }

        const option = document.createElement("option");
        option.value = String(stylist.id);
        option.textContent = stylist.name;
        stylistSelect.appendChild(option);
      });

      state.selectedStylist = stylistSelect.value || ANY_STYLIST_VALUE;
    }

    // Build service duration maps (used by modal and calendar regardless of view)
    (servicesPayload.data || []).forEach(function (service) {
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

      updateSelectedServiceDuration();
    }
  }

  function addMinutesToDate(date, minutes) {
    return new Date(date.getTime() + Number(minutes) * 60000);
  }

  function computeMobileEstimate() {
    const slot = state.selectedSlot;
    if (!slot) {
      return;
    }

    const serviceName = (byId("bookingServiceName") || byId("serviceName")).value || "";
    const clientCount = Number((byId("bookingClientCount") || byId("clientCount")).value || 1);
    const base = inferServiceDurationMinutes(serviceName);
    const totalDuration = normalizeCalendarDuration(base * clientCount, base);

    const startDate = toLocalDateFromParts(slot.date, slot.time);
    const endDate = addMinutesToDate(startDate, totalDuration);

    const startText = String(slot.time);
    const endText = String(endDate.getHours()).padStart(2, "0") + ":" + String(endDate.getMinutes()).padStart(2, "0");

    const estimateEl = byId("bookingTimeEstimate");
    if (estimateEl) {
      estimateEl.textContent = "Inicio: " + startText + "  Fin estimada: " + endText;
      estimateEl.classList.remove("hidden");
    }

    // validate against schedule
    const schedule = state.workScheduleByDate[slot.date] || defaultSchedule();
    const endMinutes = toMinutes(endText);
    const allowedEndMinutes = toMinutes(schedule.end);
    const startMinutes = toMinutes(slot.time);
    const availableMinutes = allowedEndMinutes - startMinutes;

    const errorEl = byId("bookingError");
    const confirmBtn = byId("confirmBookingBtn");
    
    // calculate max allowed client count based on available time
    const maxAllowedClients = base > 0 ? Math.floor(availableMinutes / base) : 5;
    const safeMaxClients = Math.min(Math.max(maxAllowedClients, 1), 5);
    
    // update max attribute on client count inputs
    const mainClientCount = byId("clientCount");
    const modalClientCount = byId("bookingClientCount");
    if (mainClientCount) {
      mainClientCount.max = String(safeMaxClients);
    }
    if (modalClientCount) {
      modalClientCount.max = String(safeMaxClients);
    }
    
    if (clientCount > safeMaxClients || endMinutes > allowedEndMinutes) {
      if (errorEl) {
        errorEl.textContent = "Se sobrepasa el tiempo estimado que está disponible del empleado. Máximo " + safeMaxClients + " persona(s) para este horario.";
        errorEl.classList.remove("hidden");
      }
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
    } else {
      if (errorEl) {
        errorEl.classList.add("hidden");
      }
      if (confirmBtn) {
        confirmBtn.disabled = !isClientContext || !getToken();
      }
    }
  }

  function applyMaxClientCountLimit() {
    const slot = state.selectedSlot;
    if (!slot) {
      return;
    }

    const serviceName = (byId("bookingServiceName") || byId("serviceName")).value || "";
    const base = inferServiceDurationMinutes(serviceName);
    if (!base || base <= 0) {
      return;
    }

    const schedule = state.workScheduleByDate[slot.date] || defaultSchedule();
    const startMinutes = toMinutes(slot.time);
    const allowedEndMinutes = toMinutes(schedule.end);
    const availableMinutes = allowedEndMinutes - startMinutes;

    const maxAllowedClients = Math.floor(availableMinutes / base);
    const safeMaxClients = Math.min(Math.max(maxAllowedClients, 1), 5);

    const mainClientCount = byId("clientCount");
    const modalClientCount = byId("bookingClientCount");
    
    if (mainClientCount) {
      mainClientCount.max = String(safeMaxClients);
    }
    if (modalClientCount) {
      modalClientCount.max = String(safeMaxClients);
    }
  }

  function getServicesForStylist(stylistId) {
    var services = [];
    var isAnyStylist = !stylistId || stylistId === ANY_STYLIST_VALUE;

    if (state.services && state.services.length > 0) {
      state.services.forEach(function (service) {
        var name = String(service.name || "").trim();
        if (!name) return;

        var durationsByStylist = state.serviceDurationByNameAndStylist[name] || {};
        var hasStylistConfig = false;

        Object.keys(durationsByStylist).forEach(function (sid) {
          if (String(sid) === String(stylistId)) {
            hasStylistConfig = true;
          }
        });

        if (isAnyStylist || hasStylistConfig) {
          services.push(service);
        }
      });
    }

    return services;
  }

  function getServiceDurationLabel(serviceName, stylistId) {
    var durationsByStylist = state.serviceDurationByNameAndStylist[serviceName] || {};
    var duration = durationsByStylist[String(stylistId)];

    if (!duration) {
      duration = state.serviceDurationByName[serviceName];
    }

    if (!duration) {
      return "";
    }

    if (duration >= 60) {
      var hours = Math.floor(duration / 60);
      var mins = duration % 60;
      return mins > 0 ? hours + "h " + mins + "min" : hours + "h";
    }

    return duration + "min";
  }

  function populateBookingServices(stylistId) {
    var bookingService = byId("bookingServiceName");
    if (!bookingService) return;

    bookingService.innerHTML = "";

    var defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Selecciona un servicio";
    bookingService.appendChild(defaultOption);

    var availableServices = getServicesForStylist(stylistId);

    if (availableServices.length === 0) {
      var noOption = document.createElement("option");
      noOption.value = "";
      noOption.textContent = "Sin servicios configurados";
      noOption.disabled = true;
      bookingService.appendChild(noOption);
      return;
    }

    availableServices.forEach(function (service) {
      var option = document.createElement("option");
      option.value = service.name;
      var durationLabel = getServiceDurationLabel(service.name, stylistId);
      option.textContent = durationLabel ? service.name + " (" + durationLabel + ")" : service.name;
      bookingService.appendChild(option);
    });
  }

  function openBookingModal() {
    const modal = byId("bookingModal");
    if (!modal || !state.selectedSlot) {
      return;
    }

    clearBookingError();

    const slot = state.selectedSlot;
    const selectedText = byId("selectedSlotText");
    if (selectedText) {
      selectedText.textContent = "Horario seleccionado: " + slot.date + " a las " + slot.time;
    }

    // sync stylist selector in modal
    const bookingStylist = byId("bookingStylistName");
    if (bookingStylist) {
      bookingStylist.value = state.selectedStylist || ANY_STYLIST_VALUE;
    }

    // populate service selector filtered by stylist
    populateBookingServices(state.selectedStylist || ANY_STYLIST_VALUE);

    // sync client count
    const mainClientCount = byId("clientCount");
    const bookingClientCount = byId("bookingClientCount");
    if (bookingClientCount && mainClientCount) {
      bookingClientCount.value = mainClientCount.value || 1;
    }

    // calculate and apply max client count based on work schedule
    applyMaxClientCountLimit();

    modal.classList.remove("hidden");
    computeMobileEstimate();
  }

  function closeBookingModal() {
    const modal = byId("bookingModal");
    if (!modal) {
      return;
    }

    modal.classList.add("hidden");
  }

  function toIsoFromSelection(selection) {
    var parts = selection.date.split("-");
    var timeParts = selection.time.split(":");
    var year = Number(parts[0]);
    var month = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    var hour = Number(timeParts[0]);
    var minute = Number(timeParts[1]);

    var bogotaOffset = -5 * 60;
    var utcDate = new Date(Date.UTC(year, month, day, hour, minute));
    var bogotaTime = new Date(utcDate.getTime() - bogotaOffset * 60000);
    return bogotaTime.toISOString();
  }

  function showBookingError(message) {
    var errorEl = byId("bookingError");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
    }
    var confirmBtn = byId("confirmBookingBtn");
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  }

  function clearBookingError() {
    var errorEl = byId("bookingError");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }
  }

  async function createReservation() {
    clearBookingError();

    if (!isClientContext) {
      showBookingError("Solo clientes pueden confirmar reservas.");
      return;
    }

    if (!state.selectedSlot) {
      showBookingError("El horario seleccionado ya no esta disponible.");
      return;
    }

    var slot = state.selectedSlot;
    var schedule = state.workScheduleByDate[slot.date] || defaultSchedule();
    if (schedule.offDay) {
      showBookingError("El horario no esta disponible (dia no laboral).");
      state.selectedSlot = null;
      updateSelectedSlotLabel();
      return;
    }
    if (isHourBlocked(slot.date, slot.time, schedule)) {
      showBookingError("El horario no esta disponible (bloqueado).");
      state.selectedSlot = null;
      updateSelectedSlotLabel();
      return;
    }
    if (!isSlotInsideWorkingHours(slot.time, getEffectiveSlotDurationMinutes(), schedule)) {
      showBookingError("El horario no esta disponible (fuera de horario laboral).");
      state.selectedSlot = null;
      updateSelectedSlotLabel();
      return;
    }

    if (!getToken()) {
      showBookingError("Necesitas iniciar sesion para reservar.");
      setAuthUi();
      return;
    }

    var serviceName = (byId("bookingServiceName") || byId("serviceName")).value.trim();
    var stylistId = (byId("bookingStylistName") || byId("stylistName")).value;
    var clientCount = Number((byId("bookingClientCount") || byId("clientCount")).value || 1);

    if (!serviceName) {
      showBookingError("Debes seleccionar un servicio.");
      return;
    }

    if (!stylistId || stylistId === ANY_STYLIST_VALUE) {
      showBookingError("Seleccione un empleado.");
      return;
    }

    if (!Number.isInteger(clientCount) || clientCount < 1 || clientCount > 5) {
      showBookingError("La cantidad de clientes debe estar entre 1 y 5.");
      return;
    }

    var activeReservationsCount = state.myReservations.filter(function (res) {
      return res.status === "booked";
    }).length;

    if (activeReservationsCount >= MAX_ACTIVE_RESERVATIONS_PER_CLIENT) {
      showBookingError("Has alcanzado el maximo de " + MAX_ACTIVE_RESERVATIONS_PER_CLIENT + " reservas activas. Cancela alguna existente para crear una nueva.");
      return;
    }

    var hasActiveReservation = state.myReservations.some(function (res) {
      if (res.status !== "booked") return false;
      var resDate = toLocalDate(res.starts_at);
      var resTime = toLocalTime(res.starts_at);
      return resDate === state.selectedSlot.date &&
             resTime === state.selectedSlot.time &&
             String(res.stylist_id) === String(stylistId);
    });

    if (hasActiveReservation) {
      showBookingError("Ya tienes una reserva activa con ese empleado a esa hora. Cancela la reserva existente o elige otro horario.");
      return;
    }

    try {
      var payload = await callApi("/api/reservations", "POST", {
        serviceName: serviceName,
        stylistId: stylistId,
        startsAt: toIsoFromSelection(state.selectedSlot),
        clientCount: clientCount
      });

      if (payload.data && payload.data.qr_data_url) {
        setFeedback("Reserva registrada con exito. Gestiona tu QR en Mis reservas.", "ok");
      } else {
        setFeedback("Reserva registrada con exito.", "ok");
      }
      closeBookingModal();
      await refreshCalendar();
      await loadMyReservations();
    } catch (error) {
      showBookingError(error.message);
    }
  }

  function populateMyReservationsPreview() {
    const preview = byId("myReservationsPreview");
    if (!preview) {
      return;
    }

    preview.innerHTML = "";

    if (!isClientContext || !getToken()) {
      const p = document.createElement("p");
      p.className = "preview-placeholder";
      p.textContent = isClientContext
        ? "Inicia sesion para ver tus reservas"
        : "Reservas visibles solo para clientes";
      preview.appendChild(p);
      return;
    }

    const now = new Date();
    const upcoming = state.myReservations
      .filter(function (res) {
        const startDate = new Date(res.starts_at);
        return res.status === "booked" && startDate > now;
      })
      .sort(function (a, b) {
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      })
      .slice(0, 3);

    if (upcoming.length === 0) {
      const p = document.createElement("p");
      p.className = "preview-placeholder";
      p.textContent = "No tienes reservas proximas";
      preview.appendChild(p);
      return;
    }

    upcoming.forEach(function (res) {
      const time = toLocalTime(res.starts_at);
      const date = toLocalDate(res.starts_at);
      const serviceName = res.service_name || "Servicio";
      const stylistName = res.stylist_name || "Peluquero";

      const item = document.createElement("div");
      item.className = "preview-item";
      item.style.padding = "0.6rem";
      item.style.borderRadius = "6px";
      item.style.borderLeft = "3px solid var(--available-line)";
      item.style.background = "rgba(237,246,240,0.5)";
      item.style.fontSize = "0.85rem";
      item.innerHTML =
        '<strong>' + serviceName + '</strong><br/>' +
        date + ' a las ' + time + '<br/>' +
        '<span style="color: var(--stone); font-size: 0.8rem;">Con: ' + stylistName + '</span>';
      preview.appendChild(item);
    });
  }

  async function loadMyReservations() {
    const loadVersion = state.myReservationsLoadVersion + 1;
    state.myReservationsLoadVersion = loadVersion;

    const list = byId("myReservationsList");
    if (!list) {
      return;
    }

    list.innerHTML = "";
    state.myReservations = [];
    updatePurgeReservationsButton();

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
      if (loadVersion !== state.myReservationsLoadVersion) {
        return;
      }

      const reservations = (payload.data || []).filter(function (reservation) {
        return reservation && reservation.status;
      });

      const seenReservations = new Set();
      const uniqueReservations = reservations.filter(function (reservation) {
        const reservationId = Number(reservation && reservation.id);
        if (!Number.isInteger(reservationId) || reservationId <= 0) {
          return true;
        }

        const key = String(reservationId);
        if (seenReservations.has(key)) {
          return false;
        }

        seenReservations.add(key);
        return true;
      });

      const hiddenIds = getHiddenReservationIds();
      const visibleReservations = uniqueReservations.filter(function (reservation) {
        const reservationId = Number(reservation && reservation.id);
        if (!Number.isInteger(reservationId) || reservationId <= 0) {
          return true;
        }

        return !hiddenIds.has(String(reservationId));
      });

      state.myReservations = visibleReservations;
      state.reservationQrById = {};
      updatePurgeReservationsButton();

      const activeReservations = visibleReservations.filter(function (reservation) {
        return reservation.status === "booked";
      }).length;

      setFeedback(
        "Reservas activas: " + String(activeReservations) + ". Solo una activa por servicio.",
        "info"
      );

      if (visibleReservations.length === 0) {
        const item = document.createElement("li");
        item.textContent = "No tienes reservas visibles.";
        list.appendChild(item);
        return;
      }

      visibleReservations.forEach(function (reservation) {
        const reservationId = Number(reservation.id);
        if (!Number.isInteger(reservationId) || reservationId <= 0) {
          return;
        }

        state.reservationQrById[String(reservationId)] = String(reservation.qr_data_url || "");

        const item = document.createElement("li");
        item.className = "reservation-item reservation-card";

        const time = toLocalTime(reservation.starts_at);
        const date = toLocalDate(reservation.starts_at);

        const head = document.createElement("div");
        head.className = "reservation-head";

        const status = document.createElement("span");
        status.className =
          "reservation-state " + (reservation.status === "cancelled" ? "inactive" : "active");
        status.textContent = reservation.status_label || "Activa";

        const menuWrap = document.createElement("div");
        menuWrap.className = "reservation-menu-wrap";
        if (reservation.status !== "booked") {
          menuWrap.classList.add("hidden");
        }

        const menuToggle = document.createElement("button");
        menuToggle.type = "button";
        menuToggle.className = "reservation-menu-toggle";
        menuToggle.dataset.reservationId = String(reservationId);
        menuToggle.id = "reservationMenuToggle-" + String(reservationId);
        menuToggle.setAttribute("aria-haspopup", "true");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Acciones de reserva");
        menuToggle.innerHTML =
          '<span class="hamburger-lines" aria-hidden="true"><span></span><span></span><span></span></span>' +
          '<span class="menu-label">Acciones</span>';

        const menu = document.createElement("div");
        menu.className = "reservation-actions-menu hidden";
        menu.id = "reservationActionsMenu-" + String(reservationId);
        menu.dataset.reservationId = String(reservationId);
        menuToggle.setAttribute("aria-controls", menu.id);

        const downloadBtn = document.createElement("button");
        downloadBtn.type = "button";
        downloadBtn.className = "reservation-action-btn";
        downloadBtn.dataset.action = "download-qr";
        downloadBtn.dataset.reservationId = String(reservationId);
        downloadBtn.textContent = "Descargar codigo QR";

        const showBtn = document.createElement("button");
        showBtn.type = "button";
        showBtn.className = "reservation-action-btn";
        showBtn.dataset.action = "show-qr";
        showBtn.dataset.reservationId = String(reservationId);
        showBtn.textContent = "Mostrar codigo QR para ingreso";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "reservation-action-btn danger";
        deleteBtn.dataset.action = "delete-reservation";
        deleteBtn.dataset.reservationId = String(reservationId);
        deleteBtn.textContent = "Eliminar reserva";

        menu.appendChild(downloadBtn);
        menu.appendChild(showBtn);
        menu.appendChild(deleteBtn);
        menuWrap.appendChild(menuToggle);
        menuWrap.appendChild(menu);

        head.appendChild(status);
        head.appendChild(menuWrap);

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

        const qrPreview = document.createElement("div");
        qrPreview.className = "reservation-qr-preview hidden";
        qrPreview.id = "reservationQrPreview-" + String(reservationId);

        if (reservation.qr_data_url) {
          const qrLabel = document.createElement("p");
          qrLabel.className = "reservation-qr-label";
          qrLabel.textContent = "Codigo QR para ingreso";

          const qrImage = document.createElement("img");
          qrImage.className = "reservation-qr-image";
          qrImage.src = String(reservation.qr_data_url);
          qrImage.alt = "QR reserva " + String(reservationId);

          qrPreview.appendChild(qrLabel);
          qrPreview.appendChild(qrImage);
        } else {
          const missingQr = document.createElement("p");
          missingQr.className = "reservation-qr-label";
          missingQr.textContent = "QR no disponible para esta reserva.";
          qrPreview.appendChild(missingQr);
        }

        item.appendChild(head);
        item.appendChild(details);
        item.appendChild(qrPreview);
        list.appendChild(item);
      });

      populateMyReservationsPreview();
    } catch (error) {
      if (loadVersion !== state.myReservationsLoadVersion) {
        return;
      }

      updatePurgeReservationsButton();
      const item = document.createElement("li");
      item.textContent = error.message;
      list.appendChild(item);

      populateMyReservationsPreview();
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
    closeAllReservationMenus();
  }

  async function cancelReservation(reservationId) {
    const parsedId = Number(reservationId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setFeedback("No se pudo identificar la reserva a eliminar.", "warn");
      return;
    }

    try {
      await callApi(
        "/api/reservations/me/" + encodeURIComponent(String(parsedId)),
        "DELETE"
      );
      await refreshCalendar();
      await loadMyReservations();
      setFeedback("Reservas actualizadas.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function purgeRemovableReservations() {
    if (!isClientContext) {
      return;
    }

    if (!getToken()) {
      setFeedback("Debes iniciar sesion para borrar reservas canceladas o tardadas.", "warn");
      return;
    }

    const removableReservations = (state.myReservations || []).filter(isReservationRemovable);
    if (removableReservations.length === 0) {
      setFeedback("No hay reservas canceladas o tardadas para borrar.", "info");
      return;
    }

    hideReservationsInHistory(removableReservations);
    await loadMyReservations();
    setFeedback(
      "Se limpiaron " +
        String(removableReservations.length) +
        " reservas canceladas/tardadas de tu lista.",
      "ok"
    );
  }

  const calendarBody = byId("calendarBody");
  if (calendarBody) {
    calendarBody.addEventListener("click", function (event) {
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

    if (!isClientContext) {
      setFeedback("Horario seleccionado para consulta. Solo clientes pueden confirmar reservas.", "info");
    } else if (!getToken()) {
      setFeedback("Horario seleccionado. Para confirmar reserva debes iniciar sesion.", "warn");
    } else {
      setFeedback("Horario seleccionado y listo para reservar.", "info");
    }

    setAuthUi();

    if (isClientContext) {
      openBookingModal();
    }
    });
  }

  const employeeDropdownBtn = byId("employeeDropdownBtn");
  const employeeDropdownList = byId("employeeDropdownList");
  if (employeeDropdownBtn && employeeDropdownList) {
    function renderEmployeeDropdown(query) {
      employeeDropdownList.innerHTML = "";
      const filtered = state.stylists.filter(function (s) {
        return !query || s.name.toLowerCase().includes(query);
      });

      const allOption = document.createElement("button");
      allOption.type = "button";
      allOption.className = "dropdown-item";
      allOption.textContent = "Cualquier empleado";
      allOption.addEventListener("click", function () {
        state.selectedStylist = ANY_STYLIST_VALUE;
        employeeDropdownBtn.textContent = "Seleccionar empleado";
        employeeDropdownList.classList.add("hidden");
        refreshCalendar();
      });
      employeeDropdownList.appendChild(allOption);

      filtered.forEach(function (stylist) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dropdown-item";
        item.textContent = stylist.name;
        item.addEventListener("click", function () {
          state.selectedStylist = String(stylist.id);
          employeeDropdownBtn.textContent = stylist.name;
          employeeDropdownList.classList.add("hidden");
          refreshCalendar();
        });
        employeeDropdownList.appendChild(item);
      });
    }

    employeeDropdownBtn.addEventListener("click", function () {
      employeeDropdownList.classList.toggle("hidden");
      if (!employeeDropdownList.classList.contains("hidden")) {
        renderEmployeeDropdown("");
      }
    });

    document.addEventListener("click", function (e) {
      if (!employeeDropdownBtn.contains(e.target) && !employeeDropdownList.contains(e.target)) {
        employeeDropdownList.classList.add("hidden");
      }
    });
  }

  const slotIntervalSelect = byId("slotIntervalSelect");
  if (slotIntervalSelect) {
    slotIntervalSelect.addEventListener("change", function () {
      state.selectedSlotInterval = Number(slotIntervalSelect.value) || 30;
      state.selectedSlot = null;
      updateSelectedSlotLabel();
      renderCalendar();
    });
  }
  
  // Note: confirmBookingBtn listener is registered in registerBookingControls() above
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

  const purgeReservationsBtn = byId("purgeMyReservationsBtn");
  if (purgeReservationsBtn) {
    purgeReservationsBtn.addEventListener("click", purgeRemovableReservations);
    updatePurgeReservationsButton();
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
      if (!(target instanceof Element)) {
        return;
      }

      const menuToggle = target.closest(".reservation-menu-toggle");
      if (menuToggle) {
        const reservationId = String(menuToggle.dataset.reservationId || "");
        const menu = byId("reservationActionsMenu-" + reservationId);
        if (!menu) {
          return;
        }

        const isOpening = menu.classList.contains("hidden");
        closeAllReservationMenus(isOpening ? menu.id : "");
        menu.classList.toggle("hidden", !isOpening);
        menuToggle.setAttribute("aria-expanded", isOpening ? "true" : "false");
        return;
      }

      const actionBtn = target.closest(".reservation-action-btn");
      if (!actionBtn) {
        return;
      }

      const reservationId = String(actionBtn.dataset.reservationId || "");
      const action = String(actionBtn.dataset.action || "");
      closeAllReservationMenus();

      if (action === "download-qr") {
        downloadReservationQr(reservationId);
        return;
      }

      if (action === "show-qr") {
        toggleReservationQrPreview(reservationId);
        return;
      }

      if (action === "delete-reservation") {
        cancelReservation(reservationId);
      }
    });
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(".reservation-menu-wrap")) {
      return;
    }

    closeAllReservationMenus();
  });

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
      // keep selected date fixed when filtering stylists
      state.weekStart = byId("weekStart").value || state.weekStart;
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
      // preserve date selection while changing service
      state.weekStart = byId("weekStart").value || state.weekStart;
      renderCalendar();
    });
  }

  const weekStartInput = byId("weekStart");
  if (weekStartInput) {
    weekStartInput.addEventListener("change", function () {
      state.weekStart = weekStartInput.value || state.weekStart;
    });
  }

  // Booking modal controls (register once)
  (function registerBookingControls() {
    const bookingStylist = byId("bookingStylistName");
    if (bookingStylist) {
      bookingStylist.addEventListener("change", function () {
        state.selectedStylist = bookingStylist.value || ANY_STYLIST_VALUE;
        populateBookingServices(state.selectedStylist);
        state.weekStart = byId("weekStart").value || state.weekStart;
        refreshCalendar();
        applyMaxClientCountLimit();
        computeMobileEstimate();
      });
    }

    const bookingService = byId("bookingServiceName");
    if (bookingService) {
      bookingService.addEventListener("change", function () {
        const mainService = byId("serviceName");
        if (mainService) {
          mainService.value = bookingService.value;
        }
        state.selectedServiceName = bookingService.value;
        applyMaxClientCountLimit();
        computeMobileEstimate();
      });
    }

    const bookingClientCount = byId("bookingClientCount");
    if (bookingClientCount) {
      bookingClientCount.addEventListener("input", function () {
        const val = Number(bookingClientCount.value || 1);
        if (!Number.isInteger(val) || val < 1) {
          bookingClientCount.value = "1";
        }

        const mainClient = byId("clientCount");
        if (mainClient) {
          mainClient.value = bookingClientCount.value;
        }

        computeMobileEstimate();
      });
    }

    const closeBtn = byId("closeBookingModalBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closeBookingModal();
      });
    }

    const confirmBtn = byId("confirmBookingBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        var bookingService = byId("bookingServiceName");
        var bookingStylist = byId("bookingStylistName");
        var bookingClientCount = byId("bookingClientCount");

        var mainService = byId("serviceName");
        var mainStylist = byId("stylistName");
        var mainClient = byId("clientCount");

        if (bookingService && mainService) {
          mainService.value = bookingService.value;
        }
        if (bookingStylist && mainStylist) {
          mainStylist.value = bookingStylist.value;
        }
        if (bookingClientCount && mainClient) {
          mainClient.value = bookingClientCount.value;
        }

        createReservation();
      });
    }
  })();

  const clientCountInput = byId("clientCount");
  if (clientCountInput) {
    clientCountInput.addEventListener("input", function () {
      const maxAllowed = Number(clientCountInput.max || 5);
      const value = Number(clientCountInput.value || 1);
      if (!Number.isInteger(value) || value < 1) {
        clientCountInput.value = "1";
      } else if (value > maxAllowed) {
        clientCountInput.value = String(maxAllowed);
      }

      const modalClient = byId("bookingClientCount");
      if (modalClient) {
        modalClient.value = clientCountInput.value;
      }

      state.selectedSlot = null;
      updateSelectedSlotLabel();
      setAuthUi();
      renderCalendar();
    });
  }

  const clientProfilePhoneInput = byId("clientProfilePhone");
  if (clientProfilePhoneInput) {
    clientProfilePhoneInput.addEventListener("focus", function () {
      applyCoPhonePrefix(clientProfilePhoneInput);
    });
    clientProfilePhoneInput.addEventListener("input", function () {
      handleCoPhoneTyping(clientProfilePhoneInput);
    });
    clientProfilePhoneInput.addEventListener("blur", function () {
      applyCoPhonePrefix(clientProfilePhoneInput);
    });
  }

  state.weekStart = toDateInputValue(new Date());
  byId("weekStart").value = state.weekStart;
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
    // Initialize weekStart with today's date if not set
    if (!state.weekStart) {
      state.weekStart = getToday();
      const weekStartInput = byId("weekStart");
      if (weekStartInput) {
        weekStartInput.value = state.weekStart;
      }
    }

    refreshClientSessionState()
      .then(function () {
        return loadCatalogs().catch(function (error) {
          setFeedback("No se pudo cargar el catalogo completo: " + error.message, "warn");
          return null;
        });
      })
      .then(function () {
        return refreshCalendar();
      })
      .then(function () {
        var slotIntervalSelect = byId("slotIntervalSelect");
        if (slotIntervalSelect) {
          slotIntervalSelect.value = String(state.selectedSlotInterval);
        }
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

  if (window.SgpWebSocket) {
    window.SgpWebSocket.connect();

    window.SgpWebSocket.on("availability.updated", function () {
      refreshCalendar();
    });

    window.SgpWebSocket.on("*", function (type) {
      if (type === "connected") return;
      showWsToast("Notificacion: " + type);
    });
  }

  function showWsToast(message) {
    var toast = byId("wsToast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(function () {
      toast.classList.add("hidden");
    }, 4000);
  }
})();
