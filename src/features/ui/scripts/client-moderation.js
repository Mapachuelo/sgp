(function () {
  const isAdminContext = window.location.pathname.startsWith("/ui/admin");
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

  function setFeedback(message, tone) {
    const element = byId("moderationFeedback");
    if (!element) {
      return;
    }

    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setSessionUi(logged) {
    const logoutButton = byId("logoutBtn");
    if (logoutButton) {
      logoutButton.classList.toggle("hidden", !logged);
    }
  }

  function setRoleUi(user) {
    const adminLink = byId("adminAccessLink");
    if (!adminLink) {
      return;
    }

    const isAdmin = Boolean(user && user.role === "admin");
    adminLink.classList.toggle("hidden", !isAdmin);
  }

  function toReadableDate(dateText) {
    if (!dateText) {
      return "-";
    }

    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    const hour = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return day + "/" + month + "/" + year + " " + hour + ":" + minutes;
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
      console.error("API Error:", { path, method, status: response.status, payload });
      throw new Error(payload.message || "Error en la solicitud");
    }

    return payload;
  }

  async function ensureSession() {
    const payload = await callApi("/api/auth/me", "GET");
    const user = payload.data;

    if (isAdminContext) {
      if (!user || user.role !== "admin") {
        throw new Error("Acceso restringido a administradores");
      }
      return user;
    }

    if (!user || (user.role !== "empleado" && user.role !== "employee" && user.role !== "admin")) {
      throw new Error("Acceso restringido a empleados y administradores");
    }

    return user;
  }

  let allClients = [];

  function renderTable(rows) {
    const body = byId("moderationTableBody");
    if (!body) {
      return;
    }

    body.innerHTML = "";

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.textContent = "Sin clientes para moderar.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    rows.forEach(function (row) {
      const tr = document.createElement("tr");

      const nameTd = document.createElement("td");
      nameTd.textContent = row.name || "-";
      tr.appendChild(nameTd);

      const emailTd = document.createElement("td");
      emailTd.textContent = row.email || "-";
      tr.appendChild(emailTd);

      const phoneTd = document.createElement("td");
      phoneTd.textContent = row.phone || "-";
      tr.appendChild(phoneTd);

      const activeTd = document.createElement("td");
      activeTd.textContent = String(row.active_reservations || 0);
      tr.appendChild(activeTd);

      const noShowTd = document.createElement("td");
      noShowTd.textContent = String(row.no_show_reservations || 0);
      tr.appendChild(noShowTd);

      const statusTd = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = row.is_blocked ? "status-badge blocked" : "status-badge active";
      statusBadge.textContent = row.is_blocked ? "Bloqueado" : "Habilitado";
      statusTd.appendChild(statusBadge);

      const lastReservation = document.createElement("div");
      lastReservation.className = "status-subtext";
      lastReservation.textContent = "Ultima: " + toReadableDate(row.last_reservation_at);
      statusTd.appendChild(lastReservation);
      tr.appendChild(statusTd);

      const reasonTd = document.createElement("td");
      const blockedByLabel = row.blocked_by_name
        ? " por " + String(row.blocked_by_name)
        : "";
      reasonTd.textContent = row.blocked_reason
        ? String(row.blocked_reason) + blockedByLabel
        : "-";
      tr.appendChild(reasonTd);

      const actionTd = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emp-btn ghost action-btn";
      button.dataset.clientId = String(row.id || "");

      if (row.is_blocked) {
        button.dataset.action = "unblock";
        button.textContent = "Desbloquear";
      } else {
        button.dataset.action = "block";
        button.textContent = "Bloquear";
      }

      actionTd.appendChild(button);
      tr.appendChild(actionTd);

      body.appendChild(tr);
    });
  }

  async function loadModerationTable() {
    const payload = await callApi("/api/clients/moderation", "GET");
    allClients = payload.data || [];
    applyModerationSearch();
    setFeedback("Tabla de moderacion actualizada.", "ok");
  }

  function applyModerationSearch() {
    const searchInput = byId("moderationSearchInput");
    var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    var filtered = allClients;

    if (query) {
      filtered = allClients.filter(function (client) {
        var name = (client.name || "").toLowerCase();
        var email = (client.email || "").toLowerCase();
        return name.includes(query) || email.includes(query);
      });
    }

    renderTable(filtered);
  }

  async function blockClient(clientId) {
    const reasonInput = window.prompt(
      "Indica el motivo del bloqueo",
      "Spam o mal uso de la aplicacion"
    );

    if (reasonInput === null) {
      return;
    }

    const reason = String(reasonInput || "").trim() || "Spam o mal uso de la aplicacion";
    await callApi("/api/clients/" + encodeURIComponent(clientId) + "/block", "PUT", {
      reason: reason
    });

    setFeedback("Cliente bloqueado correctamente.", "ok");
    await loadModerationTable();
  }

  async function unblockClient(clientId) {
    await callApi("/api/clients/" + encodeURIComponent(clientId) + "/unblock", "PUT");
    setFeedback("Cliente desbloqueado correctamente.", "ok");
    await loadModerationTable();
  }

  function bindEvents() {
    const searchInput = byId("moderationSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        applyModerationSearch();
      });
    }

    const refreshButton = byId("refreshModerationBtn");
    if (refreshButton) {
      refreshButton.addEventListener("click", function () {
        loadModerationTable().catch(function (error) {
          setFeedback(error.message, "warn");
        });
      });
    }

    const tableBody = byId("moderationTableBody");
    if (tableBody) {
      tableBody.addEventListener("click", function (event) {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
          return;
        }

        const action = target.dataset.action;
        const clientId = target.dataset.clientId;

        if (!clientId) {
          setFeedback("No se pudo identificar el cliente.", "warn");
          return;
        }

        const task = action === "unblock"
          ? unblockClient(clientId)
          : blockClient(clientId);

        task.catch(function (error) {
          setFeedback(error.message, "warn");
        });
      });
    }

    const logoutButton = byId("logoutBtn");
    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        clearToken();
        setSessionUi(false);
        window.location.href = LOGIN_PATH;
      });
    }
  }

  bindEvents();

  if (!getToken()) {
    window.location.href = LOGIN_PATH;
  } else {
    ensureSession()
      .then(function (user) {
        setSessionUi(true);
        setRoleUi(user);
        return loadModerationTable();
      })
      .catch(function (error) {
        clearToken();
        setSessionUi(false);
        setRoleUi(null);
        setFeedback(error.message, "warn");
        window.location.href = LOGIN_PATH;
      });
  }
})();
