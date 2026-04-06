(function () {
	const TOKEN_KEY = "sgp_token";
	const path = window.location.pathname;
	const isLoginPage = path === "/ui/login";

	function byId(id) {
		return document.getElementById(id);
	}

	function setOutput(payload) {
		const output = byId("apiOutput");
		if (!output) {
			return;
		}

		output.textContent = JSON.stringify(payload, null, 2);
	}

	function setFeedback(message, tone) {
		const feedback = byId("loginFeedback");
		if (!feedback) {
			return;
		}

		feedback.textContent = message;
		feedback.className = "feedback " + tone;
	}

	function getToken() {
		return localStorage.getItem(TOKEN_KEY) || "";
	}

	function setToken(token) {
		localStorage.setItem(TOKEN_KEY, token);
	}

	function clearLegacyTokens() {
		localStorage.removeItem("client_token");
		localStorage.removeItem("employee_token");
		localStorage.removeItem("admin_token");
	}

	async function callApi(pathname, method, body, withAuth) {
		const headers = {
			"Content-Type": "application/json"
		};

		if (withAuth && getToken()) {
			headers.Authorization = "Bearer " + getToken();
		}

		const response = await fetch(pathname, {
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

	function getHomeByRole(role) {
		if (role === "admin") {
			return "/ui/admin";
		}

		if (role === "employee") {
			return "/ui/employee";
		}

		return "/ui/client";
	}

	function selectedRole() {
		const role = byId("roleSelect");
		return role ? role.value : "client";
	}

	function syncRoleUi() {
		const role = selectedRole();
		const registerSection = byId("registerSection");

		if (!registerSection) {
			return;
		}

		registerSection.classList.toggle("hidden", role !== "client");
	}

	async function loginWithRole() {
		const email = (byId("loginEmail").value || "").trim();
		const password = byId("loginPassword").value || "";
		const expectedRole = selectedRole();

		if (!email || !password) {
			setFeedback("Correo y password son obligatorios.", "warn");
			return;
		}

		try {
			const payload = await callApi(
				"/api/auth/login",
				"POST",
				{
					email: email,
					password: password
				},
				false
			);

			const user = payload.data && payload.data.user;
			if (!user || user.role !== expectedRole) {
				setFeedback("La cuenta no coincide con el rol seleccionado.", "warn");
				return;
			}

			clearLegacyTokens();
			setToken(payload.data.token);
			window.location.href = getHomeByRole(user.role);
		} catch (error) {
			setFeedback(error.message, "warn");
		}
	}

	function isValidEmail(email) {
		return /^\S+@\S+\.\S+$/.test(email);
	}

	async function registerClient() {
		const firstName = (byId("registerFirstName").value || "").trim();
		const lastName = (byId("registerLastName").value || "").trim();
		const phone = (byId("registerPhone").value || "").trim();
		const email = (byId("registerEmail").value || "").trim();
		const password = byId("registerPassword").value || "";

		if (!firstName || !lastName || !phone || !email || !password) {
			setFeedback("Completa nombre, apellido, numero, correo y password.", "warn");
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
			const payload = await callApi(
				"/api/auth/register",
				"POST",
				{
					name: firstName + " " + lastName,
					phone: phone,
					email: email,
					password: password
				},
				false
			);

			clearLegacyTokens();
			setToken(payload.data.token);
			window.location.href = "/ui/client";
		} catch (error) {
			setFeedback(error.message, "warn");
		}
	}

	function preselectRoleFromQuery() {
		const params = new URLSearchParams(window.location.search);
		const role = params.get("role");
		if (role !== "client" && role !== "employee" && role !== "admin") {
			return;
		}

		const roleSelect = byId("roleSelect");
		if (roleSelect) {
			roleSelect.value = role;
		}
	}

	async function redirectIfActiveSession() {
		const token = getToken();
		if (!token) {
			return;
		}

		try {
			const payload = await callApi("/api/auth/me", "GET", null, true);
			if (payload.data && payload.data.role) {
				window.location.href = getHomeByRole(payload.data.role);
			}
		} catch (_error) {
			localStorage.removeItem(TOKEN_KEY);
		}
	}

	if (!isLoginPage) {
		return;
	}

	preselectRoleFromQuery();
	syncRoleUi();

	byId("roleSelect").addEventListener("change", syncRoleUi);
	byId("loginBtn").addEventListener("click", loginWithRole);
	byId("registerBtn").addEventListener("click", registerClient);

	redirectIfActiveSession();
})();
