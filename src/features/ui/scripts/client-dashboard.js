(function () {
  const TOKEN_KEY = "client_token";

  function byId(id) {
    return document.getElementById(id);
  }

  function setOutput(data) {
    const output = byId("apiOutput");
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

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
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

  function formatHour(isoText) {
    const parsed = new Date(isoText);
    if (Number.isNaN(parsed.getTime())) {
      return isoText;
    }

    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
  }

  function setAuthUi() {
    const hasToken = Boolean(getToken());
    byId("authBadge").textContent = hasToken ? "Sesion iniciada" : "Sesion no iniciada";
    byId("navLoginBtn").classList.toggle("hidden", hasToken);
    byId("navLogoutBtn").classList.toggle("hidden", !hasToken);
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

  async function registerClient() {
    try {
      const payload = await callApi("/api/auth/register", "POST", {
        name: byId("registerName").value.trim(),
        email: byId("registerEmail").value.trim(),
        phone: byId("registerPhone").value.trim(),
        password: byId("registerPassword").value
      });

      if (payload.data && payload.data.token) {
        setToken(payload.data.token);
      }

      setAuthUi();
      setFeedback("Registro completado. Ya puedes usar el calendario.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function loginClient() {
    try {
      const payload = await callApi("/api/auth/login", "POST", {
        email: byId("loginEmail").value.trim(),
        password: byId("loginPassword").value
      });

      if (payload.data && payload.data.token) {
        setToken(payload.data.token);
      }

      setAuthUi();
      setFeedback("Sesion iniciada correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function loadProfile() {
    try {
      const payload = await callApi("/api/auth/me", "GET");
      setFeedback("Sesion valida para: " + payload.data.email, "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function loadAvailability() {
    const dateInput = byId("availabilityDate").value;
    if (!dateInput) {
      setFeedback("Selecciona una fecha para ver los cupos.", "warn");
      return;
    }

    try {
      const payload = await callApi(
        "/api/reservations/availability?date=" + encodeURIComponent(dateInput),
        "GET"
      );

      const list = byId("availabilityList");
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

  byId("registerBtn").addEventListener("click", registerClient);
  byId("loginBtn").addEventListener("click", loginClient);
  byId("loadProfileBtn").addEventListener("click", loadProfile);
  byId("availabilityBtn").addEventListener("click", loadAvailability);
  byId("goCalendarBtn").addEventListener("click", function () {
    location.href = "/ui/client/calendar";
  });
  byId("navLoginBtn").addEventListener("click", function () {
    location.hash = "#loginSection";
  });
  byId("navLogoutBtn").addEventListener("click", function () {
    clearToken();
    setAuthUi();
    setFeedback("Sesion cerrada.", "info");
  });

  byId("availabilityDate").value = toDateInputValue(new Date());
  setAuthUi();
  loadAvailability();
})();
