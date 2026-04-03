(function () {
  const TOKEN_KEY = "employee_token";

  const state = {
    stream: null,
    scanIntervalId: null,
    scanLocked: false
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function setOutput(payload) {
    byId("apiOutput").textContent = JSON.stringify(payload, null, 2);
  }

  function setFeedback(message, tone) {
    const element = byId("qrFeedback");
    element.textContent = message;
    element.className = "feedback " + tone;
  }

  function setScanButtons(scanning) {
    byId("startScanBtn").disabled = scanning;
    byId("stopScanBtn").disabled = !scanning;
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
    if (!profile.data || profile.data.role !== "employee") {
      throw new Error("Acceso restringido a empleados");
    }
    byId("logoutBtn").classList.remove("hidden");
  }

  async function validateToken(qrToken) {
    if (!qrToken) {
      setFeedback("Debes ingresar o escanear un token QR.", "warn");
      return;
    }

    try {
      const payload = await callApi("/api/checkin/validate", "POST", { qrToken: qrToken.trim() });
      setLastValidation(payload);
      setFeedback("Ingreso validado correctamente.", "ok");
    } catch (error) {
      setFeedback(error.message, "warn");
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

    setScanButtons(false);
  }

  async function scanFrame(detector) {
    if (state.scanLocked) {
      return;
    }

    const video = byId("cameraPreview");
    if (!video.videoWidth || !video.videoHeight) {
      return;
    }

    try {
      const barcodes = await detector.detect(video);
      if (!barcodes || barcodes.length === 0) {
        return;
      }

      const rawValue = barcodes[0] && barcodes[0].rawValue;
      if (!rawValue) {
        return;
      }

      state.scanLocked = true;
      byId("qrTokenInput").value = rawValue;
      await validateToken(rawValue);
      state.scanLocked = false;
    } catch (_error) {
      state.scanLocked = false;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setFeedback("El navegador no soporta acceso a camara.", "warn");
      return;
    }

    if (typeof window.BarcodeDetector !== "function") {
      setFeedback("BarcodeDetector no esta disponible. Usa validacion manual.", "warn");
      return;
    }

    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });

      state.stream = stream;
      byId("cameraPreview").srcObject = stream;
      setScanButtons(true);
      setFeedback("Camara activa. Escanea un QR.", "info");

      state.scanIntervalId = window.setInterval(function () {
        scanFrame(detector);
      }, 600);
    } catch (error) {
      setFeedback(error.message || "No fue posible iniciar la camara.", "warn");
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
    window.location.href = "/ui/employee";
  });

  window.addEventListener("beforeunload", stopCamera);

  if (!getToken()) {
    window.location.href = "/ui/employee";
  } else {
    ensureEmployeeSession().catch(function (error) {
      setFeedback(error.message, "warn");
      window.location.href = "/ui/employee";
    });
  }
})();
