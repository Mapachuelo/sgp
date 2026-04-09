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

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("client_token");
    localStorage.removeItem("employee_token");
    localStorage.removeItem("admin_token");
  }

  function setOutput(payload) {
    const output = byId("apiOutput");
    if (!output) {
      return;
    }

    output.textContent = JSON.stringify(payload, null, 2);
  }

  function setFeedback(message, tone) {
    const element = byId("dashboardFeedback");
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

    const isAdmin = Boolean(user && user.role === "admin");
    adminLink.classList.toggle("hidden", !isAdmin);
  }

  function setEmployeeAccountUi(user) {
    const editButton = byId("openEmployeeAccountBtn");
    if (!editButton) {
      return;
    }

    const isDashboardView = isEmployeeDashboardPath(window.location.pathname);
    const isEmployee = Boolean(user && user.role === "employee");
    editButton.classList.toggle("hidden", !(isEmployee && isDashboardView));
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

  function canUseEmployeeArea(user) {
    return user && (user.role === "employee" || user.role === "admin");
  }

  async function openEmployeeAccountEditor() {
    if (!isEmployeeDashboardPath(window.location.pathname)) {
      setFeedback("La edicion de cuenta de empleado solo esta disponible en el dashboard.", "warn");
      return;
    }

    if (!state.currentUser || state.currentUser.role !== "employee") {
      setFeedback("Solo empleados pueden editar su cuenta desde esta vista.", "warn");
      return;
    }

    try {
      const payload = await callApi("/api/auth/me/employee-account", "GET");
      fillEmployeeAccountForm(payload.data || {});
      openEmployeeAccountModal();
      setFeedback("Puedes editar correo, celular y password.", "info");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function saveEmployeeAccountEditor() {
    const phone = (byId("employeeAccountPhone").value || "").trim();
    const email = (byId("employeeAccountEmail").value || "").trim();
    const password = (byId("employeeAccountPassword").value || "").trim();

    if (!phone || !email || !password) {
      setFeedback("Completa numero celular, correo y password para guardar.", "warn");
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
      await callApi("/api/auth/me/employee-account", "PUT", {
        phone: phone,
        email: email,
        password: password
      });

      closeEmployeeAccountModal();
      setFeedback("Cuenta de empleado actualizada correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
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

  setSessionUi(false);
  setRoleUi(null);
  setEmployeeAccountUi(null);
  if (!getToken()) {
    window.location.href = LOGIN_PATH;
  } else {
    loadStats();
  }
})();
