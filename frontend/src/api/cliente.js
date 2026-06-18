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
    throw new Error(data.error || 'Error del servidor');
  }

  return data.data;
}

const api = {
  auth: {
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
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
    list: () => request('/ubicaciones'),
    create: (body) => request('/ubicaciones', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/ubicaciones/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/ubicaciones/${id}`, { method: 'DELETE' }),
  },
  reservas: {
    servicios: () => request('/reservas/servicios'),
    createServicio: (body) => request('/reservas/servicios', { method: 'POST', body: JSON.stringify(body) }),
    updateServicio: (id, body) => request(`/reservas/servicios/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteServicio: (id) => request(`/reservas/servicios/${id}`, { method: 'DELETE' }),
    disponibilidad: (params) => request(`/reservas/disponibilidad?${new URLSearchParams(params)}`),
    jornada: {
      get: (ubicacion_id) => request(`/reservas/jornada?ubicacion_id=${ubicacion_id}`),
      update: (body) => request('/reservas/jornada', { method: 'PUT', body: JSON.stringify(body) }),
    },
    empleadoTiempos: {
      get: (empleado_id) => request(`/reservas/empleado-tiempos-servicio?empleado_id=${empleado_id}`),
      update: (body) => request('/reservas/empleado-tiempos-servicio', { method: 'PUT', body: JSON.stringify(body) }),
    },
    empleadosDisponibles: (params) => request(`/reservas/empleados-disponibles?${new URLSearchParams(params)}`),
    empleadoServiciosUpdate: (items) => request('/reservas/empleado-tiempos-servicio', { method: 'PUT', body: JSON.stringify({ items }) }),
    create: (body) => request('/reservas', { method: 'POST', body: JSON.stringify(body) }),
    misReservas: () => request('/reservas/me'),
    cancelar: (id) => request(`/reservas/me/${id}`, { method: 'DELETE' }),
    list: (params) => request(`/reservas?${new URLSearchParams(params)}`),
  },
  checkin: {
    validar: (body) => request('/checkin/validar', { method: 'POST', body: JSON.stringify(body) }),
  },
  reportes: {
    ventasDiarias: (fecha) => request(`/reportes/ventas-diarias?fecha=${fecha}`),
    ocupacion: (fecha) => request(`/reportes/ocupacion?fecha=${fecha}`),
    clientesRecurrentes: () => request('/reportes/clientes-recurrentes'),
  },
  disponibilidad: {
    get: () => request('/empleados/disponibilidad'),
    update: (body) => request('/empleados/disponibilidad', { method: 'PUT', body: JSON.stringify(body) }),
    getByAdmin: (empleadoId) => request(`/empleados/${empleadoId}/disponibilidad`),
    updateByAdmin: (empleadoId, body) => request(`/empleados/${empleadoId}/disponibilidad`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  logs: {
    actividad: (params) => request(`/logs/actividad?${new URLSearchParams(params)}`),
    errores: (params) => request(`/logs/errores?${new URLSearchParams(params)}`),
    exportar: (params) => request(`/logs/exportar?${new URLSearchParams(params)}`),
  },
  preferencias: {
    get: () => request('/preferencias'),
    update: (body) => request('/preferencias', { method: 'PUT', body: JSON.stringify(body) }),
  },
};

export default api;
