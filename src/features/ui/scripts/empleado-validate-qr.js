(function () {
  const isAdminContext = window.location.pathname.startsWith("/ui/admin");
  const TOKEN_KEY = "sgp_token";
  const HOME_PATH = isAdminContext ? "/ui/admin" : "/ui/empleado";
  const LOGIN_PATH = "/ui/login";

  const state = {
    stream: null,
    scanIntervalId: null,
    scanLocked: false,
    scanCanvas: null,
    scanContext: null,
    lastScanToken: "",
    lastScanAt: 0
  };

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
    const element = byId("qrFeedback");
    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setRoleUi(user) {
    const adminLink = byId("adminAccessLink");
    if (!adminLink) {
      return;
    }

    const isAdmin = Boolean(user && user.role === "admin");
    adminLink.classList.toggle("hidden", !isAdmin);
  }

  function setScanButtons(scanning) {
    const startBtn = byId("startScanBtn");
    const stopBtn = byId("stopScanBtn");
    if (startBtn) {
      startBtn.disabled = scanning;
    }
    if (stopBtn) {
      stopBtn.disabled = !scanning;
    }
  }

  function getQrTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("qrToken") || "").trim();
  }

  function setLastValidation(payload) {
    const card = byId("lastValidationCard");
    const data = payload && payload.data;
    if (!data) {
      card.textContent = "Sin validaciones recientes.";
      return;
    }

    card.innerHTML =
      "Reserva #" +
      data.id +
      "<br/>Cliente #" +
      data.client_id +
      "<br/>Servicio: " +
      data.service_name +
      "<br/>Estado: " +
      data.status;
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

  async function ensureEmployeeSession() {
    const profile = await callApi("/api/auth/me", "GET");
    const user = profile.data;
    const allowed = isAdminContext
      ? Boolean(user && user.role === "admin")
      : Boolean(user && (user.role === "employee" || user.role === "admin"));

    if (!allowed) {
      throw new Error("Acceso restringido a empleados y administradores");
    }

    setRoleUi(user);
    byId("logoutBtn").classList.remove("hidden");
    return user;
  }

  async function validateToken(qrToken) {
    const normalized = String(qrToken || "").trim();
    if (!normalized) {
      setFeedback("Debes ingresar o escanear un token QR.", "warn");
      return false;
    }

    try {
      const payload = await callApi("/api/checkin/validate", "POST", { qrToken: normalized });
      setLastValidation(payload);
      setFeedback("Ingreso validado correctamente.", "ok");
      return true;
    } catch (error) {
      setFeedback((error.message || "No fue posible validar el QR") + ". Reintenta.", "warn");
      return false;
    }
  }

  function stopCamera() {
    if (state.scanIntervalId) {
      clearInterval(state.scanIntervalId);
      state.scanIntervalId = null;
    }

    if (state.stream) {
      state.stream.getTracks().forEach(function (track) {
        track.stop();
      });
      state.stream = null;
    }

    state.scanLocked = false;
    setScanButtons(false);
  }

  function describeCameraError(error) {
    if (!error || !error.name) {
      return "No fue posible iniciar la camara.";
    }

    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Permiso de camara denegado. Acepta el permiso en el navegador para continuar.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No se encontro una camara disponible en este dispositivo.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "La camara esta siendo usada por otra aplicacion.";
    }

    return error.message || "No fue posible iniciar la camara.";
  }

  function decodeWithJsQr(video) {
    if (typeof window.jsQR !== "function") {
      return "";
    }

    if (!state.scanCanvas) {
      state.scanCanvas = document.createElement("canvas");
      state.scanContext = state.scanCanvas.getContext("2d", { willReadFrequently: true });
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height || !state.scanContext) {
      return "";
    }

    state.scanCanvas.width = width;
    state.scanCanvas.height = height;
    state.scanContext.drawImage(video, 0, 0, width, height);

    const imageData = state.scanContext.getImageData(0, 0, width, height);
    const result = window.jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
    return result && result.data ? String(result.data).trim() : "";
  }

  async function scanFrame(detector) {
    if (state.scanLocked) {
      return;
    }

    const video = byId("cameraPreview");
    if (!video || !video.videoWidth || !video.videoHeight) {
      return;
    }

    let rawValue = "";

    try {
      if (detector) {
        const barcodes = await detector.detect(video);
        rawValue = String((barcodes[0] && barcodes[0].rawValue) || "").trim();
      } else {
        rawValue = decodeWithJsQr(video);
      }
    } catch (_error) {
      return;
    }

    if (!rawValue) {
      return;
    }

    const now = Date.now();
    if (rawValue === state.lastScanToken && now - state.lastScanAt < 2500) {
      return;
    }
    state.lastScanToken = rawValue;
    state.lastScanAt = now;

    state.scanLocked = true;
    byId("qrTokenInput").value = rawValue;
    const validated = await validateToken(rawValue);
    state.scanLocked = false;

    if (validated) {
      stopCamera();
      setFeedback("Ingreso validado correctamente. Camara detenida.", "ok");
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setFeedback("El navegador no soporta acceso a camara.", "warn");
      return;
    }

    stopCamera();
    setFeedback("Solicitando permiso para usar la camara...", "info");

    let detector = null;
    if (typeof window.BarcodeDetector === "function") {
      try {
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch (_error) {
        detector = null;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });

      state.stream = stream;
      byId("cameraPreview").srcObject = stream;
      setScanButtons(true);

      if (!detector && typeof window.jsQR !== "function") {
        setFeedback("Camara activa sin lector QR automatico. Usa validacion manual.", "warn");
        return;
      }

      setFeedback("Camara activa. Escanea un QR.", "info");

      state.scanIntervalId = window.setInterval(function () {
        scanFrame(detector);
      }, 500);
    } catch (error) {
      setFeedback(describeCameraError(error), "warn");
      stopCamera();
    }
  }

  byId("validateBtn").addEventListener("click", function () {
    validateToken(byId("qrTokenInput").value);
  });
  byId("startScanBtn").addEventListener("click", startCamera);
  byId("stopScanBtn").addEventListener("click", function () {
    stopCamera();
    setFeedback("Camara detenida.", "info");
  });
  byId("logoutBtn").addEventListener("click", function () {
    clearToken();
    stopCamera();
    window.location.href = LOGIN_PATH;
  });

  window.addEventListener("beforeunload", stopCamera);

  const prefilledToken = getQrTokenFromUrl();
  if (prefilledToken) {
    byId("qrTokenInput").value = prefilledToken;
    setFeedback("Token recibido desde verificar clientes. Puedes validar manual o escanear.", "info");
  }

  if (!getToken()) {
    window.location.href = LOGIN_PATH;
  } else {
    ensureEmployeeSession().catch(function (error) {
      setRoleUi(null);
      setFeedback(error.message, "warn");
      window.location.href = LOGIN_PATH;
    });
  }
})();
