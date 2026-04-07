(function () {
  const TOKEN_KEY = "sgp_token";
  const LOGIN_PATH = "/ui/login";

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
        throw new Error("Esta seccion es solo para empleados y administradores.");
      }

      setRoleUi(profilePayload.data);

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
      setSessionUi(false);
      setRoleUi(null);
      setFeedback(error.message, "warn");
      byId("activeReservationsCount").textContent = "-";
      byId("clientsCount").textContent = "-";
      byId("todayCheckinCount").textContent = "-";
      window.location.href = LOGIN_PATH;
    }
  }

  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    setSessionUi(false);
    setFeedback("Sesion cerrada.", "info");
    window.location.href = LOGIN_PATH;
  });

  setSessionUi(false);
  setRoleUi(null);
  if (!getToken()) {
    window.location.href = LOGIN_PATH;
  } else {
    loadStats();
  }
})();
