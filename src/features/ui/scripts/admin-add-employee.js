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

  function roleLabel(role) {
    if (role === "employee") {
      return "Empleado";
    }

    if (role === "admin") {
      return "Administrador";
    }

    return role || "";
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

    if (!data.role) {
      missing.push("rol");
    }

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
    if (!data.password) {
      missing.push("password");
    }

    if (missing.length > 0) {
      return "Completa los campos: " + missing.join(", ");
    }

    if (data.password.length < 6) {
      return "La password asignada debe tener al menos 6 caracteres";
    }

    return "";
  }

  function getFormData() {
    return {
      role: byId("role").value,
      firstName: byId("firstName").value.trim(),
      lastName: byId("lastName").value.trim(),
      phone: byId("phone").value.trim(),
      identification: byId("identification").value.trim(),
      email: byId("email").value.trim(),
      password: byId("password").value
    };
  }

  function clearForm() {
    byId("role").value = "employee";
    byId("firstName").value = "";
    byId("lastName").value = "";
    byId("phone").value = "";
    byId("identification").value = "";
    byId("email").value = "";
    byId("password").value = "";
  }

  function renderEmployees(rows) {
    const body = byId("employeesTableBody");
    body.innerHTML = "";

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
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

      const role = document.createElement("td");
      role.textContent = roleLabel(row.role);
      tr.appendChild(role);

      const actions = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "admin-btn ghost edit-employee-btn";
      editBtn.textContent = "Editar";
      editBtn.dataset.employeeId = String(row.id || "");
      editBtn.dataset.employeePhone = row.phone || "";
      editBtn.dataset.employeeEmail = row.email || "";
      editBtn.dataset.employeeRole = row.role || "";
      editBtn.dataset.employeeIdentification = row.identification || "";
      editBtn.dataset.employeeName = [row.name || "", row.last_name || ""].join(" ").trim();
      editBtn.disabled = !row.id;
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "admin-btn ghost delete-employee-btn";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.dataset.employeeId = String(row.id || "");
      deleteBtn.dataset.employeeName = [row.name || "", row.last_name || ""].join(" ").trim();
      deleteBtn.dataset.employeeRole = row.role || "";
      deleteBtn.disabled = !row.id;
      actions.appendChild(deleteBtn);
      tr.appendChild(actions);

      body.appendChild(tr);
    });
  }

  async function loadEmployees() {
    const payload = await callApi("/api/auth/employees", "GET");
    renderEmployees(payload.data || []);
  }

  async function createEmployee(event) {
    event.preventDefault();

    const data = getFormData();
    const validationMessage = validateForm(data);

    if (validationMessage) {
      setFeedback(validationMessage, "warn");
      return;
    }

    try {
      await callApi("/api/auth/employees", "POST", data);
      clearForm();
      await loadEmployees();
      setFeedback("Empleado agregado correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function updateEmployee(employeeId, currentPhone, currentEmail, employeeRole, employeeName) {
    void employeeRole;
    void employeeName;
    if (!employeeId) {
      setFeedback("No se pudo identificar el usuario a editar.", "warn");
      return;
    }

    byId("editUserId").value = String(employeeId);
    byId("editPhone").value = String(currentPhone || "");
    byId("editEmail").value = String(currentEmail || "");
    byId("editPassword").value = "";

    const modal = byId("editUserModal");
    modal.classList.remove("hidden");
  }

  function closeEditModal() {
    byId("editUserModal").classList.add("hidden");
    byId("editUserForm").reset();
  }

  async function saveEditFromModal(event) {
    event.preventDefault();

    const employeeId = byId("editUserId").value;
    const phone = byId("editPhone").value.trim();
    const email = byId("editEmail").value.trim();
    const password = byId("editPassword").value.trim();

    if (!employeeId || !phone || !email || !password) {
      setFeedback("Completa numero, correo y password para guardar.", "warn");
      return;
    }

    if (password.length < 6) {
      setFeedback("La password debe tener al menos 6 caracteres.", "warn");
      return;
    }

    try {
      await callApi("/api/auth/employees/" + encodeURIComponent(employeeId), "PUT", {
        phone: phone,
        email: email,
        password: password
      });
      closeEditModal();
      await loadEmployees();
      setFeedback("Perfil actualizado correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function deleteEmployee(employeeId, employeeName, employeeRole) {
    if (!employeeId) {
      setFeedback("No se pudo identificar el empleado a eliminar.", "warn");
      return;
    }

    const accepted = window.confirm(
      "Eliminar al usuario " +
        (employeeName || "seleccionado") +
        " (rol " +
        roleLabel(employeeRole || "") +
        ") de la base de datos?"
    );
    if (!accepted) {
      return;
    }

    try {
      await callApi("/api/auth/employees/" + encodeURIComponent(employeeId), "DELETE");
      setTempPasswordHint("");
      await loadEmployees();
      setFeedback("Empleado eliminado correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  function renderServices(services) {
    const list = byId("servicesList");
    list.innerHTML = "";

    if (!services || services.length === 0) {
      const item = document.createElement("li");
      item.textContent = "Sin servicios registrados.";
      list.appendChild(item);
      return;
    }

    services.forEach(function (service) {
      const item = document.createElement("li");
      item.textContent = service.name + " ";

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "admin-btn ghost delete-service-btn";
      removeBtn.textContent = "Eliminar";
      removeBtn.dataset.serviceId = String(service.id || "");
      removeBtn.dataset.serviceName = service.name || "";
      item.appendChild(removeBtn);

      list.appendChild(item);
    });
  }

  async function loadServices() {
    const payload = await callApi("/api/reservations/services", "GET");
    renderServices(payload.data || []);
  }

  async function addService() {
    const name = byId("serviceNameInput").value.trim();
    if (!name) {
      setFeedback("Debes ingresar un nombre de servicio.", "warn");
      return;
    }

    try {
      await callApi("/api/reservations/services", "POST", { name: name });
      byId("serviceNameInput").value = "";
      await loadServices();
      setFeedback("Servicio agregado correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  async function deleteService(serviceId, serviceName) {
    if (!serviceId) {
      return;
    }

    const accepted = window.confirm(
      "Eliminar el servicio \"" + (serviceName || "") + "\"?"
    );
    if (!accepted) {
      return;
    }

    try {
      await callApi("/api/reservations/services/" + encodeURIComponent(serviceId), "DELETE");
      await loadServices();
      setFeedback("Servicio eliminado correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
    }
  }

  byId("employeeForm").addEventListener("submit", createEmployee);
  byId("refreshEmployeesBtn").addEventListener("click", function () {
    loadEmployees().catch(function (error) {
      setFeedback(error.message, "warn");
    });
  });
  byId("addServiceBtn").addEventListener("click", addService);
  byId("servicesList").addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (!target.classList.contains("delete-service-btn")) {
      return;
    }

    deleteService(target.dataset.serviceId, target.dataset.serviceName);
  });
  byId("employeesTableBody").addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.classList.contains("edit-employee-btn")) {
      byId("editIdentification").value = target.dataset.employeeIdentification || "";
      byId("editUserSubtitle").textContent =
        "Editando: " +
        (target.dataset.employeeName || "Usuario") +
        " (rol " +
        roleLabel(target.dataset.employeeRole || "") +
        ")";
      updateEmployee(
        target.dataset.employeeId,
        target.dataset.employeePhone,
        target.dataset.employeeEmail,
        target.dataset.employeeRole,
        target.dataset.employeeName
      );
      return;
    }

    if (!target.classList.contains("delete-employee-btn")) {
      return;
    }

    deleteEmployee(
      target.dataset.employeeId,
      target.dataset.employeeName,
      target.dataset.employeeRole
    );
  });
  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    setSessionUi(false);
    setTempPasswordHint("");
    renderEmployees([]);
    setFeedback("Sesion cerrada.", "info");
    window.location.href = LOGIN_PATH;
  });

  byId("editUserForm").addEventListener("submit", saveEditFromModal);
  byId("closeEditUserBtn").addEventListener("click", closeEditModal);
  byId("cancelEditUserBtn").addEventListener("click", closeEditModal);
  byId("editUserModal").addEventListener("click", function (event) {
    if (event.target === byId("editUserModal")) {
      closeEditModal();
    }
  });

  if (!getToken()) {
    setSessionUi(false);
    window.location.href = LOGIN_PATH;
  } else {
    ensureAdminSession()
      .then(function () {
        setSessionUi(true);
        return Promise.all([loadEmployees(), loadServices()]);
      })
      .then(function () {
        setFeedback("Sesion de administrador activa.", "ok");
      })
      .catch(function (error) {
        clearToken();
        setSessionUi(false);
        setFeedback(error.message, "warn");
        window.location.href = LOGIN_PATH;
      });
  }
})();
