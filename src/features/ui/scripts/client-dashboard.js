(function () {
  const TOKEN_KEY = "sgp_token";
  const LOGIN_PATH = "/ui/login";
  const state = {
    currentUser: null
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
    const feedback = byId("dashboardFeedback");
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

  function toDateInputValue(date) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function formatHour(isoText) {
    const parsed = new Date(isoText);
    if (Number.isNaN(parsed.getTime())) {
      return isoText;
    }

    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
  }

  function isClientRole(user) {
    return Boolean(user && user.role === "client");
  }

  function setAuthUi() {
    const hasToken = Boolean(getToken());
    const isClientSession = hasToken && isClientRole(state.currentUser);

    byId("authBadge").textContent = isClientSession
      ? "Sesion iniciada"
      : hasToken
        ? "Sesion iniciada (rol no cliente)"
        : "Sesion no iniciada";

    byId("navLoginBtn").classList.toggle("hidden", hasToken);
    byId("navLogoutBtn").classList.toggle("hidden", !hasToken);

    const openProfileButton = byId("openProfileEditBtn");
    if (openProfileButton) {
      openProfileButton.classList.toggle("hidden", !isClientSession);
    }
  }

  function isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
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

  async function loadProfile() {
    try {
      const user = await ensureClientSession();
      if (!user) {
        setFeedback("Esta vista es solo para clientes autenticados.", "warn");
        return;
      }

      setFeedback("Sesion valida para: " + user.email, "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  function openProfileModal() {
    const modal = byId("clientProfileModal");
    if (!modal) {
      return;
    }

    modal.classList.remove("hidden");
  }

  function closeProfileModal() {
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

  function fillProfileForm(profile) {
    const nameParts = splitName(profile.name);
    byId("clientProfileFirstName").value = nameParts.firstName;
    byId("clientProfileLastName").value = nameParts.lastName;
    byId("clientProfilePhone").value = profile.phone || "";
    byId("clientProfileEmail").value = profile.email || "";
    byId("clientProfilePassword").value = "";
  }

  async function ensureClientSession() {
    const token = getToken();
    if (!token) {
      throw new Error("Debes iniciar sesion para esta accion.");
    }

    const payload = await callApi("/api/auth/me", "GET");
    const user = payload.data;
    state.currentUser = user || null;
    setAuthUi();

    if (!isClientRole(user)) {
      throw new Error("Esta accion es exclusiva para clientes.");
    }

    return user;
  }

  async function openProfileEditor() {
    try {
      await ensureClientSession();
      const payload = await callApi("/api/clients/me", "GET");
      fillProfileForm(payload.data || {});
      openProfileModal();
      setFeedback("Edita tus datos y guarda los cambios.", "info");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function saveProfileEditor() {
    const firstName = (byId("clientProfileFirstName").value || "").trim();
    const lastName = (byId("clientProfileLastName").value || "").trim();
    const name = (firstName + " " + lastName).trim();
    const phone = (byId("clientProfilePhone").value || "").trim();
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

    if (password.length < 6) {
      setFeedback("La password debe tener al menos 6 caracteres.", "warn");
      return;
    }

    try {
      const payload = await callApi("/api/clients/me", "PUT", {
        name: name,
        phone: phone,
        email: email,
        password: password
      });

      state.currentUser = payload.data || state.currentUser;
      setAuthUi();
      closeProfileModal();
      setFeedback("Perfil actualizado correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function refreshSessionState() {
    const token = getToken();
    if (!token) {
      state.currentUser = null;
      setAuthUi();
      return;
    }

    try {
      const payload = await callApi("/api/auth/me", "GET");
      state.currentUser = payload.data || null;
      setAuthUi();
    } catch (_error) {
      clearToken();
      state.currentUser = null;
      setAuthUi();
    }
  }

  async function loadAvailability() {
    const dateInputElement = byId("availabilityDate");
    const list = byId("availabilityList");
    if (!dateInputElement || !list) {
      return;
    }

    const dateInput = dateInputElement.value;
    if (!dateInput) {
      setFeedback("Selecciona una fecha para ver los cupos.", "warn");
      return;
    }

    try {
      const payload = await callApi(
        "/api/reservations/availability?date=" + encodeURIComponent(dateInput),
        "GET"
      );

      list.innerHTML = "";

      if (!payload.data || payload.data.length === 0) {
        const item = document.createElement("li");
        item.textContent = "Sin reservas para esta fecha. Todos los cupos estan disponibles.";
        list.appendChild(item);
        setFeedback("Cupos cargados. No hay reservas para la fecha seleccionada.", "ok");
        return;
      }

      payload.data.forEach(function (entry) {
        const item = document.createElement("li");
        item.textContent =
          formatHour(entry.starts_at) +
          " - " +
          entry.stylist_name +
          " (" +
          entry.status +
          ")";
        list.appendChild(item);
      });

      setFeedback("Cupos cargados para " + dateInput + ".", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  byId("loadProfileBtn").addEventListener("click", loadProfile);

  const openProfileEditBtn = byId("openProfileEditBtn");
  if (openProfileEditBtn) {
    openProfileEditBtn.addEventListener("click", openProfileEditor);
  }

  const saveProfileEditBtn = byId("saveProfileEditBtn");
  if (saveProfileEditBtn) {
    saveProfileEditBtn.addEventListener("click", saveProfileEditor);
  }

  const closeProfileEditBtn = byId("closeProfileEditBtn");
  if (closeProfileEditBtn) {
    closeProfileEditBtn.addEventListener("click", closeProfileModal);
  }

  const cancelProfileEditBtn = byId("cancelProfileEditBtn");
  if (cancelProfileEditBtn) {
    cancelProfileEditBtn.addEventListener("click", closeProfileModal);
  }

  const profileModal = byId("clientProfileModal");
  if (profileModal) {
    profileModal.addEventListener("click", function (event) {
      if (event.target === profileModal) {
        closeProfileModal();
      }
    });
  }

  const availabilityBtn = byId("availabilityBtn");
  if (availabilityBtn) {
    availabilityBtn.addEventListener("click", loadAvailability);
  }
  byId("navLoginBtn").addEventListener("click", function () {
    location.href = LOGIN_PATH;
  });
  byId("navLogoutBtn").addEventListener("click", function () {
    clearToken();
    state.currentUser = null;
    setAuthUi();
    setFeedback("Sesion cerrada.", "info");
    closeProfileModal();
  });

  const availabilityDate = byId("availabilityDate");
  if (availabilityDate) {
    availabilityDate.value = toDateInputValue(new Date());
  }
  refreshSessionState();
  if (availabilityBtn && availabilityDate) {
    loadAvailability();
  }
})();
