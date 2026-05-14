(function () {
  const TOKEN_KEY = "sgp_token";
  const LOGIN_PATH = "/ui/login";
  const DEFAULT_DURATION_MINUTES = 30;
  const MIN_DURATION_MINUTES = 1;
  const MAX_DURATION_MINUTES = 280;

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

  function roleLabel(role) {
    if (role === "empleado" || role === "employee") {
      return "Empleado";
    }

    if (role === "admin") {
      return "Administrador";
    }

    return role || "";
  }

  function parsePositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  function setFeedback(message, tone, modalId) {
    const element = modalId ? byId("moderationFeedback") : byId("adminFeedback");
    if (!element) return;
    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setInlineFeedback(elementId, message, tone) {
    const element = byId(elementId);
    if (!element) {
      return;
    }

    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setDefaultModalFeedback(modalId) {
    if (modalId === "adminEmployeeModal") {
      setInlineFeedback(
        "adminEmployeeFeedback",
        "Completa todos los campos para crear un usuario interno.",
        "info"
      );
      return;
    }

    if (modalId === "adminServicesModal") {
      setInlineFeedback(
        "adminServicesFeedback",
        "Agrega servicios que luego podras asignar a empleados.",
        "info"
      );
      return;
    }

    if (modalId === "adminRegisteredModal") {
      setInlineFeedback(
        "adminRegisteredFeedback",
        "Desde esta tabla puedes editar, eliminar o configurar tiempos de servicios.",
        "info"
      );
      return;
    }

    if (modalId === "editUserModal") {
      setInlineFeedback(
        "editUserFeedback",
        "Puedes guardar numero y correo sin cambiar la contraseña.",
        "info"
      );
    }
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

    document.querySelectorAll(".admin-session-only").forEach(function (element) {
      element.classList.toggle("hidden", !isLogged);
    });
  }

  function openModal(modalId) {
    const modal = byId(modalId);
    if (!modal) {
      return;
    }

    modal.classList.remove("hidden");
  }

  function closeModal(modalId) {
    const modal = byId(modalId);
    if (!modal) {
      return;
    }

    modal.classList.add("hidden");
  }

  function setupAdminModals() {
    const modalConfig = [
      {
        modalId: "adminEmployeeModal",
        openButtonId: "openEmployeeModalBtn",
        closeButtonId: "closeEmployeeModalBtn"
      },
      {
        modalId: "adminServicesModal",
        openButtonId: "openServicesModalBtn",
        closeButtonId: "closeServicesModalBtn"
      },
      {
        modalId: "adminRegisteredModal",
        openButtonId: "openRegisteredModalBtn",
        closeButtonId: "closeRegisteredModalBtn"
      },
      {
        modalId: "adminModerationModal",
        openButtonId: "openModerationModalBtn",
        closeButtonId: "closeModerationModalBtn",
        onOpen: loadModerationTable
      },
      {
        modalId: "adminLocationsModal",
        openButtonId: "openLocationsModalBtn",
        closeButtonId: "closeLocationsModalBtn",
        onOpen: loadLocations
      },
      {
        modalId: "adminLocationFormModal",
        openButtonId: null,
        closeButtonId: "closeLocationFormModalBtn"
      },
      {
        modalId: "adminAssignLocationsModal",
        openButtonId: "openAssignLocationsModalBtn",
        closeButtonId: "closeAssignLocationsModalBtn",
        onOpen: loadAssignLocationsTable
      }
    ];

    modalConfig.forEach(function (item) {
      const openButton = byId(item.openButtonId);
      const closeButton = byId(item.closeButtonId);
      const modal = byId(item.modalId);

      if (openButton) {
        openButton.addEventListener("click", function () {
          openModal(item.modalId);
          setDefaultModalFeedback(item.modalId);
          if (item.onOpen) {
            item.onOpen();
          }
        });
      }

      if (closeButton) {
        closeButton.addEventListener("click", function () {
          closeModal(item.modalId);
        });
      }

      if (modal) {
        modal.addEventListener("click", function (event) {
          if (event.target === modal) {
            closeModal(item.modalId);
          }
        });
      }
    });
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

  async function ensureAdminSession() {
    const profile = await callApi("/api/auth/me", "GET");
    if (!profile.data || profile.data.role !== "admin") {
      throw new Error("Solo administradores pueden acceder a esta seccion");
    }
  }

  function validateForm(data) {
    if (!data.role) {
      return "La casilla rol es obligatoria.";
    }

    if (!data.firstName) {
      return "La casilla nombre es obligatoria.";
    }
    if (!data.lastName) {
      return "La casilla apellido es obligatoria.";
    }
    if (!data.phone) {
      return "La casilla numero es obligatoria.";
    }
    if (!data.identification) {
      return "La casilla identificacion es obligatoria.";
    }
    if (!data.email) {
      return "La casilla correo es obligatoria.";
    }
    if (!data.password) {
      return "La casilla password es obligatoria.";
    }

    if (data.password.length < 6) {
      return "La password asignada debe tener al menos 6 caracteres";
    }

    if (!isValidCoPhone(data.phone)) {
      return "El numero debe tener formato +57XXXXXXXXXX.";
    }

    if (data.role === "empleado" && !data.locationId) {
      return "El lugar de servicio es obligatorio para empleados.";
    }

    return "";
  }

  function getFormData() {
    return {
      role: byId("role").value,
      firstName: byId("firstName").value.trim(),
      lastName: byId("lastName").value.trim(),
      phone: normalizePhoneInput(byId("phone").value.trim()),
      identification: byId("identification").value.trim(),
      email: byId("email").value.trim(),
      password: byId("password").value,
      locationId: byId("employeeLocation").value || null
    };
  }

  function clearForm() {
    byId("role").value = "empleado";
    byId("firstName").value = "";
    byId("lastName").value = "";
    byId("phone").value = "";
    byId("identification").value = "";
    byId("email").value = "";
    byId("password").value = "";
  }

  let allEmployees = [];

  function renderEmployees(rows) {
    const body = byId("employeesTableBody");
    body.innerHTML = "";

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
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

      const location = document.createElement("td");
      location.textContent = row.location_name || "Sin asignar";
      tr.appendChild(location);

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

      const configBtn = document.createElement("button");
      configBtn.type = "button";
      configBtn.className = "admin-btn ghost configure-times-btn";
      configBtn.textContent = "Servicios y tiempos";
      configBtn.dataset.employeeId = String(row.id || "");
      configBtn.dataset.employeeName = [row.name || "", row.last_name || ""].join(" ").trim();
      configBtn.dataset.employeeRole = row.role || "";
      configBtn.disabled = !row.id || (row.role !== "empleado" && row.role !== "employee");
      actions.appendChild(configBtn);

      tr.appendChild(actions);

      body.appendChild(tr);
    });
  }

  async function loadEmployees() {
    const payload = await callApi("/api/auth/employees", "GET");
    allEmployees = payload.data || [];
    applyEmployeeSearch();
  }

  function applyEmployeeSearch() {
    const searchInput = byId("employeeSearchInput");
    var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    var filtered = allEmployees;

    if (query) {
      filtered = allEmployees.filter(function (emp) {
        var name = (emp.name || "").toLowerCase();
        var lastName = (emp.last_name || "").toLowerCase();
        var email = (emp.email || "").toLowerCase();
        var identification = (emp.identification || "").toLowerCase();
        return name.includes(query) || lastName.includes(query) || email.includes(query) || identification.includes(query);
      });
    }

    renderEmployees(filtered);
  }

  async function createEmployee(event) {
    event.preventDefault();

    const data = getFormData();
    const validationMessage = validateForm(data);

    if (validationMessage) {
      setInlineFeedback("adminEmployeeFeedback", validationMessage, "warn");
      setFeedback(validationMessage, "warn");
      return;
    }

    try {
      await callApi("/api/auth/employees", "POST", data);
      clearForm();
      await loadEmployees();
      setInlineFeedback("adminEmployeeFeedback", "Usuario interno creado correctamente.", "ok");
      setFeedback("Empleado agregado correctamente.", "ok");
    } catch (error) {
      setInlineFeedback("adminEmployeeFeedback", error.message, "warn");
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
    setDefaultModalFeedback("editUserModal");

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

    if (!employeeId || !phone || !email) {
      setInlineFeedback("editUserFeedback", "Numero y correo son obligatorios.", "warn");
      setFeedback("Numero y correo son obligatorios.", "warn");
      return;
    }

    if (password && password.length < 6) {
      setInlineFeedback("editUserFeedback", "La password debe tener al menos 6 caracteres.", "warn");
      setFeedback("La password debe tener al menos 6 caracteres.", "warn");
      return;
    }

    const normalizedPhone = normalizePhoneInput(phone);
    if (!isValidCoPhone(normalizedPhone)) {
      setInlineFeedback("editUserFeedback", "El numero debe tener formato +57XXXXXXXXXX.", "warn");
      setFeedback("El numero debe tener formato +57XXXXXXXXXX.", "warn");
      return;
    }

    try {
      byId("editPhone").value = normalizedPhone;
      const payload = {
        phone: normalizedPhone,
        email: email
      };

      if (password) {
        payload.password = password;
      }

      await callApi("/api/auth/employees/" + encodeURIComponent(employeeId), "PUT", payload);
      closeEditModal();
      await loadEmployees();
      setInlineFeedback("adminRegisteredFeedback", "Perfil actualizado correctamente.", "ok");
      setFeedback("Perfil actualizado correctamente.", "ok");
    } catch (error) {
      setInlineFeedback("editUserFeedback", error.message, "warn");
      setFeedback(error.message, "warn");
    }
  }

  async function deleteEmployee(employeeId, employeeName, employeeRole) {
    if (!employeeId) {
      setInlineFeedback("adminRegisteredFeedback", "No se pudo identificar el empleado a eliminar.", "warn");
      setFeedback("No se pudo identificar el empleado a eliminar.", "warn");
      return;
    }

    try {
      await callApi("/api/auth/employees/" + encodeURIComponent(employeeId), "DELETE");
      setTempPasswordHint("");
      await loadEmployees();
      setInlineFeedback("adminRegisteredFeedback", "Empleado eliminado correctamente.", "ok");
      setFeedback("Empleado eliminado correctamente.", "ok");
    } catch (error) {
      setInlineFeedback("adminRegisteredFeedback", error.message, "warn");
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
      setInlineFeedback("adminServicesFeedback", "Debes ingresar un nombre de servicio.", "warn");
      setFeedback("Debes ingresar un nombre de servicio.", "warn");
      return;
    }

    try {
      await callApi("/api/reservations/services", "POST", { name: name });
      byId("serviceNameInput").value = "";
      await loadServices();
      setInlineFeedback("adminServicesFeedback", "Servicio agregado correctamente.", "ok");
      setFeedback("Servicio agregado correctamente.", "ok");
    } catch (error) {
      setInlineFeedback("adminServicesFeedback", error.message, "warn");
      setFeedback(error.message, "warn");
    }
  }

  async function deleteService(serviceId, serviceName) {
    if (!serviceId) {
      return;
    }

    try {
      await callApi("/api/reservations/services/" + encodeURIComponent(serviceId), "DELETE");
      await loadServices();
      setInlineFeedback("adminServicesFeedback", "Servicio eliminado correctamente.", "ok");
      setFeedback("Servicio eliminado correctamente.", "ok");
    } catch (error) {
      setInlineFeedback("adminServicesFeedback", error.message, "warn");
      setFeedback(error.message, "warn");
    }
  }

  function closeEmployeeServiceTimesModal() {
    const modal = byId("employeeServiceTimesModal");
    if (modal) {
      modal.classList.add("hidden");
    }

    const list = byId("employeeServiceTimesList");
    if (list) {
      list.innerHTML = "";
    }

    byId("employeeServiceTimesUserId").value = "";
  }

  function renderEmployeeServiceTimes(entries) {
    const container = byId("employeeServiceTimesList");
    container.innerHTML = "";

    if (!entries || entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "helper";
      empty.textContent = "No hay servicios registrados para configurar.";
      container.appendChild(empty);
      return;
    }

    entries.forEach(function (entry) {
      const row = document.createElement("div");
      row.className = "service-time-item";

      const left = document.createElement("label");
      left.className = "service-time-name";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "service-time-enabled";
      checkbox.dataset.serviceId = String(entry.serviceId);
      checkbox.checked = Boolean(entry.enabled);
      left.appendChild(checkbox);

      const text = document.createElement("span");
      text.textContent = entry.name || "Servicio";
      left.appendChild(text);

      const minutesInput = document.createElement("input");
      minutesInput.type = "number";
      minutesInput.className = "service-time-duration";
      minutesInput.min = String(MIN_DURATION_MINUTES);
      minutesInput.max = String(MAX_DURATION_MINUTES);
      minutesInput.step = "1";
      minutesInput.value = String(entry.durationMinutes || DEFAULT_DURATION_MINUTES);
      minutesInput.dataset.serviceId = String(entry.serviceId);
      minutesInput.disabled = !checkbox.checked;

      checkbox.addEventListener("change", function () {
        minutesInput.disabled = !checkbox.checked;
      });

      row.appendChild(left);
      row.appendChild(minutesInput);
      container.appendChild(row);
    });
  }

  async function openEmployeeServiceTimesModal(employeeId, employeeName, employeeRole) {
    if (employeeRole !== "empleado" && employeeRole !== "employee") {
      setInlineFeedback(
        "adminRegisteredFeedback",
        "Solo puedes configurar tiempos para usuarios con rol empleado.",
        "warn"
      );
      setFeedback("Solo puedes configurar tiempos para usuarios con rol empleado.", "warn");
      return;
    }

    const normalizedEmployeeId = parsePositiveInt(employeeId);
    if (!normalizedEmployeeId) {
      setInlineFeedback("adminRegisteredFeedback", "No se pudo identificar el empleado seleccionado.", "warn");
      setFeedback("No se pudo identificar el empleado seleccionado.", "warn");
      return;
    }

    try {
      const payload = await callApi(
        "/api/reservations/employee-service-times?employeeId=" +
          encodeURIComponent(String(normalizedEmployeeId)),
        "GET"
      );

      const modal = byId("employeeServiceTimesModal");
      const subtitle = byId("employeeServiceTimesSubtitle");
      subtitle.textContent =
        "Editando servicios de: " +
        (employeeName || "Empleado") +
        ". Habilita el servicio y define su tiempo en minutos.";

      byId("employeeServiceTimesUserId").value = String(normalizedEmployeeId);
      renderEmployeeServiceTimes((payload.data && payload.data.services) || []);
      modal.classList.remove("hidden");
    } catch (error) {
      setInlineFeedback("adminRegisteredFeedback", error.message, "warn");
      setFeedback(error.message, "warn");
    }
  }

  async function saveEmployeeServiceTimesFromModal() {
    const employeeId = parsePositiveInt(byId("employeeServiceTimesUserId").value);
    if (!employeeId) {
      setInlineFeedback("adminRegisteredFeedback", "No se pudo identificar el empleado a configurar.", "warn");
      setFeedback("No se pudo identificar el empleado a configurar.", "warn");
      return;
    }

    const rows = Array.from(byId("employeeServiceTimesList").querySelectorAll(".service-time-item"));
    const entries = [];

    for (const row of rows) {
      const checkbox = row.querySelector(".service-time-enabled");
      const durationInput = row.querySelector(".service-time-duration");
      if (!checkbox || !durationInput) {
        continue;
      }

      const serviceId = parsePositiveInt(checkbox.dataset.serviceId);
      if (!serviceId) {
        continue;
      }

      const enabled = Boolean(checkbox.checked);
      const duration = Number(durationInput.value || DEFAULT_DURATION_MINUTES);

      if (enabled) {
        if (
          !Number.isInteger(duration) ||
          duration < MIN_DURATION_MINUTES ||
          duration > MAX_DURATION_MINUTES
        ) {
          setInlineFeedback(
            "adminRegisteredFeedback",
            "Cada duracion activa debe ser un entero entre 1 y 280 minutos.",
            "warn"
          );
          setFeedback("Cada duracion activa debe ser un entero entre 1 y 280 minutos.", "warn");
          return;
        }
      }

      entries.push({
        serviceId: serviceId,
        enabled: enabled,
        durationMinutes: duration
      });
    }

    try {
      await callApi(
        "/api/reservations/employee-service-times?employeeId=" + encodeURIComponent(String(employeeId)),
        "PUT",
        { entries: entries }
      );
      closeEmployeeServiceTimesModal();
      setInlineFeedback("adminRegisteredFeedback", "Servicios y tiempos guardados correctamente.", "ok");
      setFeedback("Servicios y tiempos guardados correctamente.", "ok");
    } catch (error) {
      setInlineFeedback("adminRegisteredFeedback", error.message, "warn");
      setFeedback(error.message, "warn");
    }
  }

  byId("employeeForm").addEventListener("submit", createEmployee);

  byId("role").addEventListener("change", function () {
    const locationSelect = byId("employeeLocation");
    if (locationSelect) {
      locationSelect.style.display = this.value === "empleado" ? "" : "none";
      locationSelect.previousElementSibling.style.display = this.value === "empleado" ? "" : "none";
    }
  });
  byId("role").dispatchEvent(new Event("change"));

  byId("refreshEmployeesBtn").addEventListener("click", function () {
    loadEmployees().catch(function (error) {
      setInlineFeedback("adminRegisteredFeedback", error.message, "warn");
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
      setDefaultModalFeedback("editUserModal");
      return;
    }

    if (!target.classList.contains("delete-employee-btn")) {
      if (!target.classList.contains("configure-times-btn")) {
        return;
      }

      openEmployeeServiceTimesModal(
        target.dataset.employeeId,
        target.dataset.employeeName,
        target.dataset.employeeRole
      );
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

  byId("saveEmployeeServiceTimesBtn").addEventListener(
    "click",
    saveEmployeeServiceTimesFromModal
  );
  byId("closeEmployeeServiceTimesBtn").addEventListener("click", closeEmployeeServiceTimesModal);
  byId("cancelEmployeeServiceTimesBtn").addEventListener("click", closeEmployeeServiceTimesModal);
  byId("employeeServiceTimesModal").addEventListener("click", function (event) {
    if (event.target === byId("employeeServiceTimesModal")) {
      closeEmployeeServiceTimesModal();
    }
  });

  setupAdminModals();
  bindModerationEvents();

  const employeeSearchInput = byId("employeeSearchInput");
  if (employeeSearchInput) {
    employeeSearchInput.addEventListener("input", function () {
      applyEmployeeSearch();
    });
  }

  if (!getToken()) {
    setSessionUi(false);
    window.location.href = LOGIN_PATH;
  } else {
    ensureAdminSession()
      .then(function () {
        setSessionUi(true);
        return Promise.all([loadEmployees(), loadServices(), loadLocations()]);
      })
      .then(function () {
        setFeedback("Sesion de administrador activa.", "ok");
        initWsNotifications();
      })
      .catch(function (error) {
        clearToken();
        setSessionUi(false);
        setFeedback(error.message, "warn");
        window.location.href = LOGIN_PATH;
      });
  }

  function initWsNotifications() {
    if (!window.SgpWebSocket) return;

    window.SgpWebSocket.connect();

    window.SgpWebSocket.on("availability.updated", function (payload) {
      setFeedback("Disponibilidad actualizada: " + (payload.date || ""), "info");
      loadEmployees();
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

  var moderationClients = [];

  function loadModerationTable() {
    callApi("/api/clients/moderation", "GET")
      .then(function (result) {
        moderationClients = result.data || [];
        applyModerationSearch();
        setFeedback("Tabla de moderacion actualizada.", "ok", "adminModerationModal");
      })
      .catch(function (error) {
        setFeedback(error.message, "warn", "adminModerationModal");
      });
  }

  function applyModerationSearch() {
    var searchInput = byId("moderationSearchInput");
    var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    var filtered = moderationClients;

    if (query) {
      filtered = moderationClients.filter(function (client) {
        var name = (client.name || "").toLowerCase();
        var email = (client.email || "").toLowerCase();
        return name.includes(query) || email.includes(query);
      });
    }

    renderModerationTable(filtered);
  }

  function toReadableModerationDate(dateText) {
    if (!dateText) return "-";
    var date = new Date(dateText);
    if (Number.isNaN(date.getTime())) return "-";
    var day = String(date.getDate()).padStart(2, "0");
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var year = String(date.getFullYear());
    var hour = String(date.getHours()).padStart(2, "0");
    var minutes = String(date.getMinutes()).padStart(2, "0");
    return day + "/" + month + "/" + year + " " + hour + ":" + minutes;
  }

  function renderModerationTable(rows) {
    var body = byId("moderationTableBody");
    if (!body) return;

    body.innerHTML = "";

    if (!rows || rows.length === 0) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 8;
      td.textContent = "Sin clientes para moderar.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    rows.forEach(function (row) {
      var tr = document.createElement("tr");

      var nameTd = document.createElement("td");
      nameTd.textContent = row.name || "-";
      tr.appendChild(nameTd);

      var emailTd = document.createElement("td");
      emailTd.textContent = row.email || "-";
      tr.appendChild(emailTd);

      var phoneTd = document.createElement("td");
      phoneTd.textContent = row.phone || "-";
      tr.appendChild(phoneTd);

      var activeTd = document.createElement("td");
      activeTd.textContent = String(row.active_reservations || 0);
      tr.appendChild(activeTd);

      var noShowTd = document.createElement("td");
      noShowTd.textContent = String(row.no_show_reservations || 0);
      tr.appendChild(noShowTd);

      var statusTd = document.createElement("td");
      var statusBadge = document.createElement("span");
      statusBadge.className = row.is_blocked ? "status-badge blocked" : "status-badge active";
      statusBadge.textContent = row.is_blocked ? "Bloqueado" : "Habilitado";
      statusTd.appendChild(statusBadge);

      var lastReservation = document.createElement("div");
      lastReservation.className = "status-subtext";
      lastReservation.textContent = "Ultima: " + toReadableModerationDate(row.last_reservation_at);
      statusTd.appendChild(lastReservation);
      tr.appendChild(statusTd);

      var reasonTd = document.createElement("td");
      var blockedByLabel = row.blocked_by_name ? " por " + String(row.blocked_by_name) : "";
      reasonTd.textContent = row.blocked_reason ? String(row.blocked_reason) + blockedByLabel : "-";
      tr.appendChild(reasonTd);

      var actionTd = document.createElement("td");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "admin-btn ghost action-btn";
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

  function bindModerationEvents() {
    var searchInput = byId("moderationSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        applyModerationSearch();
      });
    }

    var refreshButton = byId("refreshModerationBtn");
    if (refreshButton) {
      refreshButton.addEventListener("click", function () {
        loadModerationTable();
      });
    }

    var tableBody = byId("moderationTableBody");
    if (tableBody) {
      tableBody.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;

        var action = target.dataset.action;
        var clientId = target.dataset.clientId;

        if (!clientId) {
          setFeedback("No se pudo identificar el cliente.", "warn", "adminModerationModal");
          return;
        }

        if (action === "unblock") {
          callApi("/api/clients/" + encodeURIComponent(clientId) + "/unblock", "PUT")
            .then(function () {
              setFeedback("Cliente desbloqueado correctamente.", "ok", "adminModerationModal");
              loadModerationTable();
            })
            .catch(function (error) {
              setFeedback(error.message, "warn", "adminModerationModal");
            });
        } else if (action === "block") {
          var reason = "Spam o mal uso de la aplicacion";
          callApi("/api/clients/" + encodeURIComponent(clientId) + "/block", "PUT", { reason: reason })
            .then(function () {
              setFeedback("Cliente bloqueado correctamente.", "ok", "adminModerationModal");
              loadModerationTable();
            })
            .catch(function (error) {
              setFeedback(error.message, "warn", "adminModerationModal");
            });
        }
      });
    }
  }

  let allLocations = [];

  async function loadLocations() {
    try {
      const payload = await callApi("/api/locations", "GET");
      allLocations = payload.data || [];
      renderLocationsTable();
      populateLocationSelectors();
    } catch (error) {
      setInlineFeedback("adminLocationsFeedback", error.message, "warn");
    }
  }

  function renderLocationsTable() {
    const body = byId("locationsTableBody");
    if (!body) return;
    body.innerHTML = "";

    if (!allLocations || allLocations.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "Sin locales registrados.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    allLocations.forEach(function (loc) {
      const tr = document.createElement("tr");

      const name = document.createElement("td");
      name.textContent = loc.name || "";
      tr.appendChild(name);

      const address = document.createElement("td");
      address.textContent = loc.address || "";
      tr.appendChild(address);

      const region = document.createElement("td");
      region.textContent = loc.region || "";
      tr.appendChild(region);

      const actions = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "admin-btn ghost";
      editBtn.textContent = "Editar";
      editBtn.dataset.locationId = String(loc.id);
      editBtn.addEventListener("click", function () {
        openLocationForm(loc);
      });
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "admin-btn ghost";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.dataset.locationId = String(loc.id);
      deleteBtn.addEventListener("click", async function () {
        try {
          await callApi("/api/locations/" + encodeURIComponent(loc.id), "DELETE");
          setFeedback("Local eliminado correctamente.", "ok");
          await loadLocations();
        } catch (error) {
          setFeedback(error.message, "warn");
        }
      });
      actions.appendChild(deleteBtn);

      tr.appendChild(actions);
      body.appendChild(tr);
    });
  }

  function openLocationForm(loc) {
    console.log("openLocationForm called with:", loc);
    var formId = byId("locationFormId");
    var nameInput = byId("locationName");
    var addressInput = byId("locationAddress");
    var regionInput = byId("locationRegion");
    var title = byId("adminLocationFormTitle");
    var feedback = byId("adminLocationFormFeedback");
    var modal = byId("adminLocationFormModal");

    if (!formId || !nameInput || !addressInput || !regionInput || !title || !feedback || !modal) {
      console.error("Missing element:", { formId: !!formId, nameInput: !!nameInput, addressInput: !!addressInput, regionInput: !!regionInput, title: !!title, feedback: !!feedback, modal: !!modal });
      setFeedback("Error al abrir el formulario de local.", "warn");
      return;
    }

    formId.value = loc ? String(loc.id) : "";
    nameInput.value = loc ? loc.name || "" : "";
    addressInput.value = loc ? loc.address || "" : "";
    regionInput.value = loc ? loc.region || "" : "";
    title.textContent = loc ? "Editar local" : "Nuevo local";
    feedback.textContent = loc ? "Edita los datos del local." : "Completa los datos del local.";
    feedback.className = "feedback info";
    modal.classList.remove("hidden");
  }

  function closeLocationForm() {
    byId("adminLocationFormModal").classList.add("hidden");
    byId("locationForm").reset();
    byId("locationFormId").value = "";
  }

  async function saveLocation(event) {
    event.preventDefault();
    console.log("saveLocation called");
    const id = byId("locationFormId").value;
    const name = byId("locationName").value.trim();
    const address = byId("locationAddress").value.trim();
    const region = byId("locationRegion").value.trim();

    console.log("saveLocation data:", { id, name, address, region });

    if (!name || !address || !region) {
      byId("adminLocationFormFeedback").textContent = "Todos los campos son obligatorios.";
      byId("adminLocationFormFeedback").className = "feedback warn";
      return;
    }

    try {
      if (id) {
        await callApi("/api/locations/" + encodeURIComponent(id), "PUT", { name, address, region });
        setFeedback("Local actualizado correctamente.", "ok");
      } else {
        await callApi("/api/locations", "POST", { name, address, region });
        setFeedback("Local creado correctamente.", "ok");
      }
      closeLocationForm();
      await loadLocations();
    } catch (error) {
      console.error("saveLocation error:", error);
      byId("adminLocationFormFeedback").textContent = error.message;
      byId("adminLocationFormFeedback").className = "feedback warn";
    }
  }

  function populateLocationSelectors() {
    const selectors = ["employeeLocation"];
    selectors.forEach(function (selectorId) {
      const select = byId(selectorId);
      if (!select) return;
      const currentVal = select.value;
      select.innerHTML = '<option value="">Seleccionar local...</option>';
      allLocations.forEach(function (loc) {
        const opt = document.createElement("option");
        opt.value = String(loc.id);
        opt.textContent = loc.name + " (" + loc.region + ")";
        select.appendChild(opt);
      });
      if (currentVal) select.value = currentVal;
    });
  }

  async function loadAssignLocationsTable() {
    if (allLocations.length === 0) {
      try {
        const payload = await callApi("/api/locations", "GET");
        allLocations = payload.data || [];
      } catch (_error) {
        allLocations = [];
      }
    }
    try {
      const payload = await callApi("/api/auth/employees", "GET");
      const employees = (payload.data || []).filter(function (e) { return e.role === "empleado"; });
      renderAssignLocationsTable(employees);
    } catch (error) {
      setInlineFeedback("adminAssignLocationsFeedback", error.message, "warn");
    }
  }

  function renderAssignLocationsTable(employees) {
    const body = byId("assignLocationsTableBody");
    if (!body) return;
    body.innerHTML = "";

    if (!employees || employees.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "Sin empleados para asignar.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    employees.forEach(function (emp) {
      const tr = document.createElement("tr");

      const name = document.createElement("td");
      name.textContent = emp.name || "";
      tr.appendChild(name);

      const lastName = document.createElement("td");
      lastName.textContent = emp.last_name || "";
      tr.appendChild(lastName);

      const email = document.createElement("td");
      email.textContent = emp.email || "";
      tr.appendChild(email);

      const currentLocation = document.createElement("td");
      currentLocation.textContent = emp.location_name || "Sin asignar";
      tr.appendChild(currentLocation);

      const newLocation = document.createElement("td");
      const select = document.createElement("select");
      select.className = "location-select";
      select.dataset.employeeId = String(emp.id);
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "Seleccionar...";
      select.appendChild(defaultOpt);
      allLocations.forEach(function (loc) {
        const opt = document.createElement("option");
        opt.value = String(loc.id);
        opt.textContent = loc.name + " (" + loc.region + ")";
        if (emp.location_id && String(emp.location_id) === String(loc.id)) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
      select.addEventListener("change", async function () {
        const locationId = select.value;
        if (!locationId) {
          return;
        }
        try {
          await callApi("/api/auth/employees/" + encodeURIComponent(emp.id) + "/location", "PUT", { locationId: Number(locationId) });
          setFeedback("Local asignado correctamente.", "ok");
          await loadAssignLocationsTable();
        } catch (error) {
          setFeedback(error.message, "warn");
        }
      });
      newLocation.appendChild(select);
      tr.appendChild(newLocation);

      body.appendChild(tr);
    });
  }

  var addLocationBtn = byId("addLocationBtn");
  if (addLocationBtn) {
    addLocationBtn.addEventListener("click", function () {
      console.log("addLocationBtn clicked");
      openLocationForm(null);
    });
  } else {
    console.error("addLocationBtn not found");
  }

  var cancelLocationFormBtn = byId("cancelLocationFormBtn");
  if (cancelLocationFormBtn) {
    cancelLocationFormBtn.addEventListener("click", closeLocationForm);
  }

  var locationForm = byId("locationForm");
  if (locationForm) {
    locationForm.addEventListener("submit", saveLocation);
  }
})();
