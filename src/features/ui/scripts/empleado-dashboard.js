(function () {
  const TOKEN_KEY = "sgp_token";
  const LOGIN_PATH = "/ui/login";
  const EMPLOYEE_DASHBOARD_PATH = "/ui/empleado";
  const state = {
    currentUser: null
  };

  function isEmployeeDashboardPath(pathname) {
    return pathname === EMPLOYEE_DASHBOARD_PATH || pathname === EMPLOYEE_DASHBOARD_PATH + "/";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getRole(user) {
    return String((user && user.role) || "")
      .trim()
      .toLowerCase();
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("client_token");
    localStorage.removeItem("employee_token");
    localStorage.removeItem("admin_token");
  }

  function setFeedback(message, tone) {
    const element = byId("dashboardFeedback");
    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setEmployeeAccountFeedback(message, tone) {
    const element = byId("employeeAccountFeedback");
    if (!element) {
      return;
    }

    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setSessionUi(logged) {
    byId("logoutBtn").classList.toggle("hidden", !logged);
    byId("sessionBadge").textContent = logged ? "Sesion iniciada" : "Sesion no iniciada";
  }

  function setRoleUi(user) {
    const adminLink = byId("adminAccessLink");
    if (!adminLink) {
      return;
    }

    const isAdmin = getRole(user) === "admin";
    adminLink.classList.toggle("hidden", !isAdmin);
  }

  function setEmployeeAccountUi(user) {
    const editButton = byId("openEmployeeAccountBtn");
    if (!editButton) {
      return;
    }

    const isEmployee = getRole(user) === "empleado" || getRole(user) === "employee";
    editButton.classList.toggle("hidden", !isEmployee);
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

  function openEmployeeAccountModal() {
    const modal = byId("employeeAccountModal");
    if (!modal) {
      return;
    }

    modal.classList.remove("hidden");
  }

  function closeEmployeeAccountModal() {
    const modal = byId("employeeAccountModal");
    if (!modal) {
      return;
    }

    modal.classList.add("hidden");
    const passwordInput = byId("employeeAccountPassword");
    if (passwordInput) {
      passwordInput.value = "";
    }

    setEmployeeAccountFeedback("Completa numero celular, correo y password para guardar.", "info");
  }

  function fillEmployeeAccountForm(account) {
    const nameParts = splitName(account.name);
    byId("employeeAccountFirstName").value = nameParts.firstName;
    byId("employeeAccountLastName").value = account.last_name || nameParts.lastName || "";
    byId("employeeAccountIdentification").value = account.identification || "No registrado";
    byId("employeeAccountPhone").value = account.phone || "";
    byId("employeeAccountEmail").value = account.email || "";
    byId("employeeAccountPassword").value = "";
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

  function canUseEmployeeArea(user) {
    const role = getRole(user);
    return role === "empleado" || role === "employee" || role === "admin";
  }

  async function openEmployeeAccountEditor() {
    if (!isEmployeeDashboardPath(window.location.pathname)) {
      setFeedback("La edicion de cuenta de empleado solo esta disponible en el dashboard.", "warn");
      return;
    }

    if (getRole(state.currentUser) !== "empleado" && getRole(state.currentUser) !== "employee") {
      setFeedback("Solo empleados pueden editar su cuenta desde esta vista.", "warn");
      return;
    }

    try {
      const payload = await callApi("/api/auth/me/employee-account", "GET");
      fillEmployeeAccountForm(payload.data || {});
      openEmployeeAccountModal();
      setEmployeeAccountFeedback("Puedes editar correo, celular y password.", "info");
      setFeedback("Puedes editar correo, celular y password.", "info");
    } catch (error) {
      setEmployeeAccountFeedback(error.message, "warn");
      setFeedback(error.message, "warn");
    }
  }

  async function saveEmployeeAccountEditor() {
    const phone = normalizePhoneInput((byId("employeeAccountPhone").value || "").trim());
    const email = (byId("employeeAccountEmail").value || "").trim();
    const password = (byId("employeeAccountPassword").value || "").trim();

    if (!phone || !email || !password) {
      setEmployeeAccountFeedback("Completa numero celular, correo y password para guardar.", "warn");
      setFeedback("Completa numero celular, correo y password para guardar.", "warn");
      return;
    }

    if (!isValidEmail(email)) {
      setEmployeeAccountFeedback("Ingresa un correo valido.", "warn");
      setFeedback("Ingresa un correo valido.", "warn");
      return;
    }

    if (!isValidCoPhone(phone)) {
      setEmployeeAccountFeedback("El numero debe tener formato +57XXXXXXXXXX.", "warn");
      setFeedback("El numero debe tener formato +57XXXXXXXXXX.", "warn");
      return;
    }

    if (password.length < 6) {
      setEmployeeAccountFeedback("La password debe tener al menos 6 caracteres.", "warn");
      setFeedback("La password debe tener al menos 6 caracteres.", "warn");
      return;
    }

    try {
      byId("employeeAccountPhone").value = phone;
      await callApi("/api/auth/me/employee-account", "PUT", {
        phone: phone,
        email: email,
        password: password
      });

      closeEmployeeAccountModal();
      setEmployeeAccountFeedback("Cuenta de empleado actualizada correctamente.", "ok");
      setFeedback("Cuenta de empleado actualizada correctamente.", "ok");
    } catch (error) {
      setEmployeeAccountFeedback(error.message, "warn");
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

  function formatDateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  async function loadStats() {
    try {
      const profilePayload = await callApi("/api/auth/me", "GET");
      if (!canUseEmployeeArea(profilePayload.data)) {
        throw new Error("Esta seccion es solo para empleados y administradores.");
      }

      state.currentUser = profilePayload.data;
      setRoleUi(profilePayload.data);
      setEmployeeAccountUi(profilePayload.data);

      const reservationsPayload = await callApi("/api/reservations", "GET");

      const reservations = reservationsPayload.data || [];
      const uniqueClients = new Set(
        reservations
          .map(function (reservation) {
            return reservation.client_id;
          })
          .filter(function (clientId) {
            return clientId !== null && clientId !== undefined;
          })
      );
      const todayKey = formatDateKey(new Date());

      const active = reservations.filter(function (reservation) {
        return reservation.status === "booked";
      }).length;

      const checkinToday = reservations.filter(function (reservation) {
        return (
          reservation.status === "checked_in" &&
          reservation.checked_in_at &&
          String(reservation.checked_in_at).slice(0, 10) === todayKey
        );
      }).length;

      byId("activeReservationsCount").textContent = String(active);
      byId("clientsCount").textContent = String(uniqueClients.size);
      byId("todayCheckinCount").textContent = String(checkinToday);

      setSessionUi(true);
      setFeedback("Datos de empleado sincronizados.", "ok");
    } catch (error) {
      clearToken();
      state.currentUser = null;
      setSessionUi(false);
      setRoleUi(null);
      setEmployeeAccountUi(null);
      setFeedback(error.message, "warn");
      byId("activeReservationsCount").textContent = "-";
      byId("clientsCount").textContent = "-";
      byId("todayCheckinCount").textContent = "-";
      window.location.href = LOGIN_PATH;
    }
  }

  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    state.currentUser = null;
    setEmployeeAccountUi(null);
    setSessionUi(false);
    setFeedback("Sesion cerrada.", "info");
    closeEmployeeAccountModal();
    window.location.href = LOGIN_PATH;
  });

  const openEmployeeAccountBtn = byId("openEmployeeAccountBtn");
  if (openEmployeeAccountBtn) {
    openEmployeeAccountBtn.addEventListener("click", openEmployeeAccountEditor);
  }

  const saveEmployeeAccountBtn = byId("saveEmployeeAccountBtn");
  if (saveEmployeeAccountBtn) {
    saveEmployeeAccountBtn.addEventListener("click", saveEmployeeAccountEditor);
  }

  const closeEmployeeAccountBtn = byId("closeEmployeeAccountBtn");
  if (closeEmployeeAccountBtn) {
    closeEmployeeAccountBtn.addEventListener("click", closeEmployeeAccountModal);
  }

  const cancelEmployeeAccountBtn = byId("cancelEmployeeAccountBtn");
  if (cancelEmployeeAccountBtn) {
    cancelEmployeeAccountBtn.addEventListener("click", closeEmployeeAccountModal);
  }

  const employeeAccountModal = byId("employeeAccountModal");
  if (employeeAccountModal) {
    employeeAccountModal.addEventListener("click", function (event) {
      if (event.target === employeeAccountModal) {
        closeEmployeeAccountModal();
      }
    });
  }

  const employeeAccountPhoneInput = byId("employeeAccountPhone");
  if (employeeAccountPhoneInput) {
    employeeAccountPhoneInput.addEventListener("focus", function () {
      applyCoPhonePrefix(employeeAccountPhoneInput);
    });
    employeeAccountPhoneInput.addEventListener("input", function () {
      handleCoPhoneTyping(employeeAccountPhoneInput);
    });
    employeeAccountPhoneInput.addEventListener("blur", function () {
      applyCoPhonePrefix(employeeAccountPhoneInput);
    });
  }

  setSessionUi(false);
  setRoleUi(null);
  setEmployeeAccountUi(null);
  if (!getToken()) {
    window.location.href = LOGIN_PATH;
  } else {
    loadStats();
  }

  if (window.SgpWebSocket) {
    window.SgpWebSocket.connect();

    window.SgpWebSocket.on("availability.updated", function (payload) {
      setFeedback("Disponibilidad actualizada: " + (payload.date || ""), "info");
      loadStats();
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
