const API = '/api';

function getToken() {
  return localStorage.getItem('sgp_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();

  if (!data.ok) {
    if (res.status === 401) {
      localStorage.removeItem('sgp_token');
      localStorage.removeItem('sgp_usuario');
    }
    const error = new Error(data.error || 'Error del servidor');
    error.status = res.status;
    error.detalles = data.detalles || null;
    throw error;
  }

  return data.data;
}

async function requestForm(path, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: formData });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error del servidor');
  return data.data;
}

const api = {
  auth: {
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    verificar: (body) => request('/auth/verificar', { method: 'POST', body: JSON.stringify(body) }),
    reenviarCodigo: (body) => request('/auth/reenviar-codigo', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request('/auth/me'),
    empleados: {
      list: () => request('/auth/empleados'),
      create: (body) => request('/auth/empleados', { method: 'POST', body: JSON.stringify(body) }),
      update: (id, body) => request(`/auth/empleados/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      delete: (id) => request(`/auth/empleados/${id}`, { method: 'DELETE' }),
    },
  },
  clientes: {
    me: () => request('/clientes/me'),
    updateMe: (body) => request('/clientes/me', { method: 'PUT', body: JSON.stringify(body) }),
    deleteMe: () => request('/clientes/me', { method: 'DELETE' }),
    list: () => request('/clientes'),
    block: (id, motivo) => request(`/clientes/${id}/bloquear`, { method: 'PUT', body: JSON.stringify({ motivo }) }),
    unblock: (id) => request(`/clientes/${id}/desbloquear`, { method: 'PUT' }),
    delete: (id) => request(`/clientes/${id}`, { method: 'DELETE' }),
  },
  ubicaciones: {
    list: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      ).toString();
      return request(`/ubicaciones${query ? `?${query}` : ''}`);
    },
    create: (body) => request('/ubicaciones', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/ubicaciones/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/ubicaciones/${id}`, { method: 'DELETE' }),
  },
  reservas: {
    servicios: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      ).toString();
      return request(`/reservas/servicios${query ? `?${query}` : ''}`);
    },
    createServicio: (body) => request('/reservas/servicios', { method: 'POST', body: JSON.stringify(body) }),
    updateServicio: (id, body) => request(`/reservas/servicios/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteServicio: (id) => request(`/reservas/servicios/${id}`, { method: 'DELETE' }),
    imagenesServicio: (id) => request(`/reservas/servicios/${id}/imagenes`),
    sedesPorServicio: (servicio_id) => request(`/reservas/sedes-por-servicio?servicio_id=${servicio_id}`),
    empleadosPorSede: (ubicacion_id) => request(`/reservas/empleados-por-sede?ubicacion_id=${ubicacion_id}`),
    categorias: () => request('/reservas/categorias'),
    createCategoria: (body) => request('/reservas/categorias', { method: 'POST', body: JSON.stringify(body) }),
    updateCategoria: (id, body) => request(`/reservas/categorias/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteCategoria: (id) => request(`/reservas/categorias/${id}`, { method: 'DELETE' }),
    configuracion: () => request('/reservas/configuracion'),
    updateConfiguracion: (body) => request('/reservas/configuracion', { method: 'PUT', body: JSON.stringify(body) }),
    disponibilidad: (params) => request(`/reservas/disponibilidad?${new URLSearchParams(params)}`),
    disponibilidadCombo: (body) => request('/reservas/disponibilidad-combo', { method: 'POST', body: JSON.stringify(body) }),
    empleadosPorServicio: (params) => request(`/reservas/empleados-por-servicio?${new URLSearchParams(params)}`),
    jornada: {
      get: (ubicacion_id) => request(`/reservas/jornada?ubicacion_id=${ubicacion_id}`),
      update: (body) => request('/reservas/jornada', { method: 'PUT', body: JSON.stringify(body) }),
      getPlantilla: (ubicacion_id = '') => request(`/reservas/jornada/plantilla${ubicacion_id ? `?ubicacion_id=${ubicacion_id}` : ''}`),
      updatePlantilla: (body) => request('/reservas/jornada/plantilla', { method: 'PUT', body: JSON.stringify(body) }),
      abrirFestivo: (body) => request('/reservas/jornada/festivo', { method: 'POST', body: JSON.stringify(body) }),
    },
    festivos: (desde, hasta) => request(`/reservas/festivos?desde=${desde}&hasta=${hasta}`),
    empleadoTiempos: {
      get: (empleado_id) => request(`/reservas/empleado-tiempos-servicio?empleado_id=${empleado_id}`),
      update: (body) => request('/reservas/empleado-tiempos-servicio', { method: 'PUT', body: JSON.stringify(body) }),
    },
    empleadosDisponibles: (params) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      ).toString();
      return request(`/reservas/empleados-disponibles${query ? `?${query}` : ''}`);
    },
    empleadoServiciosUpdate: (items) => request('/reservas/empleado-tiempos-servicio', { method: 'PUT', body: JSON.stringify({ items }) }),
    create: (body) => request('/reservas', { method: 'POST', body: JSON.stringify(body) }),
    misReservas: () => request('/reservas/me'),
    cancelar: (id) => request(`/reservas/me/${id}`, { method: 'DELETE' }),
    empleadoDia: (fecha) => request(`/reservas/empleado/dia?fecha=${fecha}`),
    cancelarDiaEmpleado: (body) => request('/reservas/empleado/cancelar-dia', { method: 'POST', body: JSON.stringify(body) }),
    list: (params) => request(`/reservas?${new URLSearchParams(params)}`),
    agenda: (params) => request(`/reservas/agenda?${new URLSearchParams(params)}`),
  },
  checkin: {
    consultar: (qr_token) => request('/checkin/consultar', { method: 'POST', body: JSON.stringify({ qr_token }) }),
    llegada: (qr_token) => request('/checkin/llegada', { method: 'POST', body: JSON.stringify({ qr_token }) }),
    cobroEfectivo: (reserva_id, monto) => request('/checkin/cobro-efectivo', { method: 'POST', body: JSON.stringify({ reserva_id, monto }) }),
    confirmarPago: (body) => request('/checkin/confirmar-pago', { method: 'POST', body: JSON.stringify(body) }),
    iniciar: (reserva_id) => request('/checkin/iniciar', { method: 'POST', body: JSON.stringify({ reserva_id }) }),
    finalizar: (reserva_id) => request('/checkin/finalizar', { method: 'POST', body: JSON.stringify({ reserva_id }) }),
    validar: (body) => request('/checkin/validar', { method: 'POST', body: JSON.stringify(body) }),
  },
  pagos: {
    intencion: (reserva_id) => request('/pagos/intencion', { method: 'POST', body: JSON.stringify({ reserva_id }) }),
    estado: (id) => request(`/pagos/${id}`),
    verificar: (id, transaction_id) => request(`/pagos/${id}/verificar`, { method: 'POST', body: JSON.stringify({ transaction_id }) }),
  },
  reportes: {
    ventasDiarias: (fecha, params = {}) => {
      const query = new URLSearchParams({ fecha, ...params }).toString();
      return request(`/reportes/ventas-diarias?${query}`);
    },
    ocupacion: (fecha, params = {}) => {
      const query = new URLSearchParams({ fecha, ...params }).toString();
      return request(`/reportes/ocupacion?${query}`);
    },
    clientesRecurrentes: () => request('/reportes/clientes-recurrentes'),
    resumenEmpleado: (params) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      ).toString();
      return request(`/reportes/mi-resumen${query ? `?${query}` : ''}`);
    },
    nomina: (params) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      ).toString();
      return request(`/reportes/nomina${query ? `?${query}` : ''}`);
    },
    nominaPdf: async (params) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      ).toString();
      const token = getToken();
      const res = await fetch(`${API}/reportes/nomina/pdf${query ? `?${query}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('No se pudo generar la nómina en PDF');
      return res.blob();
    },
  },
  disponibilidad: {
    get: () => request('/empleados/disponibilidad'),
    update: (body) => request('/empleados/disponibilidad', { method: 'PUT', body: JSON.stringify(body) }),
    descansos: (body) => request('/empleados/disponibilidad/descansos', { method: 'PUT', body: JSON.stringify(body) }),
    getByAdmin: (empleadoId) => request(`/empleados/${empleadoId}/disponibilidad`),
    updateByAdmin: (empleadoId, body) => request(`/empleados/${empleadoId}/disponibilidad`, { method: 'PUT', body: JSON.stringify(body) }),
    todas: () => request('/empleados/disponibilidad/todas'),
    temporales: (empleadoId = '') => request(`/empleados/disponibilidad/temporales${empleadoId ? `?empleado_id=${empleadoId}` : ''}`),
    crearTemporal: (body) => request('/empleados/disponibilidad/temporales', { method: 'POST', body: JSON.stringify(body) }),
    finalizarTemporal: (id, body = {}) => request(`/empleados/disponibilidad/temporales/${id}/finalizar`, { method: 'PATCH', body: JSON.stringify(body) }),
    festivos: (params) => request(`/empleados/disponibilidad/festivos?${new URLSearchParams(params)}`),
    festivosAdmin: (fecha) => request(`/empleados/disponibilidad/festivos/admin?fecha=${fecha}`),
    bloqueos: (params) => request(`/empleados/disponibilidad/bloqueos?${new URLSearchParams(params)}`),
    crearFestivo: (body) => request('/empleados/disponibilidad/festivos', { method: 'POST', body: JSON.stringify(body) }),
    eliminarFestivo: (fecha) => request(`/empleados/disponibilidad/festivos/${fecha}`, { method: 'DELETE' }),
  },
  logs: {
    actividad: (params) => request(`/logs/actividad?${new URLSearchParams(params)}`),
    errores: (params) => request(`/logs/errores?${new URLSearchParams(params)}`),
    exportarTexto: async (params) => {
      const token = getToken();
      const res = await fetch(`${API}/logs/exportar?${new URLSearchParams(params)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('No se pudo exportar el archivo de logs');
      return res.text();
    },
  },
  presentacion: {
    publica: () => request('/presentacion'),
    admin: () => request('/presentacion/admin'),
    actualizarConfig: (body) => request('/presentacion/config', { method: 'PUT', body: JSON.stringify(body) }),
    crearMedia: (formData) => requestForm('/presentacion/media', formData),
    agregarFuentes: (id, formData) => requestForm(`/presentacion/media/${id}/fuentes`, formData),
    actualizarMedia: (id, body) => request(`/presentacion/media/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    reordenar: (items) => request('/presentacion/media/orden', { method: 'PUT', body: JSON.stringify({ items }) }),
    eliminarMedia: (id) => request(`/presentacion/media/${id}`, { method: 'DELETE' }),
    eliminarFuente: (id, fuenteId) => request(`/presentacion/media/${id}/fuentes/${fuenteId}`, { method: 'DELETE' }),
  },
  preferencias: {
    get: () => request('/preferencias'),
    update: (body) => request('/preferencias', { method: 'PUT', body: JSON.stringify(body) }),
  },
};

export default api;
