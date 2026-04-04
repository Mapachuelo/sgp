(function () {
  const TOKEN_KEY = "employee_token";

  function byId(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function setOutput(payload) {
    byId("apiOutput").textContent = JSON.stringify(payload, null, 2);
  }

  function setFeedback(message, tone) {
    const element = byId("dashboardFeedback");
    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setSessionUi(logged) {
    byId("loginCard").classList.toggle("hidden", logged);
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

  function formatDateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  async function loadStats() {
    try {
      const profilePayload = await callApi("/api/auth/me", "GET");
      if (!canUseEmployeeArea(profilePayload.data)) {
        clearToken();
        setSessionUi(false);
        setRoleUi(null);
        setFeedback("Esta seccion es solo para empleados y administradores.", "warn");
        return;
      }

      setRoleUi(profilePayload.data);

      const clientsPayload = await callApi("/api/clients", "GET");
      const reservationsPayload = await callApi("/api/reservations", "GET");

      const reservations = reservationsPayload.data || [];
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
      byId("clientsCount").textContent = String((clientsPayload.data || []).length);
      byId("todayCheckinCount").textContent = String(checkinToday);

      setSessionUi(true);
      setFeedback("Datos de empleado sincronizados.", "ok");
    } catch (error) {
      setRoleUi(null);
      setFeedback(error.message, "warn");
      byId("activeReservationsCount").textContent = "-";
      byId("clientsCount").textContent = "-";
      byId("todayCheckinCount").textContent = "-";
    }
  }

  async function loginEmployee() {
    const email = byId("loginEmail").value.trim();
    const password = byId("loginPassword").value;

    try {
      const payload = await callApi("/api/auth/login", "POST", {
        email: email,
        password: password
      });

      if (!canUseEmployeeArea(payload.data && payload.data.user)) {
        clearToken();
        setSessionUi(false);
        setFeedback("Solo cuentas con rol empleado o administrador pueden ingresar aqui.", "warn");
        return;
      }

      setToken(payload.data.token);
      await loadStats();
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  byId("loginBtn").addEventListener("click", loginEmployee);
  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    setSessionUi(false);
    setFeedback("Sesion cerrada.", "info");
  });

  setSessionUi(Boolean(getToken()));
  setRoleUi(null);
  if (getToken()) {
    loadStats();
  }
})();
