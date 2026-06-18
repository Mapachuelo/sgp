import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Card, Badge, Sheet, Modal, Toast, Select, Spinner } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';

const hoy = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatearFechaLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function mostrarToast(setToast, message, type = 'success') {
  setToast({ open: true, message, type });
}

export default function AdminDashboard() {
  const { usuario } = useAuth();

  // ==================== ALL STATE ====================

  const [activeSheet, setActiveSheet] = useState(null);

  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  // KPI
  const [kpi, setKpi] = useState({ ventas: null, citas: 0, ocupacion: null, recurrentes: 0, loading: true });

  // Ubicaciones
  const [ubicaciones, setUbicaciones] = useState([]);

  // Timeline reservas
  const [reservas, setReservas] = useState([]);
  const [reservasLoading, setReservasLoading] = useState(true);
  const [sedeFilter, setSedeFilter] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(hoy());

  // Validar QR
  const [qrToken, setQrToken] = useState('');
  const [qrResult, setQrResult] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Empleados
  const [empleados, setEmpleados] = useState([]);
  const [empleadosLoading, setEmpleadosLoading] = useState(false);
  const [empForm, setEmpForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    telefono: '',
    identificacion: '',
    sedes_asignadas: [],
    horarios: {},
  });
  const [empEditId, setEmpEditId] = useState(null);
  const [empShowAdd, setEmpShowAdd] = useState(false);
  const [selectedSedeScheduleId, setSelectedSedeScheduleId] = useState(null);

  function crearHorarioDefault() {
    const h = {};
    for (let d = 1; d <= 7; d++) {
      h[d] = {
        disponible: d <= 5, // Lunes a Viernes
        hora_inicio: '08:00',
        hora_fin: '17:00',
      };
    }
    return h;
  }

  function crearHorarioVacio() {
    const h = {};
    for (let d = 1; d <= 7; d++) {
      h[d] = {
        disponible: false,
        hora_inicio: '08:00',
        hora_fin: '17:00',
      };
    }
    return h;
  }

  function toggleSedeAsignada(sedeId, checked) {
    setEmpForm((prev) => {
      let nuevasSedes = [...(prev.sedes_asignadas || [])];
      let nuevosHorarios = { ...(prev.horarios || {}) };

      if (checked) {
        if (!nuevasSedes.includes(sedeId)) {
          nuevasSedes.push(sedeId);
        }
        if (!nuevosHorarios[sedeId]) {
          nuevosHorarios[sedeId] = nuevasSedes.length === 1 ? crearHorarioDefault() : crearHorarioVacio();
        }
      } else {
        nuevasSedes = nuevasSedes.filter((id) => id !== sedeId);
        delete nuevosHorarios[sedeId];
      }

      // Automatically select the active schedule view
      if (nuevasSedes.length > 0) {
        if (!selectedSedeScheduleId || !nuevasSedes.includes(selectedSedeScheduleId)) {
          setSelectedSedeScheduleId(nuevasSedes[0]);
        }
      } else {
        setSelectedSedeScheduleId(null);
      }

      return {
        ...prev,
        sedes_asignadas: nuevasSedes,
        horarios: nuevosHorarios,
      };
    });
  }

  function updateDiaConfig(sedeId, dia, campo, valor) {
    if (campo === 'disponible' && valor === true) {
      let sedeDuplicadaId = null;
      Object.entries(empForm.horarios || {}).forEach(([sid, dias]) => {
        if (Number(sid) !== Number(sedeId) && empForm.sedes_asignadas?.includes(Number(sid))) {
          if (dias[dia]?.disponible) {
            sedeDuplicadaId = Number(sid);
          }
        }
      });

      if (sedeDuplicadaId) {
        const sedeName = ubicaciones.find((u) => u.id === sedeDuplicadaId)?.nombre || `Sede #${sedeDuplicadaId}`;
        const diasNombres = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };
        mostrarToast(setToast, `El empleado ya tiene asignado un horario en ${sedeName} el día ${diasNombres[dia]}`, 'error');
        return;
      }
    }

    setEmpForm((prev) => {
      const nuevosHorarios = { ...(prev.horarios || {}) };
      if (!nuevosHorarios[sedeId]) {
        nuevosHorarios[sedeId] = crearHorarioVacio();
      }
      nuevosHorarios[sedeId] = {
        ...nuevosHorarios[sedeId],
        [dia]: {
          ...(nuevosHorarios[sedeId][dia] || { disponible: false, hora_inicio: '08:00', hora_fin: '17:00' }),
          [campo]: valor,
        },
      };
      return {
        ...prev,
        horarios: nuevosHorarios,
      };
    });
  }

  // Servicios
  const [servicios, setServicios] = useState([]);
  const [serviciosLoading, setServiciosLoading] = useState(false);
  const [srvForm, setSrvForm] = useState({ nombre: '', descripcion: '', precio: '', duracion: '' });
  const [srvEditId, setSrvEditId] = useState(null);
  const [srvShowAdd, setSrvShowAdd] = useState(false);

  // Empleado tiempos (dentro de servicios)
  const [etEmpleadoId, setEtEmpleadoId] = useState('');
  const [etTiempos, setEtTiempos] = useState([]);
  const [etLoading, setEtLoading] = useState(false);
  const [etForm, setEtForm] = useState({});
  const [srvToAddId, setSrvToAddId] = useState('');

  // Sedes
  const [sedes, setSedes] = useState([]);
  const [sedesLoading, setSedesLoading] = useState(false);
  const [sedForm, setSedForm] = useState({ nombre: '', direccion: '', latitud: '', longitud: '' });
  const [sedEditId, setSedEditId] = useState(null);
  const [sedShowAdd, setSedShowAdd] = useState(false);

  // Horarios
  const [horarios, setHorarios] = useState([]);
  const [horariosLoading, setHorariosLoading] = useState(false);
  const [horSedeId, setHorSedeId] = useState('');

  // Reportes
  const [repLoading, setRepLoading] = useState(false);
  const [repData, setRepData] = useState(null);
  const [repTab, setRepTab] = useState('ventas');
  const [repFecha, setRepFecha] = useState(hoy());

  // Moderar clientes
  const [clientesMod, setClientesMod] = useState([]);
  const [clientesModLoading, setClientesModLoading] = useState(false);
  const [bloqueoId, setBloqueoId] = useState(null);
  const [bloqueoMotivo, setBloqueoMotivo] = useState('');

  // Logs
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsData, setLogsData] = useState([]);
  const [logsTab, setLogsTab] = useState('actividad');
  const [logsFiltro, setLogsFiltro] = useState('');
  const [logsFecha, setLogsFecha] = useState('');
  const [logsSeveridad, setLogsSeveridad] = useState('');
  const [logsExpDesde, setLogsExpDesde] = useState('');
  const [logsExpHasta, setLogsExpHasta] = useState('');

  // ==================== TOAST AUTO-CLOSE ====================

  useEffect(() => {
    if (!toast.open) return;
    const t = setTimeout(() => setToast((p) => ({ ...p, open: false })), 3500);
    return () => clearTimeout(t);
  }, [toast.open]);

  // ==================== DATA LOADING EFFECTS ====================

  useEffect(() => {
    const cargarKpi = async () => {
      try {
        const [ventas, ocupacion, recurrentes] = await Promise.all([
          api.reportes.ventasDiarias(hoy()).catch(() => null),
          api.reportes.ocupacion(hoy()).catch(() => null),
          api.reportes.clientesRecurrentes().catch(() => null),
        ]);
        setKpi({
          ventas: ventas?.total ?? null,
          citas: Array.isArray(ocupacion) ? ocupacion.reduce((sum, d) => sum + (d.total || 0), 0) : 0,
          ocupacion: Array.isArray(ocupacion) && ocupacion.length > 0
            ? { porcentaje: ocupacion[0].porcentaje || 0 }
            : null,
          recurrentes: Array.isArray(recurrentes) ? recurrentes.length : 0,
          loading: false,
        });
      } catch {
        setKpi((p) => ({ ...p, loading: false }));
      }
    };
    cargarKpi();
  }, []);

  useEffect(() => {
    api.ubicaciones.list().then(setUbicaciones).catch(() => {});
  }, []);

  useEffect(() => {
    const cargarReservas = async () => {
      setReservasLoading(true);
      try {
        const params = { fecha: fechaFiltro };
        if (sedeFilter) params.ubicacion_id = sedeFilter;
        const data = await api.reservas.list(params);
        setReservas(data || []);
      } catch (e) {
        mostrarToast(setToast, e.message, 'error');
      } finally {
        setReservasLoading(false);
      }
    };
    cargarReservas();
  }, [sedeFilter, fechaFiltro]);

  // ==================== VALIDAR QR ====================

  const handleValidarQR = async () => {
    if (!qrToken) return mostrarToast(setToast, 'Ingresa el token QR', 'warning');
    setQrLoading(true);
    setQrResult(null);
    try {
      const data = await api.checkin.validar({ qr_token: qrToken, monto: 0 });
      setQrResult(data);
      mostrarToast(setToast, 'Entrada validada correctamente');
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setQrLoading(false);
    }
  };

  const cerrarQR = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActiveSheet(null);
    setQrToken('');
    setQrResult(null);
    setCamaraActiva(false);
    setErrorCamara('');
  };

  const activarCamara = async () => {
    setErrorCamara('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCamaraActiva(true);
    } catch {
      setErrorCamara('No se pudo acceder a la camara. Verifica los permisos.');
    }
  };

  const apagarCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  };

  // ==================== EMPLEADOS ====================

  const cargarEmpleados = useCallback(async () => {
    setEmpleadosLoading(true);
    try {
      const data = await api.auth.empleados.list();
      setEmpleados(data || []);
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setEmpleadosLoading(false);
    }
  }, []);

  const resetEmpForm = () => {
    setEmpForm({
      nombre: '',
      apellido: '',
      email: '',
      password: '',
      telefono: '',
      identificacion: '',
      sedes_asignadas: [],
      horarios: {},
      servicios_asignados: {},
    });
    setSelectedSedeScheduleId(null);
    setEmpShowAdd(false);
    setEmpEditId(null);
  };

  const handleEmpSave = async () => {
    try {
      const disponibilidadItems = [];
      Object.entries(empForm.horarios || {}).forEach(([ubicacionId, dias]) => {
        if (empForm.sedes_asignadas?.includes(Number(ubicacionId))) {
          Object.entries(dias).forEach(([diaSemana, config]) => {
            if (config.disponible) {
              disponibilidadItems.push({
                ubicacion_id: Number(ubicacionId),
                dia_semana: Number(diaSemana),
                hora_inicio: config.hora_inicio || '08:00',
                hora_fin: config.hora_fin || '17:00',
              });
            }
          });
        }
      });

      const serviciosItems = [];
      Object.entries(empForm.servicios_asignados || {}).forEach(([srvId, config]) => {
        if (config.checked) {
          serviciosItems.push({
            servicio_id: Number(srvId),
            duracion_minutos: Number(config.duracion) || 30
          });
        }
      });

      let empId = empEditId;
      if (empId) {
        const { password, sedes_asignadas, horarios, servicios_asignados, ubicacion_base_id, ...rest } = empForm;
        await api.auth.empleados.update(empId, password ? { ...rest, password } : rest);
        await api.disponibilidad.updateByAdmin(empId, disponibilidadItems);
        await api.reservas.empleadoTiempos.update({ empleado_id: empId, items: serviciosItems });
        mostrarToast(setToast, 'Empleado actualizado');
      } else {
        const { sedes_asignadas, horarios, servicios_asignados, ubicacion_base_id, ...rest } = empForm;
        const createdEmp = await api.auth.empleados.create(rest);
        if (createdEmp?.id) {
          await api.disponibilidad.updateByAdmin(createdEmp.id, disponibilidadItems);
          await api.reservas.empleadoTiempos.update({ empleado_id: createdEmp.id, items: serviciosItems });
        }
        mostrarToast(setToast, 'Empleado creado');
      }
      resetEmpForm();
      cargarEmpleados();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  const handleEmpDelete = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar a ${nombre}?`)) return;
    try {
      await api.auth.empleados.delete(id);
      mostrarToast(setToast, 'Empleado eliminado');
      cargarEmpleados();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  const iniciarEditarEmp = async (emp) => {
    setEmpEditId(emp.id);
    setEmpShowAdd(false);
    setEmpForm({
      nombre: emp.nombre || '',
      apellido: emp.apellido || '',
      email: emp.email || '',
      password: '',
      telefono: emp.telefono || '',
      identificacion: emp.identificacion || '',
      sedes_asignadas: [],
      horarios: {},
      servicios_asignados: {},
    });

    try {
      const items = await api.disponibilidad.getByAdmin(emp.id);
      const sedes = [...new Set(items.map((i) => i.ubicacion_id))];
      
      const horariosMap = {};
      sedes.forEach((sid) => {
        horariosMap[sid] = crearHorarioDefault();
        for (let d = 1; d <= 7; d++) {
          horariosMap[sid][d].disponible = false;
        }
      });

      items.forEach((item) => {
        const sid = item.ubicacion_id;
        const dia = item.dia_semana;
        const inicio = (item.hora_inicio || '').slice(0, 5);
        const fin = (item.hora_fin || '').slice(0, 5);

        if (!horariosMap[sid]) {
          horariosMap[sid] = crearHorarioDefault();
        }

        horariosMap[sid][dia] = {
          disponible: true,
          hora_inicio: inicio || '08:00',
          hora_fin: fin || '17:00',
        };
      });

      const times = await api.reservas.empleadoTiempos.get(emp.id);
      const srvMap = {};
      times.forEach(t => {
        srvMap[t.servicio_id] = {
          checked: true,
          duracion: t.tiempo_minutos || t.duracion || 30
        };
      });

      setEmpForm((p) => ({
        ...p,
        sedes_asignadas: sedes,
        horarios: horariosMap,
        servicios_asignados: srvMap,
      }));
      
      if (sedes.length > 0) {
        setSelectedSedeScheduleId(sedes[0]);
      } else {
        setSelectedSedeScheduleId(null);
      }
    } catch (e) {
      mostrarToast(setToast, 'Error al cargar los datos del empleado', 'error');
    }
  };

  useEffect(() => {
    if (activeSheet === 'empleados' || activeSheet === 'servicios') cargarEmpleados();
  }, [activeSheet, cargarEmpleados]);

  // ==================== SERVICIOS ====================

  const cargarServicios = useCallback(async () => {
    setServiciosLoading(true);
    try {
      const data = await api.reservas.servicios();
      const mapped = (data || []).map(s => ({
        ...s,
        precio: s.precio ?? s.precio_base,
        duracion: s.duracion ?? s.duracion_base_minutos
      }));
      setServicios(mapped);
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setServiciosLoading(false);
    }
  }, []);

  const resetSrvForm = () => {
    setSrvForm({ nombre: '', descripcion: '', precio: '', duracion: '' });
    setSrvShowAdd(false);
    setSrvEditId(null);
  };

  const handleSrvSave = async () => {
    try {
      const body = {
        nombre: srvForm.nombre,
        descripcion: srvForm.descripcion,
        precio_base: Number(srvForm.precio) || 0,
        duracion_base_minutos: 30 // Valor por defecto
      };
      if (srvEditId) {
        await api.reservas.updateServicio(srvEditId, body);
        mostrarToast(setToast, 'Servicio actualizado');
      } else {
        await api.reservas.createServicio(body);
        mostrarToast(setToast, 'Servicio creado');
      }
      resetSrvForm();
      cargarServicios();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  const handleSrvDelete = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar servicio "${nombre}"?`)) return;
    try {
      await api.reservas.deleteServicio(id);
      mostrarToast(setToast, 'Servicio eliminado');
      cargarServicios();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  const iniciarEditarSrv = (srv) => {
    setSrvEditId(srv.id);
    setSrvShowAdd(false);
    setSrvForm({
      nombre: srv.nombre || '',
      descripcion: srv.descripcion || '',
      precio: srv.precio ?? srv.precio_base ?? '',
      duracion: '',
    });
  };

  const cargarEmpleadoTiempos = async (empId) => {
    setEtEmpleadoId(empId);
    if (!empId) { setEtTiempos([]); setEtForm({}); return; }
    setEtLoading(true);
    try {
      const data = await api.reservas.empleadoTiempos.get(empId);
      setEtTiempos(data || []);
      
      const form = {};
      data.forEach((t) => {
        form[t.servicio_id] = {
          checked: true,
          duracion: t.tiempo_minutos || t.duracion || 30
        };
      });
      setEtForm(form);
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setEtLoading(false);
    }
  };

  useEffect(() => {
    if (activeSheet === 'servicios') cargarServicios();
  }, [activeSheet, cargarServicios]);

  // ==================== SEDES ====================

  const cargarSedes = useCallback(async () => {
    setSedesLoading(true);
    try {
      const data = await api.ubicaciones.list();
      setSedes(data || []);
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setSedesLoading(false);
    }
  }, []);

  const resetSedForm = () => {
    setSedForm({ nombre: '', direccion: '', latitud: '', longitud: '' });
    setSedShowAdd(false);
    setSedEditId(null);
  };

  const handleSedSave = async () => {
    try {
      const body = {
        ...sedForm,
        latitud: Number(sedForm.latitud) || 0,
        longitud: Number(sedForm.longitud) || 0,
      };
      if (sedEditId) {
        await api.ubicaciones.update(sedEditId, body);
        mostrarToast(setToast, 'Sede actualizada');
      } else {
        await api.ubicaciones.create(body);
        mostrarToast(setToast, 'Sede creada');
      }
      resetSedForm();
      cargarSedes();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  const handleSedDelete = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar sede "${nombre}"?`)) return;
    try {
      await api.ubicaciones.delete(id);
      mostrarToast(setToast, 'Sede eliminada');
      cargarSedes();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  const iniciarEditarSed = (sed) => {
    setSedEditId(sed.id);
    setSedShowAdd(false);
    setSedForm({
      nombre: sed.nombre || '',
      direccion: sed.direccion || '',
      latitud: sed.latitud ?? '',
      longitud: sed.longitud ?? '',
    });
  };

  useEffect(() => {
    if (activeSheet === 'sedes') cargarSedes();
  }, [activeSheet, cargarSedes]);

  // ==================== HORARIOS ====================

  const cargarHorarios = async (ubicacion_id) => {
    if (!ubicacion_id) { setHorarios([]); return; }
    setHorariosLoading(true);
    try {
      const data = await api.reservas.jornada.get(ubicacion_id);
      setHorarios(data || []);
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setHorariosLoading(false);
    }
  };

  const handleHorChange = (value) => {
    setHorSedeId(value);
    cargarHorarios(value);
  };

  const actualizarHorarioItem = (idx, field, value) => {
    setHorarios((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  };

  const handleHorSave = async () => {
    if (!horSedeId) return mostrarToast(setToast, 'Selecciona una sede', 'warning');
    try {
      await api.reservas.jornada.update({ ubicacion_id: Number(horSedeId), items: horarios });
      mostrarToast(setToast, 'Jornadas actualizadas');
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  useEffect(() => {
    if (activeSheet === 'horarios') { setHorSedeId(''); setHorarios([]); }
  }, [activeSheet]);

  // ==================== REPORTES ====================

  const cargarReporte = useCallback(async () => {
    setRepLoading(true);
    try {
      let data = null;
      if (repTab === 'ventas') {
        data = await api.reportes.ventasDiarias(repFecha);
      } else if (repTab === 'ocupacion') {
        data = await api.reportes.ocupacion(repFecha);
      } else if (repTab === 'recurrentes') {
        data = await api.reportes.clientesRecurrentes();
      }
      setRepData(data ?? []);
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setRepLoading(false);
    }
  }, [repTab, repFecha]);

  useEffect(() => {
    if (activeSheet === 'reportes') cargarReporte();
  }, [activeSheet, repTab, repFecha, cargarReporte]);

  // ==================== MODERAR CLIENTES ====================

  const cargarClientesMod = useCallback(async () => {
    setClientesModLoading(true);
    try {
      const data = await api.clientes.list();
      setClientesMod(data || []);
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setClientesModLoading(false);
    }
  }, []);

  const handleBloquear = async () => {
    if (!bloqueoMotivo.trim()) return mostrarToast(setToast, 'Ingresa un motivo', 'warning');
    try {
      await api.clientes.block(bloqueoId, bloqueoMotivo);
      mostrarToast(setToast, 'Cliente bloqueado');
      setBloqueoId(null);
      setBloqueoMotivo('');
      cargarClientesMod();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  const handleDesbloquear = async (id) => {
    try {
      await api.clientes.unblock(id);
      mostrarToast(setToast, 'Cliente desbloqueado');
      cargarClientesMod();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  const handleClienteDelete = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar permanentemente a "${nombre}"? Esta acción es irreversible.`)) return;
    try {
      await api.clientes.delete(id);
      mostrarToast(setToast, 'Cliente eliminado');
      cargarClientesMod();
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  useEffect(() => {
    if (activeSheet === 'clientes') cargarClientesMod();
  }, [activeSheet, cargarClientesMod]);

  // ==================== LOGS ====================

  const buildLogParams = () => {
    const p = {};
    if (logsFiltro) p.filtro = logsFiltro;
    if (logsFecha) p.fecha = logsFecha;
    if (logsSeveridad) p.severidad = logsSeveridad;
    return p;
  };

  const cargarLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = buildLogParams();
      const data = logsTab === 'actividad'
        ? await api.logs.actividad(params)
        : await api.logs.errores(params);
      setLogsData(data || []);
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    } finally {
      setLogsLoading(false);
    }
  }, [logsTab, logsFiltro, logsFecha, logsSeveridad]);

  useEffect(() => {
    if (activeSheet === 'logs') cargarLogs();
  }, [activeSheet, cargarLogs]);

  const handleLogsExport = async () => {
    try {
      const params = { tipo: logsTab };
      if (logsExpDesde) params.desde = logsExpDesde;
      if (logsExpHasta) params.hasta = logsExpHasta;
      const data = await api.logs.exportar(params);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs_${logsTab}_${hoy()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      mostrarToast(setToast, 'Exportado correctamente');
    } catch (e) {
      mostrarToast(setToast, e.message, 'error');
    }
  };

  // ==================== RENDER HELPERS ====================

  const ubicacionNombre = (id) => ubicaciones.find((u) => u.id === id)?.nombre || `Sede #${id}`;

  const sedeOptions = [
    { value: '', label: 'Todas las sedes' },
    ...ubicaciones.map((u) => ({ value: String(u.id), label: u.nombre })),
  ];

  const estadoBadgeVariant = (estado) => {
    const map = { confirmada: 'success', completada: 'success', cancelada: 'danger', no_show: 'danger', pendiente: 'warning' };
    return map[estado] || 'default';
  };

  const estadoLabel = (estado) => {
    const map = { confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada', no_show: 'No show', pendiente: 'Pendiente' };
    return map[estado] || estado;
  };

  // ==================== RENDER ====================

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* ---- TOAST ---- */}
      <Toast message={toast.message} type={toast.type} open={toast.open} />

      {/* ---- MODAL: Validar entrada ---- */}
      <Modal open={activeSheet === 'qr'} onClose={cerrarQR} title="Validar entrada">
        <div className="space-y-4">
          <p className="text-sm text-texto-secundario">Escanea o ingresa el codigo QR para validar el ingreso del cliente.</p>

          {!camaraActiva ? (
            <Button variant="secundario" className="w-full" onClick={activarCamara}>
              Activar camara para escanear QR
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="bg-black rounded-lg overflow-hidden" style={{ maxHeight: '240px' }}>
                <video ref={videoRef} autoPlay playsInline className="w-full" style={{ maxHeight: '240px', objectFit: 'cover' }} />
              </div>
              <Button variant="secundario" className="w-full" onClick={apagarCamara}>
                Apagar camara
              </Button>
            </div>
          )}

          {errorCamara && <p className="text-error text-sm">{errorCamara}</p>}

          <Input label="Token QR (manual)" value={qrToken} onChange={(e) => setQrToken(e.target.value)} placeholder="O ingresa el token QR manualmente" />
          <Button variant="primario" className="w-full" onClick={handleValidarQR} disabled={qrLoading}>
            {qrLoading ? <Spinner /> : 'Validar entrada'}
          </Button>
          {qrResult && (
            <Card className="mt-4">
              <p className="text-sm text-texto-secundario">Resultado:</p>
              <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(qrResult, null, 2)}</pre>
            </Card>
          )}
        </div>
      </Modal>

      {/* ---- SHEET: Empleados ---- */}
      <Sheet open={activeSheet === 'empleados'} onClose={() => { setActiveSheet(null); resetEmpForm(); }} title="Gestión de Empleados">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display text-lg text-texto-principal">Empleados</h3>
            <Button variant="primario" size="sm" onClick={() => { resetEmpForm(); setEmpShowAdd(!empShowAdd); }}>
              Agregar
            </Button>
          </div>

          {(empShowAdd || empEditId) && (
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nombre" value={empForm.nombre} onChange={(e) => setEmpForm((p) => ({ ...p, nombre: e.target.value }))} />
                <Input label="Apellido" value={empForm.apellido} onChange={(e) => setEmpForm((p) => ({ ...p, apellido: e.target.value }))} />
                <Input label="Email" type="email" value={empForm.email} onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))} />
                {!empEditId && <Input label="Password" type="password" value={empForm.password} onChange={(e) => setEmpForm((p) => ({ ...p, password: e.target.value }))} />}
                {empEditId && <Input label="Nuevo Password (opcional)" type="password" value={empForm.password} onChange={(e) => setEmpForm((p) => ({ ...p, password: e.target.value }))} placeholder="Dejar vacío para no cambiar" />}
                <Input label="Teléfono" value={empForm.telefono} onChange={(e) => setEmpForm((p) => ({ ...p, telefono: e.target.value }))} />
                <Input label="Identificación" value={empForm.identificacion} onChange={(e) => setEmpForm((p) => ({ ...p, identificacion: e.target.value }))} />
              </div>

              {/* ---- SECCIÓN: Sedes Asignadas ---- */}
              <div className="space-y-2 mt-4">
                <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider block">
                  Sedes de trabajo asignadas:
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {ubicaciones.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 text-xs font-semibold text-texto-principal bg-fondo border border-borde p-2 rounded-xl cursor-pointer hover:bg-superficie transition shadow-sm select-none"
                    >
                      <input
                        type="checkbox"
                        checked={empForm.sedes_asignadas?.includes(u.id) || false}
                        onChange={(e) => toggleSedeAsignada(u.id, e.target.checked)}
                        className="rounded text-primario border-borde w-4 h-4 cursor-pointer"
                      />
                      {u.nombre}
                    </label>
                  ))}
                </div>
              </div>

              {/* ---- SECCIÓN: Horarios asignados por sede ---- */}
              {empForm.sedes_asignadas?.length > 0 && (
                <div className="border-t border-borde/60 pt-4 mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-texto-secundario">
                      Configurar Horarios por Sede:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {empForm.sedes_asignadas.map((sid) => {
                        const sedeObj = ubicaciones.find((u) => u.id === sid);
                        if (!sedeObj) return null;
                        const isSelected = selectedSedeScheduleId === sid;
                        return (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => setSelectedSedeScheduleId(sid)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-primario text-white shadow-sm'
                                : 'bg-fondo border border-borde text-texto-principal hover:bg-superficie'
                            }`}
                          >
                            {sedeObj.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedSedeScheduleId && empForm.horarios?.[selectedSedeScheduleId] && (
                    <Card className="bg-fondo/20 border-borde/50 p-4 space-y-3">
                      <p className="text-xs font-bold text-texto-secundario mb-2">
                        Días y Horas para {ubicaciones.find((u) => u.id === selectedSedeScheduleId)?.nombre}:
                      </p>
                      <div className="space-y-2">
                        {[
                          { dia: 1, label: 'Lunes' },
                          { dia: 2, label: 'Martes' },
                          { dia: 3, label: 'Miércoles' },
                          { dia: 4, label: 'Jueves' },
                          { dia: 5, label: 'Viernes' },
                          { dia: 6, label: 'Sábado' },
                          { dia: 7, label: 'Domingo' },
                        ].map(({ dia, label }) => {
                          const config = empForm.horarios[selectedSedeScheduleId][dia] || {
                            disponible: false,
                            hora_inicio: '08:00',
                            hora_fin: '17:00',
                          };
                          return (
                            <div
                              key={dia}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-superficie rounded-xl border border-borde/30 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={config.disponible}
                                  onChange={(e) =>
                                    updateDiaConfig(selectedSedeScheduleId, dia, 'disponible', e.target.checked)
                                  }
                                  className="rounded text-primario border-borde cursor-pointer w-4 h-4"
                                />
                                <span className="font-semibold text-texto-principal w-20">{label}</span>
                                <Badge variant={config.disponible ? 'success' : 'secondary'}>
                                  {config.disponible ? 'Disponible' : 'Descanso'}
                                </Badge>
                              </div>
                              {config.disponible && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={config.hora_inicio}
                                    onChange={(e) =>
                                      updateDiaConfig(selectedSedeScheduleId, dia, 'hora_inicio', e.target.value)
                                    }
                                    className="px-2 py-1 border border-borde rounded bg-fondo text-xs focus:outline-none"
                                  />
                                  <span className="text-texto-secundario">a</span>
                                  <input
                                    type="time"
                                    value={config.hora_fin}
                                    onChange={(e) =>
                                      updateDiaConfig(selectedSedeScheduleId, dia, 'hora_fin', e.target.value)
                                    }
                                    className="px-2 py-1 border border-borde rounded bg-fondo text-xs focus:outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </div>
              )}
              {/* ---- SECCIÓN: Servicios Asignados ---- */}
              <div className="border-t border-borde/60 pt-4 mt-4 space-y-3">
                <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider block">
                  Servicios y Duraciones:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                  {servicios.map((s) => {
                    const config = empForm.servicios_asignados?.[s.id] || { checked: false, duracion: s.duracion_base_minutos || s.duracion || 30 };
                    return (
                      <div key={s.id} className="flex items-center justify-between p-2 bg-fondo rounded-xl border border-borde/50 text-xs">
                        <label className="flex items-center gap-2 font-semibold text-texto-principal cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={config.checked}
                            onChange={(e) => {
                              setEmpForm(p => ({
                                ...p,
                                servicios_asignados: {
                                  ...p.servicios_asignados,
                                  [s.id]: { ...config, checked: e.target.checked }
                                }
                              }));
                            }}
                            className="rounded text-primario border-borde w-4 h-4 cursor-pointer"
                          />
                          {s.nombre}
                        </label>
                        {config.checked && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="5"
                              value={config.duracion}
                              onChange={(e) => {
                                setEmpForm(p => ({
                                  ...p,
                                  servicios_asignados: {
                                    ...p.servicios_asignados,
                                    [s.id]: { ...config, duracion: Number(e.target.value) }
                                  }
                                }));
                              }}
                              className="w-16 px-1.5 py-0.5 border border-borde rounded bg-superficie text-xs focus:outline-none text-center"
                            />
                            <span className="text-texto-secundario text-[10px]">min</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="primario" size="sm" onClick={handleEmpSave}>{empEditId ? 'Actualizar' : 'Guardar'}</Button>
                <Button variant="secundario" size="sm" onClick={resetEmpForm}>Cancelar</Button>
              </div>
            </Card>
          )}

          {empleadosLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Apellido</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Teléfono</th>
                    <th className="py-2 pr-3">Identificación</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((emp) => (
                    <tr key={emp.id} className="border-b border-borde/50">
                      <td className="py-2 pr-3">{emp.nombre}</td>
                      <td className="py-2 pr-3">{emp.apellido}</td>
                      <td className="py-2 pr-3 text-xs">{emp.email}</td>
                      <td className="py-2 pr-3">{emp.telefono}</td>
                      <td className="py-2 pr-3">{emp.identificacion}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => iniciarEditarEmp(emp)}>Editar</Button>
                          <Button variant="danger" size="sm" onClick={() => handleEmpDelete(emp.id, emp.nombre)}>Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {empleados.length === 0 && (
                    <tr><td colSpan="7" className="py-8 text-center text-texto-secundario">No hay empleados registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Sheet>

      {/* ---- SHEET: Servicios ---- */}
      <Sheet open={activeSheet === 'servicios'} onClose={() => { setActiveSheet(null); resetSrvForm(); }} title="Gestión de Servicios">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-display text-lg text-texto-principal">Servicios</h3>
            <Button variant="primario" size="sm" onClick={() => { resetSrvForm(); setSrvShowAdd(!srvShowAdd); }}>
              Agregar
            </Button>
          </div>

          {(srvShowAdd || srvEditId) && (
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nombre" value={srvForm.nombre} onChange={(e) => setSrvForm((p) => ({ ...p, nombre: e.target.value }))} />
                <Input label="Precio" type="number" value={srvForm.precio} onChange={(e) => setSrvForm((p) => ({ ...p, precio: e.target.value }))} />
                <Input label="Descripción" value={srvForm.descripcion} onChange={(e) => setSrvForm((p) => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="primario" size="sm" onClick={handleSrvSave}>{srvEditId ? 'Actualizar' : 'Guardar'}</Button>
                <Button variant="secundario" size="sm" onClick={resetSrvForm}>Cancelar</Button>
              </div>
            </Card>
          )}

          {serviciosLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Descripción</th>
                    <th className="py-2 pr-3">Precio</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map((srv) => (
                    <tr key={srv.id} className="border-b border-borde/50">
                      <td className="py-2 pr-3 font-medium">{srv.nombre}</td>
                      <td className="py-2 pr-3 text-xs text-texto-secundario max-w-[200px] truncate">{srv.descripcion}</td>
                      <td className="py-2 pr-3">${Number(srv.precio).toFixed(2)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => iniciarEditarSrv(srv)}>Editar</Button>
                          <Button variant="danger" size="sm" onClick={() => handleSrvDelete(srv.id, srv.nombre)}>Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {servicios.length === 0 && (
                    <tr><td colSpan="4" className="py-8 text-center text-texto-secundario">No hay servicios registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <Card>
            <h4 className="font-medium text-texto-principal mb-3">Tiempos de servicio por empleado</h4>
            <Select
              label="Empleado"
              options={[{ value: '', label: 'Seleccionar empleado...' }, ...empleados.map((e) => ({ value: String(e.id), label: `${e.nombre} ${e.apellido}` }))]}
              value={etEmpleadoId}
              onChange={(e) => cargarEmpleadoTiempos(e.target.value)}
            />
            {etLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : etEmpleadoId ? (
              <div className="mt-4 space-y-4">
                {/* Selector de servicio a agregar + Botón a la derecha */}
                <div className="flex items-end gap-2 bg-fondo/35 p-3 rounded-2xl border border-borde/40">
                  <div className="flex-grow">
                    <Select
                      label="Asociar nuevo servicio"
                      value={srvToAddId}
                      onChange={(e) => setSrvToAddId(e.target.value)}
                      options={[
                        { value: '', label: 'Seleccionar servicio...' },
                        ...servicios
                          .filter((s) => !etTiempos.some((t) => t.servicio_id === s.id))
                          .map((s) => ({ value: String(s.id), label: s.nombre }))
                      ]}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primario"
                    disabled={!srvToAddId}
                    onClick={() => {
                      const chosen = servicios.find(s => String(s.id) === String(srvToAddId));
                      if (chosen) {
                        setEtTiempos(p => [
                          ...p,
                          {
                            servicio_id: chosen.id,
                            servicio_nombre: chosen.nombre,
                            tiempo_minutos: chosen.duracion_base_minutos || chosen.duracion || 30
                          }
                        ]);
                        setSrvToAddId('');
                      }
                    }}
                  >
                    Agregar
                  </Button>
                </div>

                {/* Lista de servicios activos */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider block">
                    Servicios Activos:
                  </span>
                  {etTiempos.length === 0 ? (
                    <p className="text-xs text-texto-secundario italic p-2 bg-fondo/20 border border-dashed border-borde rounded-xl text-center">
                      No tiene servicios activos asignados.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                      {etTiempos.map((t, idx) => (
                        <div key={t.servicio_id} className="flex items-center justify-between p-3 bg-fondo rounded-xl border border-borde/50 text-xs">
                          <span className="font-semibold text-texto-principal">{t.servicio_nombre || t.nombre}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="5"
                                value={t.tiempo_minutos || t.duracion || 30}
                                onChange={(e) => {
                                  const updatedVal = Number(e.target.value);
                                  setEtTiempos(prev => prev.map((item, i) => i === idx ? { ...item, tiempo_minutos: updatedVal } : item));
                                }}
                                className="w-16 px-1.5 py-0.5 border border-borde rounded bg-superficie text-xs focus:outline-none text-center"
                              />
                              <span className="text-texto-secundario text-[10px]">min</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEtTiempos(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="text-error hover:text-red-700 transition font-bold"
                              title="Remover servicio"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-middle">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="primario"
                  size="sm"
                  className="w-full mt-2"
                  onClick={async () => {
                    try {
                      const items = etTiempos.map(t => ({
                        servicio_id: t.servicio_id,
                        duracion_minutos: Number(t.tiempo_minutos || t.duracion) || 30
                      }));
                      await api.reservas.empleadoTiempos.update({ empleado_id: Number(etEmpleadoId), items });
                      mostrarToast(setToast, 'Tiempos de servicio actualizados');
                      cargarEmpleadoTiempos(etEmpleadoId);
                    } catch (e) {
                      mostrarToast(setToast, e.message, 'error');
                    }
                  }}
                >
                  Guardar Tiempos de Servicio
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      </Sheet>

      {/* ---- SHEET: Sedes ---- */}
      <Sheet open={activeSheet === 'sedes'} onClose={() => { setActiveSheet(null); resetSedForm(); }} title="Gestión de Sedes">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display text-lg text-texto-principal">Sedes / Ubicaciones</h3>
            <Button variant="primario" size="sm" onClick={() => { resetSedForm(); setSedShowAdd(!sedShowAdd); }}>
              Agregar
            </Button>
          </div>

          {(sedShowAdd || sedEditId) && (
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nombre" value={sedForm.nombre} onChange={(e) => setSedForm((p) => ({ ...p, nombre: e.target.value }))} />
                <Input label="Dirección" value={sedForm.direccion} onChange={(e) => setSedForm((p) => ({ ...p, direccion: e.target.value }))} />
                <Input label="Latitud" type="number" step="any" value={sedForm.latitud} onChange={(e) => setSedForm((p) => ({ ...p, latitud: e.target.value }))} />
                <Input label="Longitud" type="number" step="any" value={sedForm.longitud} onChange={(e) => setSedForm((p) => ({ ...p, longitud: e.target.value }))} />
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="primario" size="sm" onClick={handleSedSave}>{sedEditId ? 'Actualizar' : 'Guardar'}</Button>
                <Button variant="secundario" size="sm" onClick={resetSedForm}>Cancelar</Button>
              </div>
            </Card>
          )}

          {sedesLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Dirección</th>
                    <th className="py-2 pr-3">Latitud</th>
                    <th className="py-2 pr-3">Longitud</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sedes.map((sed) => (
                    <tr key={sed.id} className="border-b border-borde/50">
                      <td className="py-2 pr-3 font-medium">{sed.nombre}</td>
                      <td className="py-2 pr-3 text-xs text-texto-secundario">{sed.direccion}</td>
                      <td className="py-2 pr-3">{sed.latitud}</td>
                      <td className="py-2 pr-3">{sed.longitud}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => iniciarEditarSed(sed)}>Editar</Button>
                          <Button variant="danger" size="sm" onClick={() => handleSedDelete(sed.id, sed.nombre)}>Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sedes.length === 0 && (
                    <tr><td colSpan="5" className="py-8 text-center text-texto-secundario">No hay sedes registradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Sheet>

      {/* ---- SHEET: Horarios ---- */}
      <Sheet open={activeSheet === 'horarios'} onClose={() => setActiveSheet(null)} title="Gestión de Horarios / Jornadas">
        <div className="space-y-4">
          <Select
            label="Seleccionar sede"
            options={[{ value: '', label: 'Seleccionar...' }, ...ubicaciones.map((u) => ({ value: String(u.id), label: u.nombre }))]}
            value={horSedeId}
            onChange={(e) => handleHorChange(e.target.value)}
          />

          {horariosLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : horSedeId && horarios.length > 0 ? (
            <div className="space-y-3">
              {horarios.map((j, idx) => (
                <Card key={idx} className="space-y-2">
                  <p className="text-sm font-medium text-texto-principal">{j.fecha || `Día #${idx + 1}`}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Hora inicio"
                      type="time"
                      value={j.hora_inicio || ''}
                      onChange={(e) => actualizarHorarioItem(idx, 'hora_inicio', e.target.value)}
                    />
                    <Input
                      label="Hora fin"
                      type="time"
                      value={j.hora_fin || ''}
                      onChange={(e) => actualizarHorarioItem(idx, 'hora_fin', e.target.value)}
                    />
                  </div>
                </Card>
              ))}
              <Button variant="primario" onClick={handleHorSave}>Guardar jornadas</Button>
            </div>
          ) : horSedeId && horarios.length === 0 ? (
            <p className="text-sm text-texto-secundario py-8 text-center">No hay jornadas configuradas para esta sede</p>
          ) : null}
        </div>
      </Sheet>

      {/* ---- SHEET: Reportes ---- */}
      <Sheet open={activeSheet === 'reportes'} onClose={() => setActiveSheet(null)} title="Reportes">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 bg-fondo border border-borde rounded-xl p-1">
            {[
              { key: 'ventas', label: 'Ventas diarias' },
              { key: 'ocupacion', label: 'Ocupación' },
              { key: 'recurrentes', label: 'Clientes recurrentes' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setRepTab(tab.key); setRepData(null); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  repTab === tab.key ? 'bg-superficie shadow-sm text-primario' : 'text-texto-secundario hover:text-texto-principal'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {repTab !== 'recurrentes' && (
            <Input label="Fecha" type="date" value={repFecha} onChange={(e) => setRepFecha(e.target.value)} />
          )}

          {repLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : repTab === 'ventas' && repData ? (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-display text-lg text-texto-principal">Ventas del {repFecha}</h4>
                <Badge variant="success">Total: ${Number(repData?.total ?? 0).toFixed(2)}</Badge>
              </div>
              {repData?.desglose?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                        <th className="py-2 pr-3">Servicio</th>
                        <th className="py-2 pr-3">Cantidad</th>
                        <th className="py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repData.desglose.map((d, i) => (
                        <tr key={i} className="border-b border-borde/50">
                          <td className="py-2 pr-3">{d.servicio || `Servicio #${d.servicio_id}`}</td>
                          <td className="py-2 pr-3">{d.cantidad}</td>
                          <td className="py-2">${Number(d.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-texto-secundario py-8 text-center">Sin datos de ventas para esta fecha</p>
              )}
            </div>
          ) : repTab === 'ocupacion' && repData ? (
            <div>
              <h4 className="font-display text-lg text-texto-principal mb-3">Ocupación del {repFecha}</h4>
              {Array.isArray(repData) && repData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                        <th className="py-2 pr-3">Sede</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Completadas</th>
                        <th className="py-2 pr-3">Canceladas</th>
                        <th className="py-2">No Show</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repData.map((d, i) => (
                        <tr key={i} className="border-b border-borde/50">
                          <td className="py-2 pr-3">{d.sede || ubicacionNombre(d.ubicacion_id)}</td>
                          <td className="py-2 pr-3">{d.total}</td>
                          <td className="py-2 pr-3">{d.completadas ?? d.confirmadas ?? 0}</td>
                          <td className="py-2 pr-3">{d.canceladas ?? 0}</td>
                          <td className="py-2">{d.no_show ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-texto-secundario py-8 text-center">Sin datos de ocupación para esta fecha</p>
              )}
            </div>
          ) : repTab === 'recurrentes' && repData ? (
            <div>
              <h4 className="font-display text-lg text-texto-principal mb-3">Clientes recurrentes</h4>
              {Array.isArray(repData) && repData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                        <th className="py-2 pr-3">Cliente</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2">Total reservas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repData.map((d, i) => (
                        <tr key={i} className="border-b border-borde/50">
                          <td className="py-2 pr-3">{d.nombre} {d.apellido}</td>
                          <td className="py-2 pr-3 text-xs">{d.email}</td>
                          <td className="py-2">{d.total_reservas ?? d.total ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-texto-secundario py-8 text-center">No hay clientes recurrentes</p>
              )}
            </div>
          ) : null}
        </div>
      </Sheet>

      {/* ---- SHEET: Moderar clientes ---- */}
      <Sheet open={activeSheet === 'clientes'} onClose={() => { setActiveSheet(null); setBloqueoId(null); }} title="Moderar Clientes">
        <div className="space-y-4">
          {clientesModLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Apellido</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Teléfono</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesMod.map((c) => (
                    <tr key={c.id} className="border-b border-borde/50">
                      <td className="py-2 pr-3">{c.nombre}</td>
                      <td className="py-2 pr-3">{c.apellido}</td>
                      <td className="py-2 pr-3 text-xs">{c.email}</td>
                      <td className="py-2 pr-3">{c.telefono}</td>
                      <td className="py-2 pr-3">
                        {c.bloqueado ? (
                          <Badge variant="danger">Bloqueado</Badge>
                        ) : (
                          <Badge variant="success">Activo</Badge>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1 flex-wrap">
                          {c.bloqueado ? (
                            <Button variant="exito" size="sm" onClick={() => handleDesbloquear(c.id)}>Desbloquear</Button>
                          ) : bloqueoId === c.id ? (
                            <div className="flex flex-wrap items-center gap-1 justify-center">
                              <input
                                className="px-2 py-1 border border-borde rounded text-xs w-32"
                                placeholder="Motivo"
                                value={bloqueoMotivo}
                                onChange={(e) => setBloqueoMotivo(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleBloquear()}
                              />
                              <Button variant="danger" size="sm" onClick={handleBloquear}>Confirmar</Button>
                              <Button variant="secundario" size="sm" onClick={() => { setBloqueoId(null); setBloqueoMotivo(''); }}>Cancelar</Button>
                            </div>
                          ) : (
                            <Button variant="secundario" size="sm" onClick={() => { setBloqueoId(c.id); setBloqueoMotivo(''); }}>Bloquear</Button>
                          )}
                          <Button variant="danger" size="sm" onClick={() => handleClienteDelete(c.id, `${c.nombre} ${c.apellido}`)}>Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {clientesMod.length === 0 && (
                    <tr><td colSpan="6" className="py-8 text-center text-texto-secundario">No hay clientes registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Sheet>

      {/* ---- SHEET: Logs ---- */}
      <Sheet open={activeSheet === 'logs'} onClose={() => setActiveSheet(null)} title="Logs del Sistema">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-grow">
              <input
                type="text"
                placeholder="Buscar logs..."
                value={logsFiltro}
                onChange={(e) => setLogsFiltro(e.target.value)}
                className="w-full px-3 py-1.5 border border-borde rounded-lg text-xs bg-fondo/20 focus:outline-none"
              />
            </div>
            <div>
              <select
                value={logsSeveridad}
                onChange={(e) => setLogsSeveridad(e.target.value)}
                className="px-3 py-1.5 border border-borde rounded-lg text-xs bg-fondo/20 focus:outline-none"
              >
                <option value="">Severidad</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
          </div>

          <div className="flex gap-1 bg-fondo border border-borde rounded-xl p-1">
            <button
              onClick={() => { setLogsTab('actividad'); setLogsData([]); }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition ${
                logsTab === 'actividad' ? 'bg-superficie shadow-sm text-primario' : 'text-texto-secundario'
              }`}
            >
              logs.txt (Actividad)
            </button>
            <button
              onClick={() => { setLogsTab('errores'); setLogsData([]); }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition ${
                logsTab === 'errores' ? 'bg-superficie shadow-sm text-primario' : 'text-texto-secundario'
              }`}
            >
              errores.txt (Fallos)
            </button>
          </div>

          <div className="bg-gray-900 text-green-400 rounded-2xl p-4 font-mono text-[10px] h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
            {logsLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : logsData.length === 0 ? (
              <div className="text-white/40 italic">[Sin logs de tipo {logsTab} que coincidan]</div>
            ) : (
              logsData.map((log, i) => {
                const timestamp = log.timestamp || log.fecha || log.created_at || '-';
                const severidad = log.severidad || log.nivel || 'INFO';
                const msg = log.mensaje || log.descripcion || JSON.stringify(log);

                let sevCls = 'text-green-400';
                if (severidad === 'WARN') sevCls = 'text-amber-400';
                else if (severidad === 'ERROR') sevCls = 'text-red-400 font-bold';

                return (
                  <div key={i} className="mb-1">
                    <span className="text-white/60">[{timestamp}]</span>{' '}
                    <span className={sevCls}>{severidad}</span>{' '}
                    <span className="text-green-300">{msg}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center pt-2 border-t border-borde/50">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] text-texto-secundario font-semibold">Exportar Rango:</span>
              <input
                type="date"
                value={logsExpDesde}
                onChange={(e) => setLogsExpDesde(e.target.value)}
                className="px-2 py-1 border border-borde rounded text-[10px] bg-fondo"
              />
              <span className="text-[10px] text-texto-secundario">a</span>
              <input
                type="date"
                value={logsExpHasta}
                onChange={(e) => setLogsExpHasta(e.target.value)}
                className="px-2 py-1 border border-borde rounded text-[10px] bg-fondo"
              />
            </div>
            <button
              onClick={handleLogsExport}
              className="px-3 py-1.5 bg-fondo border border-borde hover:bg-superficie text-texto-principal rounded-lg text-[10px] font-bold transition cursor-pointer"
            >
              Exportar JSON
            </button>
          </div>
        </div>
      </Sheet>

      {/* ---- SECCIÓN DE GESTIÓN ---- */}
      <div className="bg-superficie border border-borde rounded-2xl p-4 shadow-premium">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-texto-secundario mr-1">
            Gestión:
          </span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveSheet('empleados')} className="px-4 py-2 bg-fondo border border-borde hover:bg-superficie rounded-xl text-xs font-semibold text-texto-principal transition cursor-pointer">Empleados</button>
            <button onClick={() => setActiveSheet('servicios')} className="px-4 py-2 bg-fondo border border-borde hover:bg-superficie rounded-xl text-xs font-semibold text-texto-principal transition cursor-pointer">Servicios</button>
            <button onClick={() => setActiveSheet('sedes')} className="px-4 py-2 bg-fondo border border-borde hover:bg-superficie rounded-xl text-xs font-semibold text-texto-principal transition cursor-pointer">Sedes</button>
            <button onClick={() => setActiveSheet('horarios')} className="px-4 py-2 bg-fondo border border-borde hover:bg-superficie rounded-xl text-xs font-semibold text-texto-principal transition cursor-pointer">Horarios</button>
            <button onClick={() => setActiveSheet('reportes')} className="px-4 py-2 bg-fondo border border-borde hover:bg-superficie rounded-xl text-xs font-semibold text-texto-principal transition cursor-pointer">Reportes</button>
            <button onClick={() => setActiveSheet('clientes')} className="px-4 py-2 bg-fondo border border-borde hover:bg-superficie rounded-xl text-xs font-semibold text-texto-principal transition cursor-pointer">Moderación Clientes</button>
            <button onClick={() => setActiveSheet('logs')} className="px-4 py-2 bg-fondo border border-borde hover:bg-superficie rounded-xl text-xs font-semibold text-texto-principal transition cursor-pointer">Logs del Sistema</button>
          </div>
        </div>
      </div>

      {/* ---- KPI CARDS ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-superficie border border-borde rounded-2xl p-5 shadow-premium">
          <p className="text-xs font-semibold text-texto-secundario uppercase tracking-wider">Recaudación hoy</p>
          {kpi.loading ? (
            <div className="mt-2"><Spinner /></div>
          ) : (
            <p className="font-display text-3xl font-bold text-primario mt-1">
              $ {Number(kpi.ventas ?? 0).toLocaleString('es-CO')}
            </p>
          )}
          <span className="text-[10px] text-exito font-bold">+15% vs semana anterior</span>
        </div>

        <div className="bg-superficie border border-borde rounded-2xl p-5 shadow-premium">
          <p className="text-xs font-semibold text-texto-secundario uppercase tracking-wider">Reservas del día</p>
          {kpi.loading ? (
            <div className="mt-2"><Spinner /></div>
          ) : (
            <p className="font-display text-3xl font-bold text-texto-principal mt-1">{kpi.citas}</p>
          )}
          <span className="text-[10px] text-texto-secundario font-semibold">agendadas para hoy</span>
        </div>

        <div className="bg-superficie border border-borde rounded-2xl p-5 shadow-premium">
          <p className="text-xs font-semibold text-texto-secundario uppercase tracking-wider">Tasa de Ocupación</p>
          {kpi.loading ? (
            <div className="mt-2"><Spinner /></div>
          ) : (
            <>
              <p className="font-display text-3xl font-bold text-texto-principal mt-1">
                {kpi.ocupacion?.porcentaje != null ? `${Number(kpi.ocupacion.porcentaje).toFixed(1)}%` : '0%'}
              </p>
              <div className="w-full h-1.5 bg-fondo rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-primario transition-all duration-500"
                  style={{ width: `${kpi.ocupacion?.porcentaje || 0}%` }}
                ></div>
              </div>
            </>
          )}
        </div>

        <div className="bg-superficie border border-borde rounded-2xl p-5 shadow-premium">
          <p className="text-xs font-semibold text-texto-secundario uppercase tracking-wider">Clientes Activos</p>
          {kpi.loading ? (
            <div className="mt-2"><Spinner /></div>
          ) : (
            <p className="font-display text-3xl font-bold text-texto-principal mt-1">{kpi.recurrentes}</p>
          )}
          <span className="text-[10px] text-exito font-bold">+4 nuevos registrados hoy</span>
        </div>
      </div>

      {/* ---- TIMELINE GENERAL DE CITAS ---- */}
      <div className="bg-superficie border border-borde rounded-2xl p-6 shadow-premium space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-display text-xl font-bold text-texto-principal">
              Todas las Reservas {fechaFiltro === hoy() ? 'de Hoy' : `del ${fechaFiltro}`}
            </h2>
            <p className="text-xs text-texto-secundario">Vista del estado actual de todos los turnos del salón.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                const d = new Date(fechaFiltro + 'T00:00:00');
                d.setDate(d.getDate() - 1);
                setFechaFiltro(formatearFechaLocal(d));
              }}
              className="px-2.5 py-1.5 border border-borde rounded bg-superficie hover:bg-fondo text-xs font-semibold transition cursor-pointer"
              title="Día anterior"
            >
              ←
            </button>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-borde rounded bg-superficie text-texto-principal focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const d = new Date(fechaFiltro + 'T00:00:00');
                d.setDate(d.getDate() + 1);
                setFechaFiltro(formatearFechaLocal(d));
              }}
              className="px-2.5 py-1.5 border border-borde rounded bg-superficie hover:bg-fondo text-xs font-semibold transition cursor-pointer"
              title="Día siguiente"
            >
              →
            </button>
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-borde rounded bg-fondo/20"
            >
              <option value="">Todas las Sedes</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={String(u.id)}>{u.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {reservasLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : reservas.length > 0 ? (
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto pr-1">
            <table className="w-full text-xs min-w-[800px] md:min-w-full">
              <thead>
                <tr className="border-b border-borde/70 text-left font-bold text-texto-secundario uppercase">
                  <th className="py-2.5 w-16">Hora</th>
                  <th className="py-2.5">Cliente</th>
                  <th className="py-2.5">Servicio</th>
                  <th className="py-2.5">Estilista</th>
                  <th className="py-2.5">Sede</th>
                  <th className="py-2.5 text-center">Personas</th>
                  <th className="py-2.5 text-right">Monto</th>
                  <th className="py-2.5 text-center">Estado</th>
                  <th className="py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reservas
                  .sort((a, b) => (a.hora || a.hora_inicio || '').localeCompare(b.hora || b.hora_inicio || ''))
                  .map((res) => {
                    const localInicio = res.inicia_en ? new Date(res.inicia_en) : null;
                    const horaIni = localInicio ? `${String(localInicio.getHours()).padStart(2, '0')}:${String(localInicio.getMinutes()).padStart(2, '0')}` : '--:--';
                    const hora = res.hora || res.hora_inicio || horaIni;
                    const cliente = `${res.cliente?.nombre || res.cliente_nombre || '—'} ${res.cliente?.apellido || res.cliente_apellido || ''}`;
                    const servicio = res.servicio?.nombre || res.servicio_nombre || '—';
                    const estilista = res.empleado?.nombre || res.empleado_nombre || '—';
                    const sede = res.ubicacion?.nombre || ubicacionNombre(res.ubicacion_id) || '—';
                    const personas = res.cantidad_personas || 1;
                    const monto = parseFloat(res.monto || res.precio || res.precio_base || res.servicio?.precio_base || 0);
                    return (
                      <tr key={res.id} className="border-b border-borde/40 hover:bg-fondo/20 transition-colors">
                        <td className="py-3 font-bold text-texto-principal">{hora}</td>
                        <td className="py-3 font-semibold text-texto-principal">{cliente}</td>
                        <td className="py-3 text-texto-secundario">{servicio}</td>
                        <td className="py-3 text-texto-secundario">{estilista}</td>
                        <td className="py-3 text-texto-secundario">{sede}</td>
                        <td className="py-3 text-center text-texto-secundario">{personas}</td>
                        <td className="py-3 text-right font-bold text-exito">${monto.toLocaleString('es-CO')}</td>
                        <td className="py-3 text-center">
                          <Badge variant={estadoBadgeVariant(res.estado)}>{estadoLabel(res.estado)}</Badge>
                        </td>
                        <td className="py-3 text-center">
                          {(res.estado === 'pendiente' || res.estado === 'confirmada') && (
                            <button
                              onClick={() => { setQrToken(res.qr_token || ''); setActiveSheet('qr'); }}
                              className="px-2.5 py-1 bg-primario hover:bg-primario-hover text-white rounded-lg text-[10px] font-bold transition shadow-sm"
                            >
                              Validar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-texto-secundario py-8 text-center bg-superficie rounded-xl">
            No hay reservas registradas para {fechaFiltro === hoy() ? 'hoy' : `el ${fechaFiltro}`}.
          </p>
        )}
      </div>
    </div>
  );
}
