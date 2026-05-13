(function () {
  const TOKEN_KEY = "sgp_token";
  const LOGIN_PATH = "/ui/login";
  const state = {
    currentUser: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setFeedback(message, tone) {
    const feedback = byId("dashboardFeedback");
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

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("client_token");
    localStorage.removeItem("employee_token");
    localStorage.removeItem("admin_token");
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

    if (!response.ok || !payload.ok) {
      const message = payload.message || "Error en la solicitud";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
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

    setClientProfileFeedback("Para guardar cambios debes completar todos los campos.", "info");
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
      setClientProfileFeedback("Edita tus datos y guarda los cambios.", "info");
      setFeedback("Edita tus datos y guarda los cambios.", "info");
    } catch (error) {
      setClientProfileFeedback(error.message, "warn");
      setFeedback(error.message, "warn");
    }
  }

  async function saveProfileEditor() {
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
      const payload = await callApi("/api/clients/me", "PUT", {
        name: name,
        phone: phone,
        email: email,
        password: password
      });

      state.currentUser = payload.data || state.currentUser;
      setAuthUi();
      closeProfileModal();
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
    } catch (error) {
      if (error && (error.status === 401 || error.status === 403)) {
        clearToken();
      }
      state.currentUser = null;
      setAuthUi();
    }
  }

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

  byId("navLoginBtn").addEventListener("click", function () {
    location.href = LOGIN_PATH;
  });
  byId("navLogoutBtn").addEventListener("click", function () {
    clearToken();
    state.currentUser = null;
    setAuthUi();
    setFeedback("Sesion cerrada.", "info");
    closeProfileModal();
    if (window.SgpWebSocket) {
      window.SgpWebSocket.disconnect();
    }
  });

  refreshSessionState();

  if (window.SgpWebSocket) {
    window.SgpWebSocket.connect();

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
