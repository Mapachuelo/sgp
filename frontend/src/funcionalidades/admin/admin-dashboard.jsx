import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Card, Badge, Sheet, Modal, Toast, Select, Spinner } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';

const hoy = () => new Date().toISOString().split('T')[0];

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
  const [empForm, setEmpForm] = useState({ nombre: '', apellido: '', email: '', password: '', telefono: '', identificacion: '', ubicacion_base_id: '' });
  const [empEditId, setEmpEditId] = useState(null);
  const [empShowAdd, setEmpShowAdd] = useState(false);

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
        const params = { fecha: hoy() };
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
  }, [sedeFilter]);

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
    setEmpForm({ nombre: '', apellido: '', email: '', password: '', telefono: '', identificacion: '', ubicacion_base_id: '' });
    setEmpShowAdd(false);
    setEmpEditId(null);
  };

  const handleEmpSave = async () => {
    try {
      if (empEditId) {
        const { password, ...rest } = empForm;
        await api.auth.empleados.update(empEditId, password ? empForm : rest);
        mostrarToast(setToast, 'Empleado actualizado');
      } else {
        await api.auth.empleados.create(empForm);
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

  const iniciarEditarEmp = (emp) => {
    setEmpEditId(emp.id);
    setEmpShowAdd(false);
    setEmpForm({
      nombre: emp.nombre || '',
      apellido: emp.apellido || '',
      email: emp.email || '',
      password: '',
      telefono: emp.telefono || '',
      identificacion: emp.identificacion || '',
      ubicacion_base_id: emp.ubicacion_base_id ?? '',
    });
  };

  useEffect(() => {
    if (activeSheet === 'empleados') cargarEmpleados();
  }, [activeSheet, cargarEmpleados]);

  // ==================== SERVICIOS ====================

  const cargarServicios = useCallback(async () => {
    setServiciosLoading(true);
    try {
      const data = await api.reservas.servicios();
      setServicios(data || []);
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
      const body = { ...srvForm, precio: Number(srvForm.precio) || 0, duracion: Number(srvForm.duracion) || 0 };
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
      precio: srv.precio ?? '',
      duracion: srv.duracion ?? '',
    });
  };

  const cargarEmpleadoTiempos = async (empId) => {
    setEtEmpleadoId(empId);
    if (!empId) { setEtTiempos([]); return; }
    setEtLoading(true);
    try {
      const data = await api.reservas.empleadoTiempos.get(empId);
      setEtTiempos(data || []);
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
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombre" value={empForm.nombre} onChange={(e) => setEmpForm((p) => ({ ...p, nombre: e.target.value }))} />
                <Input label="Apellido" value={empForm.apellido} onChange={(e) => setEmpForm((p) => ({ ...p, apellido: e.target.value }))} />
                <Input label="Email" type="email" value={empForm.email} onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))} />
                {!empEditId && <Input label="Password" type="password" value={empForm.password} onChange={(e) => setEmpForm((p) => ({ ...p, password: e.target.value }))} />}
                {empEditId && <Input label="Nuevo Password (opcional)" type="password" value={empForm.password} onChange={(e) => setEmpForm((p) => ({ ...p, password: e.target.value }))} placeholder="Dejar vacío para no cambiar" />}
                <Input label="Teléfono" value={empForm.telefono} onChange={(e) => setEmpForm((p) => ({ ...p, telefono: e.target.value }))} />
                <Input label="Identificación" value={empForm.identificacion} onChange={(e) => setEmpForm((p) => ({ ...p, identificacion: e.target.value }))} />
                <Select
                  label="Sede base"
                  options={[{ value: '', label: 'Seleccionar...' }, ...ubicaciones.map((u) => ({ value: String(u.id), label: u.nombre }))]}
                  value={String(empForm.ubicacion_base_id ?? '')}
                  onChange={(e) => setEmpForm((p) => ({ ...p, ubicacion_base_id: e.target.value ? Number(e.target.value) : '' }))}
                />
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Apellido</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Teléfono</th>
                    <th className="py-2 pr-3">Identificación</th>
                    <th className="py-2 pr-3">Sede</th>
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
                      <td className="py-2 pr-3">{ubicacionNombre(emp.ubicacion_base_id)}</td>
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
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombre" value={srvForm.nombre} onChange={(e) => setSrvForm((p) => ({ ...p, nombre: e.target.value }))} />
                <Input label="Precio" type="number" value={srvForm.precio} onChange={(e) => setSrvForm((p) => ({ ...p, precio: e.target.value }))} />
                <Input label="Duración (min)" type="number" value={srvForm.duracion} onChange={(e) => setSrvForm((p) => ({ ...p, duracion: e.target.value }))} />
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Descripción</th>
                    <th className="py-2 pr-3">Precio</th>
                    <th className="py-2 pr-3">Duración</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map((srv) => (
                    <tr key={srv.id} className="border-b border-borde/50">
                      <td className="py-2 pr-3 font-medium">{srv.nombre}</td>
                      <td className="py-2 pr-3 text-xs text-texto-secundario max-w-[200px] truncate">{srv.descripcion}</td>
                      <td className="py-2 pr-3">${Number(srv.precio).toFixed(2)}</td>
                      <td className="py-2 pr-3">{srv.duracion} min</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => iniciarEditarSrv(srv)}>Editar</Button>
                          <Button variant="danger" size="sm" onClick={() => handleSrvDelete(srv.id, srv.nombre)}>Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {servicios.length === 0 && (
                    <tr><td colSpan="5" className="py-8 text-center text-texto-secundario">No hay servicios registrados</td></tr>
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
            ) : etEmpleadoId && etTiempos.length > 0 ? (
              <div className="mt-3 text-sm space-y-1">
                {etTiempos.map((t, i) => (
                  <div key={i} className="flex justify-between border-b border-borde/30 py-1">
                    <span>{t.servicio_nombre || `Servicio #${t.servicio_id}`}</span>
                    <span className="text-texto-secundario">{t.tiempo_minutos || t.duracion} min</span>
                  </div>
                ))}
              </div>
            ) : etEmpleadoId && etTiempos.length === 0 ? (
              <p className="text-sm text-texto-secundario mt-3">No hay tiempos registrados para este empleado</p>
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
              <div className="grid grid-cols-2 gap-3">
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
              <table className="w-full text-sm">
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
                  <div className="grid grid-cols-2 gap-3">
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
          <div className="flex gap-1 bg-fondo rounded-lg p-1">
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
                <table className="w-full text-sm">
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
              ) : (
                <p className="text-sm text-texto-secundario py-8 text-center">Sin datos de ventas para esta fecha</p>
              )}
            </div>
          ) : repTab === 'ocupacion' && repData ? (
            <div>
              <h4 className="font-display text-lg text-texto-principal mb-3">Ocupación del {repFecha}</h4>
              {Array.isArray(repData) && repData.length > 0 ? (
                <table className="w-full text-sm">
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
              ) : (
                <p className="text-sm text-texto-secundario py-8 text-center">Sin datos de ocupación para esta fecha</p>
              )}
            </div>
          ) : repTab === 'recurrentes' && repData ? (
            <div>
              <h4 className="font-display text-lg text-texto-principal mb-3">Clientes recurrentes</h4>
              {Array.isArray(repData) && repData.length > 0 ? (
                <table className="w-full text-sm">
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
              <table className="w-full text-sm">
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
                            <div className="flex items-center gap-1">
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
          <div className="flex gap-1 bg-fondo rounded-lg p-1">
            {[
              { key: 'actividad', label: 'Actividad' },
              { key: 'errores', label: 'Errores' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setLogsTab(tab.key); setLogsData([]); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  logsTab === tab.key ? 'bg-superficie shadow-sm text-primario' : 'text-texto-secundario hover:text-texto-principal'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Buscar (filtro)" value={logsFiltro} onChange={(e) => setLogsFiltro(e.target.value)} placeholder="Palabra clave..." />
            <Input label="Fecha" type="date" value={logsFecha} onChange={(e) => setLogsFecha(e.target.value)} />
            <Select
              label="Severidad"
              options={[
                { value: '', label: 'Todas' },
                { value: 'INFO', label: 'INFO' },
                { value: 'WARN', label: 'WARN' },
                { value: 'ERROR', label: 'ERROR' },
              ]}
              value={logsSeveridad}
              onChange={(e) => setLogsSeveridad(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium text-texto-principal">
              {logsData.length} resultado{logsData.length !== 1 ? 's' : ''}
            </h4>
            <div className="flex gap-2 items-end">
              <Input label="Desde" type="date" value={logsExpDesde} onChange={(e) => setLogsExpDesde(e.target.value)} className="text-xs" />
              <Input label="Hasta" type="date" value={logsExpHasta} onChange={(e) => setLogsExpHasta(e.target.value)} className="text-xs" />
              <Button variant="outline" size="sm" onClick={handleLogsExport}>Exportar</Button>
            </div>
          </div>

          {logsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : logsData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-texto-secundario text-xs uppercase">
                    <th className="py-2 pr-3">Timestamp</th>
                    <th className="py-2 pr-3">Nivel</th>
                    <th className="py-2">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {logsData.map((log, i) => (
                    <tr key={i} className="border-b border-borde/50">
                      <td className="py-2 pr-3 text-xs whitespace-nowrap">{log.timestamp || log.fecha || log.created_at || '-'}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={
                            (log.severidad || log.nivel) === 'ERROR' ? 'danger'
                            : (log.severidad || log.nivel) === 'WARN' ? 'warning'
                            : 'info'
                          }
                        >
                          {log.severidad || log.nivel || 'INFO'}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-texto-secundario">{log.mensaje || log.descripcion || JSON.stringify(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-texto-secundario py-8 text-center">No hay registros con los filtros actuales</p>
          )}
        </div>
      </Sheet>

      {/* ==================== MAIN CONTENT ==================== */}

      {/* ---- KPI CARDS ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-texto-secundario uppercase tracking-wide">Ventas del día</p>
          {kpi.loading ? (
            <div className="mt-2"><Spinner /></div>
          ) : (
            <p className="text-2xl font-bold text-primario mt-1">${Number(kpi.ventas ?? 0).toFixed(2)}</p>
          )}
        </Card>

        <Card>
          <p className="text-xs text-texto-secundario uppercase tracking-wide">Citas del día</p>
          {kpi.loading ? (
            <div className="mt-2"><Spinner /></div>
          ) : (
            <p className="text-2xl font-bold text-exito mt-1">{kpi.citas}</p>
          )}
        </Card>

        <Card>
          <p className="text-xs text-texto-secundario uppercase tracking-wide">% Ocupación</p>
          {kpi.loading ? (
            <div className="mt-2"><Spinner /></div>
          ) : (
            <p className="text-2xl font-bold text-info mt-1">
              {kpi.ocupacion?.porcentaje != null ? `${Number(kpi.ocupacion.porcentaje).toFixed(1)}%` : '—'}
            </p>
          )}
        </Card>

        <Card>
          <p className="text-xs text-texto-secundario uppercase tracking-wide">Clientes activos</p>
          {kpi.loading ? (
            <div className="mt-2"><Spinner /></div>
          ) : (
            <p className="text-2xl font-bold text-advertencia mt-1">{kpi.recurrentes}</p>
          )}
        </Card>
      </div>

      {/* ---- TIMELINE DE RESERVAS DEL DÍA ---- */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="font-display text-xl font-bold text-texto-principal">Reservas de hoy — {hoy()}</h2>
          <div className="w-56">
            <Select
              options={sedeOptions}
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
            />
          </div>
        </div>

        {reservasLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : reservas.length > 0 ? (
          <div className="space-y-3">
            {reservas
              .sort((a, b) => (a.hora || a.hora_inicio || '').localeCompare(b.hora || b.hora_inicio || ''))
              .map((res) => (
                <div key={res.id} className="flex items-start gap-4 p-4 rounded-xl bg-fondo/50 border border-borde/50">
                  <div className="shrink-0 w-16 text-center">
                    <p className="text-sm font-bold text-texto-principal">{res.hora || res.hora_inicio || '--:--'}</p>
                    <Badge variant={estadoBadgeVariant(res.estado)}>{estadoLabel(res.estado)}</Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-texto-principal">
                      {res.cliente?.nombre || res.cliente_nombre || '—'} {res.cliente?.apellido || res.cliente_apellido || ''}
                    </p>
                    <p className="text-xs text-texto-secundario">
                      {res.servicio?.nombre || res.servicio_nombre || '—'} &middot; {res.empleado?.nombre || res.empleado_nombre || '—'} &middot; {res.ubicacion?.nombre || ubicacionNombre(res.ubicacion_id) || '—'}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-texto-secundario py-8 text-center">No hay reservas para hoy</p>
        )}
      </Card>

      {/* ---- ACTION BUTTONS ---- */}
      <Card>
        <h2 className="font-display text-lg font-bold text-texto-principal mb-4">Acciones administrativas</h2>
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
          <Button variant="primario" onClick={() => setActiveSheet('qr')}>Validar entrada</Button>
          <Button variant="exito" onClick={() => setActiveSheet('empleados')}>Empleados</Button>
          <Button variant="outline" onClick={() => setActiveSheet('servicios')}>Servicios</Button>
          <Button variant="outline" onClick={() => setActiveSheet('sedes')}>Sedes</Button>
          <Button variant="outline" onClick={() => setActiveSheet('horarios')}>Horarios</Button>
          <Button variant="outline" onClick={() => setActiveSheet('reportes')}>Reportes</Button>
          <Button variant="outline" onClick={() => setActiveSheet('clientes')}>Moderar clientes</Button>
          <Button variant="secundario" onClick={() => setActiveSheet('logs')}>Logs</Button>
        </div>
      </Card>
    </div>
  );
}
