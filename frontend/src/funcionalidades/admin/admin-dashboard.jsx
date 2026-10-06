import { useCallback, useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  BarChart3,
  CalendarCog,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  Percent,
  QrCode,
  RefreshCw,
  Scissors,
  ShieldAlert,
  TrendingUp,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, Spinner, Toast } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';
import ValidarQrModal from './secciones/validar-qr-modal.jsx';
import CobroModal from './secciones/cobro-modal.jsx';
import EmpleadosSeccion from './secciones/empleados-seccion.jsx';
import ServiciosSeccion from './secciones/servicios-seccion.jsx';
import SedesSeccion from './secciones/sedes-seccion.jsx';
import HorariosSeccion from './secciones/horarios-seccion.jsx';
import ReportesSeccion from './secciones/reportes-seccion.jsx';
import ClientesSeccion from './secciones/clientes-seccion.jsx';
import LogsSeccion from './secciones/logs-seccion.jsx';
import { estadoBadgeVariant, estadoLabel, formatearFechaLocal, horaBogotaDeIso, hoy, sumarDias } from './utils.js';

export default function AdminDashboard() {
  const { usuario } = useAuth();
  const [activeSheet, setActiveSheet] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [tokenQr, setTokenQr] = useState('');

  const [kpi, setKpi] = useState({ ventas: null, citas: 0, ocupacion: null, recurrentes: 0, loading: true });
  const [ubicaciones, setUbicaciones] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [reservasLoading, setReservasLoading] = useState(true);
  const [sedeFilter, setSedeFilter] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(hoy());

  const mostrarToast = useCallback((message, type = 'success') => {
    setToast({ open: true, message, type });
  }, []);

  useEffect(() => {
    if (!toast.open) return;
    const temporizador = setTimeout(() => setToast((prev) => ({ ...prev, open: false })), 3500);
    return () => clearTimeout(temporizador);
  }, [toast.open]);

  const cargarUbicaciones = useCallback(async () => {
    try {
      setUbicaciones((await api.ubicaciones.list()) || []);
    } catch {
      /* la timeline muestra el aviso */
    }
  }, []);

  const cargarKpi = useCallback(async () => {
    try {
      const [ventas, ocupacion, recurrentes] = await Promise.all([
        api.reportes.ventasDiarias(hoy()).catch(() => null),
        api.reportes.ocupacion(hoy()).catch(() => null),
        api.reportes.clientesRecurrentes().catch(() => null),
      ]);
      setKpi({
        ventas: ventas?.total ?? null,
        citas: Array.isArray(ocupacion) ? ocupacion.reduce((suma, fila) => suma + (Number(fila.total) || 0), 0) : 0,
        ocupacion:
          Array.isArray(ocupacion) && ocupacion.length > 0
            ? { porcentaje: ocupacion.reduce((suma, fila) => suma + (Number(fila.porcentaje) || 0), 0) / ocupacion.length }
            : null,
        recurrentes: Array.isArray(recurrentes) ? recurrentes.length : 0,
        loading: false,
      });
    } catch {
      setKpi((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const cargarReservas = useCallback(async () => {
    setReservasLoading(true);
    try {
      const params = { fecha: fechaFiltro };
      if (sedeFilter) params.ubicacion_id = sedeFilter;
      setReservas((await api.reservas.list(params)) || []);
    } catch (error) {
      mostrarToast(error.message, 'error');
    } finally {
      setReservasLoading(false);
    }
  }, [fechaFiltro, sedeFilter, mostrarToast]);

  useEffect(() => {
    cargarUbicaciones();
    cargarKpi();
  }, [cargarUbicaciones, cargarKpi]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  const recargar = useCallback(() => {
    cargarKpi();
    cargarReservas();
  }, [cargarKpi, cargarReservas]);

  const cerrarYRecargar = () => {
    setActiveSheet(null);
    recargar();
  };

  const abrirQr = (token = '') => {
    setTokenQr(token);
    setActiveSheet('qr');
  };

  const accesos = [
    { clave: 'qr', etiqueta: 'Validar QR', icono: QrCode, accion: () => abrirQr(''), rapido: true },
    { clave: 'cobro', etiqueta: 'Cobro', icono: BadgeDollarSign, accion: () => setActiveSheet('cobro'), rapido: true },
    { clave: 'empleados', etiqueta: 'Empleados', icono: Users, accion: () => setActiveSheet('empleados') },
    { clave: 'servicios', etiqueta: 'Servicios', icono: Scissors, accion: () => setActiveSheet('servicios') },
    { clave: 'sedes', etiqueta: 'Sedes', icono: MapPin, accion: () => setActiveSheet('sedes') },
    { clave: 'horarios', etiqueta: 'Horarios', icono: CalendarCog, accion: () => setActiveSheet('horarios') },
    { clave: 'reportes', etiqueta: 'Reportes', icono: BarChart3, accion: () => setActiveSheet('reportes') },
    { clave: 'clientes', etiqueta: 'Moderacion clientes', icono: ShieldAlert, accion: () => setActiveSheet('clientes') },
    { clave: 'logs', etiqueta: 'Logs', icono: FileText, accion: () => setActiveSheet('logs') },
  ];

  const kpis = [
    { etiqueta: 'Recaudacion hoy', valor: `$ ${Number(kpi.ventas ?? 0).toLocaleString('es-CO')}`, icono: TrendingUp, pista: 'cobros registrados hoy' },
    { etiqueta: 'Reservas del dia', valor: kpi.citas, icono: CalendarDays, pista: 'agendadas para hoy' },
    {
      etiqueta: 'Tasa de ocupacion',
      valor: kpi.ocupacion?.porcentaje != null ? `${Number(kpi.ocupacion.porcentaje).toFixed(1)}%` : '0%',
      icono: Percent,
      pista: 'promedio por sede',
      barra: kpi.ocupacion?.porcentaje || 0,
    },
    { etiqueta: 'Clientes activos', valor: kpi.recurrentes, icono: UserRoundCheck, pista: 'con reservas recurrentes' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      <Toast message={toast.message} type={toast.type} open={toast.open} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-texto-principal">Panel del administrador</h1>
          <p className="text-texto-secundario mt-1">
            Bienvenido{usuario?.nombre ? `, ${usuario.nombre}` : ''}. Gestiona el salon desde un solo lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primario" onClick={() => abrirQr('')}>
            <QrCode className="w-4 h-4 mr-2" aria-hidden="true" /> Validar QR
          </Button>
          <Button variant="secundario" onClick={() => setActiveSheet('cobro')}>
            <BadgeDollarSign className="w-4 h-4 mr-2" aria-hidden="true" /> Registrar cobro
          </Button>
          <Button variant="outline" onClick={recargar} aria-label="Actualizar datos">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Card padding={false} className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-texto-secundario shrink-0">Gestion</span>
          <div className="flex flex-wrap gap-2">
            {accesos.map(({ clave, etiqueta, icono: Icono, accion, rapido }) => (
              <button
                key={clave}
                type="button"
                onClick={accion}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  rapido
                    ? 'bg-primario text-white border-primario hover:bg-primario-hover'
                    : 'bg-fondo border-borde text-texto-principal hover:bg-superficie hover:border-primario/50'
                }`}
              >
                <Icono className="w-4 h-4" aria-hidden="true" /> {etiqueta}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ etiqueta, valor, icono: Icono, pista, barra }) => (
          <div key={etiqueta} className="bg-superficie border border-borde rounded-2xl p-5 shadow-premium">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-texto-secundario uppercase tracking-wider">{etiqueta}</p>
              <span className="w-8 h-8 rounded-lg bg-primario/10 text-primario flex items-center justify-center">
                <Icono className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            {kpi.loading ? (
              <div className="mt-3"><Spinner /></div>
            ) : (
              <>
                <p className="font-display text-3xl font-bold text-texto-principal mt-2">{valor}</p>
                {barra != null && (
                  <div className="w-full h-1.5 bg-fondo rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-primario transition-all duration-500" style={{ width: `${Math.min(100, barra)}%` }} />
                  </div>
                )}
              </>
            )}
            <span className="text-[10px] text-texto-secundario font-semibold">{pista}</span>
          </div>
        ))}
      </div>

      <Card padding={false}>
        <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-borde">
          <div>
            <h2 className="font-display text-xl font-bold text-texto-principal">
              Reservas {fechaFiltro === hoy() ? 'de hoy' : `del ${fechaFiltro}`}
            </h2>
            <p className="text-xs text-texto-secundario">Estado actual de todos los turnos del salon.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" aria-label="Dia anterior" onClick={() => setFechaFiltro(formatearFechaLocal(sumarDias(new Date(`${fechaFiltro}T00:00:00`), -1)))}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              aria-label="Fecha del timeline"
              className="text-xs px-2.5 py-1.5 border border-borde rounded-lg bg-superficie focus:outline-none"
            />
            <Button variant="outline" size="sm" aria-label="Dia siguiente" onClick={() => setFechaFiltro(formatearFechaLocal(sumarDias(new Date(`${fechaFiltro}T00:00:00`), 1)))}>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              aria-label="Filtrar por sede"
              className="text-xs px-2.5 py-1.5 border border-borde rounded-lg bg-superficie focus:outline-none"
            >
              <option value="">Todas las sedes</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={String(u.id)}>{u.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {reservasLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : reservas.length === 0 ? (
          <p className="text-sm text-texto-secundario py-10 text-center">
            No hay reservas para {fechaFiltro === hoy() ? 'hoy' : `el ${fechaFiltro}`}.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="sticky top-0 bg-superficie z-10">
                <tr className="text-left font-bold text-texto-secundario uppercase border-b border-borde">
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Servicio</th>
                  <th className="py-3 px-3">Estilista</th>
                  <th className="py-3 px-3">Sede</th>
                  <th className="py-3 px-3 text-center">Personas</th>
                  <th className="py-3 px-3 text-right">Monto</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map((reserva) => {
                  const cliente = `${reserva.cliente_nombre || ''} ${reserva.cliente_apellido || ''}`.trim() || '—';
                  const monto = parseFloat(reserva.monto ?? reserva.precio_base ?? 0);
                  return (
                    <tr key={reserva.id} className="border-b border-borde/40 hover:bg-fondo/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-texto-principal">{horaBogotaDeIso(reserva.inicia_en)}</td>
                      <td className="py-3 px-3 font-semibold text-texto-principal">{cliente}</td>
                      <td className="py-3 px-3 text-texto-secundario">{reserva.servicio_nombre || '—'}</td>
                      <td className="py-3 px-3 text-texto-secundario">
                        {reserva.empleado_nombre} {reserva.empleado_apellido || ''}
                      </td>
                      <td className="py-3 px-3 text-texto-secundario">{reserva.ubicacion_nombre || `Sede #${reserva.ubicacion_id}`}</td>
                      <td className="py-3 px-3 text-center text-texto-secundario">{reserva.cantidad_personas || 1}</td>
                      <td className="py-3 px-3 text-right font-bold text-exito">${monto.toLocaleString('es-CO')}</td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant={estadoBadgeVariant(reserva.estado)}>{estadoLabel(reserva.estado)}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {['pendiente', 'confirmada'].includes(reserva.estado) && (
                          <button
                            type="button"
                            onClick={() => abrirQr(reserva.qr_token || '')}
                            className="px-2.5 py-1 bg-primario hover:bg-primario-hover text-white rounded-lg text-[10px] font-bold transition shadow-sm cursor-pointer"
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
        )}
      </Card>

      <ValidarQrModal
        open={activeSheet === 'qr'}
        tokenInicial={tokenQr}
        onClose={cerrarYRecargar}
        onToast={mostrarToast}
        onActualizar={recargar}
      />
      <CobroModal
        open={activeSheet === 'cobro'}
        onClose={cerrarYRecargar}
        onToast={mostrarToast}
        onActualizar={recargar}
      />
      <EmpleadosSeccion open={activeSheet === 'empleados'} onClose={cerrarYRecargar} onToast={mostrarToast} />
      <ServiciosSeccion open={activeSheet === 'servicios'} onClose={cerrarYRecargar} onToast={mostrarToast} />
      <SedesSeccion open={activeSheet === 'sedes'} onClose={cerrarYRecargar} onToast={mostrarToast} />
      <HorariosSeccion
        open={activeSheet === 'horarios'}
        onClose={cerrarYRecargar}
        onToast={mostrarToast}
        onValidarCita={(cita) => abrirQr(cita.qr_token || '')}
      />
      <ReportesSeccion open={activeSheet === 'reportes'} onClose={cerrarYRecargar} onToast={mostrarToast} />
      <ClientesSeccion open={activeSheet === 'clientes'} onClose={cerrarYRecargar} onToast={mostrarToast} />
      <LogsSeccion open={activeSheet === 'logs'} onClose={cerrarYRecargar} onToast={mostrarToast} />
    </div>
  );
}
