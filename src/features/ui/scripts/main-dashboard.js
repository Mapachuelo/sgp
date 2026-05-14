(function () {
	const TOKEN_KEY = "sgp_token";
	const path = window.location.pathname;
	const isLoginPage = path === "/ui/login";

	function byId(id) {
		return document.getElementById(id);
	}

	function setFeedback(message, tone) {
		const feedback = byId("loginFeedback");
		if (!feedback) {
			return;
		}

		feedback.textContent = message;
		feedback.className = "feedback " + tone;
		feedback.classList.remove("hidden");
	}

	function setRegisterFeedback(message, tone) {
		const feedback = byId("registerFeedback");
		if (!feedback) {
			return;
		}

		feedback.textContent = message;
		feedback.className = "feedback " + tone;
	}

	function resetRegisterFeedback() {
		setRegisterFeedback("Completa los datos y revisa el mensaje si alguna casilla falla.", "info");
	}

	function normalizeRole(role) {
		return String(role || "").trim().toLowerCase();
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

		if (!response.ok || !payload.ok) {
			console.error("API Error:", { path, method, status: response.status, payload });
			const error = new Error(payload.message || "Error en la solicitud");
			error.status = response.status;
			throw error;
		}

		return payload;
	}

	function getHomeByRole(role) {
		if (role === "admin") {
			return "/ui/admin";
		}

		if (role === "empleado" || role === "employee") {
			return "/ui/empleado";
		}

		return "/ui/client";
	}

	async function login() {
		const email = (byId("loginEmail").value || "").trim();
		const password = byId("loginPassword").value || "";

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
			if (!user || !user.role) {
				setFeedback("No se pudo identificar el rol de la cuenta.", "warn");
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

	async function registerClient() {
		const firstName = (byId("registerFirstName").value || "").trim();
		const lastName = (byId("registerLastName").value || "").trim();
		const rawPhone = (byId("registerPhone").value || "").trim();
		const phone = normalizePhoneInput(rawPhone);
		const email = (byId("registerEmail").value || "").trim();
		const password = byId("registerPassword").value || "";

		if (!firstName) {
			setRegisterFeedback("La casilla nombre es obligatoria.", "warn");
			return;
		}

		if (!lastName) {
			setRegisterFeedback("La casilla apellido es obligatoria.", "warn");
			return;
		}

		if (!rawPhone) {
			setRegisterFeedback("La casilla numero es obligatoria.", "warn");
			return;
		}

		if (!email) {
			setRegisterFeedback("La casilla correo es obligatoria.", "warn");
			return;
		}

		if (!password) {
			setRegisterFeedback("La casilla password es obligatoria.", "warn");
			return;
		}

		if (!isValidEmail(email)) {
			setRegisterFeedback("La casilla correo no tiene un formato valido.", "warn");
			return;
		}

		if (!isValidCoPhone(phone)) {
			setRegisterFeedback("La casilla numero debe tener formato +57XXXXXXXXXX.", "warn");
			return;
		}

		if (password.length < 6) {
			setRegisterFeedback("La casilla password debe tener al menos 6 caracteres.", "warn");
			return;
		}

		try {
			byId("registerPhone").value = phone;
			const payload = await callApi(
				"/api/auth/register",
				"POST",
				{
					firstName: firstName,
					lastName: lastName,
					name: firstName + " " + lastName,
					phone: phone,
					email: email,
					password: password
				},
				false
			);

			closeRegisterModal();
			clearLegacyTokens();
			setToken(payload.data.token);
			window.location.href = "/ui/client";
		} catch (error) {
			setRegisterFeedback(error.message, "warn");
		}
	}

	function clearRegisterForm() {
		const registerIds = [
			"registerFirstName",
			"registerLastName",
			"registerPhone",
			"registerEmail",
			"registerPassword"
		];

		registerIds.forEach(function (id) {
			const input = byId(id);
			if (input) {
				input.value = "";
			}
		});
	}

	function closeRegisterModal() {
		const modal = byId("registerModal");
		if (!modal) {
			return;
		}

		modal.classList.add("hidden");
		clearRegisterForm();
		resetRegisterFeedback();
	}

	function openRegisterModal() {
		const modal = byId("registerModal");
		if (!modal) {
			return;
		}

		modal.classList.remove("hidden");
		resetRegisterFeedback();
	}

	async function redirectIfActiveSession() {
		if (!isLoginPage) {
			return;
		}

		const token = getToken();
		if (!token) {
			return;
		}

		try {
			const payload = await callApi("/api/auth/me", "GET", null, true);
			if (payload.data && payload.data.role) {
				window.location.href = getHomeByRole(payload.data.role);
			}
		} catch (error) {
			if (error && (error.status === 401 || error.status === 403)) {
				localStorage.removeItem(TOKEN_KEY);
			}
		}
	}

	if (!isLoginPage) {
		return;
	}

	const loginBtn = byId("loginBtn");
	const openRegisterBtn = byId("openRegisterBtn");
	const registerBtn = byId("registerBtn");
	const closeRegisterBtn = byId("closeRegisterBtn");
	const cancelRegisterBtn = byId("cancelRegisterBtn");
	const registerModal = byId("registerModal");

	if (loginBtn) {
		loginBtn.addEventListener("click", login);
	}

	if (openRegisterBtn) {
		openRegisterBtn.addEventListener("click", openRegisterModal);
	}

	if (registerBtn) {
		registerBtn.addEventListener("click", registerClient);
	}

	if (closeRegisterBtn) {
		closeRegisterBtn.addEventListener("click", closeRegisterModal);
	}

	if (cancelRegisterBtn) {
		cancelRegisterBtn.addEventListener("click", closeRegisterModal);
	}

	if (registerModal) {
		registerModal.addEventListener("click", function (event) {
			if (event.target === registerModal) {
				closeRegisterModal();
			}
		});
	}

	redirectIfActiveSession();
})();
