(function () {
  const ADMIN_TOKEN_KEY = "admin_token";
  const EMPLOYEE_TOKEN_KEY = "employee_token";

  function byId(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  }

  function setToken(token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(EMPLOYEE_TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
  }

  function setOutput(payload) {
    byId("apiOutput").textContent = JSON.stringify(payload, null, 2);
  }

  function setFeedback(message, tone) {
    const element = byId("adminFeedback");
    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setTempPasswordHint(message) {
    const hint = byId("tempPasswordHint");
    if (!message) {
      hint.classList.add("hidden");
      hint.textContent = "";
      return;
    }

    hint.classList.remove("hidden");
    hint.textContent = message;
  }

  function setSessionUi(isLogged) {
    byId("loginCard").classList.toggle("hidden", isLogged);
    byId("employeeForm").classList.toggle("hidden", !isLogged);
    byId("logoutBtn").classList.toggle("hidden", !isLogged);
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

  async function ensureAdminSession() {
    const profile = await callApi("/api/auth/me", "GET");
    if (!profile.data || profile.data.role !== "admin") {
      throw new Error("Solo administradores pueden acceder a esta seccion");
    }
  }

  function validateForm(data) {
    const missing = [];

    if (!data.firstName) {
      missing.push("nombre");
    }
    if (!data.lastName) {
      missing.push("apellido");
    }
    if (!data.phone) {
      missing.push("numero");
    }
    if (!data.identification) {
      missing.push("identificacion");
    }
    if (!data.email) {
      missing.push("correo");
    }

    if (missing.length > 0) {
      return "Completa los campos: " + missing.join(", ");
    }

    return "";
  }

  function getFormData() {
    return {
      firstName: byId("firstName").value.trim(),
      lastName: byId("lastName").value.trim(),
      phone: byId("phone").value.trim(),
      identification: byId("identification").value.trim(),
      email: byId("email").value.trim()
    };
  }

  function clearForm() {
    byId("firstName").value = "";
    byId("lastName").value = "";
    byId("phone").value = "";
    byId("identification").value = "";
    byId("email").value = "";
  }

  function renderEmployees(rows) {
    const body = byId("employeesTableBody");
    body.innerHTML = "";

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "Sin empleados registrados.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    rows.forEach(function (row) {
      const tr = document.createElement("tr");

      const name = document.createElement("td");
      name.textContent = row.name || "";
      tr.appendChild(name);

      const lastName = document.createElement("td");
      lastName.textContent = row.last_name || "";
      tr.appendChild(lastName);

      const phone = document.createElement("td");
      phone.textContent = row.phone || "";
      tr.appendChild(phone);

      const identification = document.createElement("td");
      identification.textContent = row.identification || "";
      tr.appendChild(identification);

      const email = document.createElement("td");
      email.textContent = row.email || "";
      tr.appendChild(email);

      body.appendChild(tr);
    });
  }

  async function loadEmployees() {
    const payload = await callApi("/api/auth/employees", "GET");
    renderEmployees(payload.data || []);
  }

  async function loginAdmin() {
    const email = byId("adminEmail").value.trim();
    const password = byId("adminPassword").value;

    try {
      const payload = await callApi("/api/auth/login", "POST", {
        email: email,
        password: password
      });

      if (!payload.data || !payload.data.user || payload.data.user.role !== "admin") {
        clearToken();
        setSessionUi(false);
        setFeedback("La cuenta no tiene permisos de administrador.", "warn");
        return;
      }

      setToken(payload.data.token);
      setSessionUi(true);
      await loadEmployees();
      setFeedback("Sesion de administrador iniciada.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function createEmployee(event) {
    event.preventDefault();
    setTempPasswordHint("");

    const data = getFormData();
    const validationMessage = validateForm(data);

    if (validationMessage) {
      setFeedback(validationMessage, "warn");
      return;
    }

    try {
      const payload = await callApi("/api/auth/employees", "POST", data);
      clearForm();
      await loadEmployees();
      setFeedback("Empleado agregado correctamente.", "ok");

      if (payload.data && payload.data.temporaryPassword) {
        setTempPasswordHint(
          "Password temporal del nuevo empleado: " + payload.data.temporaryPassword
        );
      }
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  byId("loginBtn").addEventListener("click", loginAdmin);
  byId("employeeForm").addEventListener("submit", createEmployee);
  byId("refreshEmployeesBtn").addEventListener("click", function () {
    loadEmployees().catch(function (error) {
      setFeedback(error.message, "warn");
    });
  });
  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    setSessionUi(false);
    setTempPasswordHint("");
    renderEmployees([]);
    setFeedback("Sesion cerrada.", "info");
  });

  if (!getToken()) {
    setSessionUi(false);
  } else {
    ensureAdminSession()
      .then(function () {
        setSessionUi(true);
        return loadEmployees();
      })
      .then(function () {
        setFeedback("Sesion de administrador activa.", "ok");
      })
      .catch(function (error) {
        clearToken();
        setSessionUi(false);
        setFeedback(error.message, "warn");
      });
  }
})();
