import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  MapPin,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { toast as notificar } from 'sonner';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  KpiStrip,
  PageHeader,
  Spinner,
  StatusPill,
} from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import ValidarQrModal from './secciones/validar-qr-modal.jsx';
import CobroModal from './secciones/cobro-modal.jsx';
import EmpleadosSeccion from './secciones/empleados-seccion.jsx';
import ServiciosSeccion from './secciones/servicios-seccion.jsx';
import SedesSeccion from './secciones/sedes-seccion.jsx';
import HorariosSeccion from './secciones/horarios-seccion.jsx';
import ReportesSeccion from './secciones/reportes-seccion.jsx';
import ClientesSeccion from './secciones/clientes-seccion.jsx';
import LogsSeccion from './secciones/logs-seccion.jsx';
import { estadoLabel, formatearFechaLocal, horaBogotaDeIso, hoy, sumarDias } from './utils.js';

const INICIO_DIA = 8 * 60;
const FIN_DIA = 20 * 60;

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

function minutosDeIso(iso) {
  if (!iso) return null;
  const [h, m] = horaBogotaDeIso(iso).split(':').map(Number);
  return h * 60 + m;
}

function minutosAhoraBogota() {
  const texto = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [h, m] = texto.split(':').map(Number);
  return h * 60 + m;
}

function estaPagada(reserva) {
  return reserva?.pago_estado === 'aprobado' || Boolean(reserva?.cobro_metodo);
}

function claseBarra(estado) {
  if (estado === 'pendiente') return 'barra-pendiente';
  if (estado === 'confirmada') return 'barra-confirmada';
  if (estado === 'en_curso') return 'barra-en-curso';
  if (estado === 'cobrado' || estado === 'completada') return 'barra-completada';
  if (estado === 'cancelada') return 'barra-cancelada';
  return 'border-borde bg-panel text-texto-secundario';
}

function RielDia({ reservas, fecha }) {
  const porSede = useMemo(() => {
    const mapa = new Map();
    reservas.forEach((r) => {
      const sede = r.ubicacion_nombre || 'Sin sede';
      if (!mapa.has(sede)) mapa.set(sede, []);
      mapa.get(sede).push(r);
    });
    return [...mapa.entries()];
  }, [reservas]);

  const esHoy = fecha === hoy();
  const ahora = minutosAhoraBogota();
  const ahoraVisible = esHoy && ahora >= INICIO_DIA && ahora <= FIN_DIA;

  if (reservas.length === 0) {
    return (
      <EmptyState
        title="No hay citas para este día"
        description="Cambia la fecha o revisa la agenda de otra sede."
      />
    );
  }

  const horas = [8, 10, 12, 14, 16, 18, 20];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div />
        <div className="relative h-5">
          {horas.map((h) => (
            <span
              key={h}
              className="num absolute top-0 -translate-x-1/2 text-[10px] text-tenue"
              style={{ left: `${((h * 60 - INICIO_DIA) / (FIN_DIA - INICIO_DIA)) * 100}%` }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
      </div>

      {porSede.map(([sede, citas]) => (
        <div key={sede} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-texto-principal">{sede}</p>
            <p className="text-[10px] text-tenue">{citas.length} {citas.length === 1 ? 'cita' : 'citas'}</p>
          </div>
          <div className="relative h-11 overflow-hidden rounded-md border border-regla bg-panel/50">
            {horas.slice(1, -1).map((h) => (
              <span
                key={`linea-${h}`}
                className="absolute top-0 bottom-0 w-px bg-regla"
                style={{ left: `${((h * 60 - INICIO_DIA) / (FIN_DIA - INICIO_DIA)) * 100}%` }}
                aria-hidden="true"
              />
            ))}
            {citas.map((cita) => {
              const inicio = minutosDeIso(cita.inicia_en);
              const fin = minutosDeIso(cita.termina_en) || (inicio != null ? inicio + 30 : null);
              if (inicio == null || fin == null) return null;
              const desde = Math.max(INICIO_DIA, inicio);
              const hasta = Math.min(FIN_DIA, fin);
              if (hasta <= INICIO_DIA || desde >= FIN_DIA) return null;
              const izquierda = ((desde - INICIO_DIA) / (FIN_DIA - INICIO_DIA)) * 100;
              const ancho = Math.max(1.5, ((hasta - desde) / (FIN_DIA - INICIO_DIA)) * 100);
              return (
                <div
                  key={cita.id}
                  title={`${horaBogotaDeIso(cita.inicia_en)} · ${cita.cliente_nombre || 'Cliente'} · ${cita.servicio_nombre || 'Servicio'}`}
                  className={`absolute top-1 bottom-1 z-10 overflow-hidden rounded border px-1.5 py-0.5 text-[10px] ${claseBarra(cita.estado)}`}
                  style={{ left: `${izquierda}%`, width: `${ancho}%` }}
                >
                  <span className="block truncate">{ancho > 12 ? cita.cliente_nombre || 'Cita' : ''}</span>
                </div>
              );
            })}
            {ahoraVisible && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-acento"
                style={{ left: `${((ahora - INICIO_DIA) / (FIN_DIA - INICIO_DIA)) * 100}%` }}
                aria-hidden="true"
              >
                <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-acento" />
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-[122px] text-[10px] text-texto-secundario sm:pl-[162px]">
        {[
          ['pendiente', 'Pendiente'],
          ['confirmada', 'Confirmada'],
          ['en_curso', 'En servicio'],
          ['cobrado', 'Completada'],
        ].map(([estado, etiqueta]) => (
          <span key={estado} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm border ${claseBarra(estado)}`} aria-hidden="true" />
            {etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard({ seccionInicial = null }) {
  const navigate = useNavigate();
  const [activeSheet, setActiveSheet] = useState(seccionInicial);
  const [tokenQr, setTokenQr] = useState('');
  const [kpi, setKpi] = useState({ ventas: null, citas: 0, ocupacion: null, recurrentes: 0, loading: true });
  const [ubicaciones, setUbicaciones] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [reservasLoading, setReservasLoading] = useState(true);
  const [sedeFilter, setSedeFilter] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(hoy());

  useEffect(() => {
    setActiveSheet(seccionInicial);
  }, [seccionInicial]);

  const mostrarToast = useCallback((message, type = 'success') => {
    if (type === 'error') notificar.error(message);
    else if (type === 'warning') notificar.warning(message);
    else notificar.success(message);
  }, []);

  const cargarUbicaciones = useCallback(async () => {
    try {
      setUbicaciones((await api.ubicaciones.list()) || []);
    } catch {
      setUbicaciones([]);
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

  const cerrarSeccion = () => {
    setActiveSheet(null);
    setTokenQr('');
    recargar();
    if (seccionInicial) navigate('/admin');
  };

  const abrirQr = (token = '') => {
    setTokenQr(token);
    setActiveSheet('qr');
  };

  const abrirCobro = (token = '') => {
    setTokenQr(token);
    setActiveSheet('cobro');
  };

  const sinPago = reservas.filter(
    (r) => !estaPagada(r) && ['pendiente', 'confirmada'].includes(r.estado)
  );
  const enEspera = reservas.filter(
    (r) => r.llego_en && !['en_curso', 'cobrado', 'completada', 'cancelada'].includes(r.estado)
  );
  const enCurso = reservas.filter((r) => r.estado === 'en_curso');
  const pagadas = reservas.filter(estaPagada);

  const atencion = useMemo(() => {
    const items = [];
    const vistos = new Set();
    sinPago.forEach((r) => {
      if (vistos.has(r.id)) return;
      vistos.add(r.id);
      items.push({ tipo: 'pago', reserva: r, etiqueta: 'Sin pago', accion: 'Cobrar' });
    });
    enEspera.forEach((r) => {
      if (vistos.has(r.id)) return;
      vistos.add(r.id);
      items.push({ tipo: 'espera', reserva: r, etiqueta: 'En espera', accion: 'Validar QR' });
    });
    reservas
      .filter((r) => ['declinado', 'error'].includes(r.pago_estado))
      .forEach((r) => {
        if (vistos.has(r.id)) return;
        vistos.add(r.id);
        items.push({ tipo: 'rechazo', reserva: r, etiqueta: 'Pago rechazado', accion: 'Reintentar' });
      });
    return items.slice(0, 5);
  }, [sinPago, enEspera, reservas]);

  const resumenSedes = useMemo(() => {
    const mapa = new Map();
    reservas.forEach((r) => {
      const sede = r.ubicacion_nombre || 'Sin sede';
      mapa.set(sede, (mapa.get(sede) || 0) + 1);
    });
    const filas = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...filas.map(([, n]) => n));
    return filas.map(([sede, total]) => ({ sede, total, porcentaje: Math.round((total / max) * 100) }));
  }, [reservas]);

  const fechaLabel = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${fechaFiltro}T00:00:00`));

  const kpis = [
    {
      label: 'Ingresos de hoy',
      value: kpi.loading ? '—' : dinero(kpi.ventas ?? 0),
      caption: 'cobros registrados hoy',
    },
    {
      label: 'Citas del día',
      value: kpi.loading ? '—' : String(kpi.citas || reservas.length),
      caption: `${enCurso.length} en servicio · ${enEspera.length} en espera`,
    },
    {
      label: 'Ocupación',
      value: kpi.loading ? '—' : `${Number(kpi.ocupacion?.porcentaje || 0).toFixed(1)}%`,
      caption: 'promedio por sede',
    },
    {
      label: 'Sin pago',
      value: String(sinPago.length),
      caption: sinPago.length === 0 ? 'todo cobrado' : 'requieren cobro',
    },
  ];

  const renderAtencion = () => (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-texto-principal">Requiere atención</h2>
          <p className="mt-0.5 text-[11px] text-tenue">Lo que necesita una acción ahora.</p>
        </div>
        {atencion.length > 0 && <Badge variant="warning">{atencion.length}</Badge>}
      </div>
      {atencion.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-control bg-panel/50 px-3 py-4 text-xs text-texto-secundario">
          Nada pendiente. El día está bajo control.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-regla">
          {atencion.map((item) => (
            <li key={`${item.tipo}-${item.reserva.id}`} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.tipo === 'pago' ? 'bg-advertencia' : item.tipo === 'espera' ? 'bg-acento' : 'bg-error'}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-texto-principal">
                  {item.reserva.cliente_nombre || 'Cliente'} {item.reserva.cliente_apellido || ''}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-texto-secundario">
                  {item.etiqueta} · {horaBogotaDeIso(item.reserva.inicia_en)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => (item.tipo === 'pago' ? abrirCobro(item.reserva.qr_token) : abrirQr(item.reserva.qr_token))}
              >
                {item.accion}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const columnas = [
    {
      key: 'hora',
      label: 'Hora',
      width: '72px',
      render: (r) => <span className="num font-medium text-texto-principal">{horaBogotaDeIso(r.inicia_en)}</span>,
    },
    {
      key: 'cliente',
      label: 'Cliente',
      width: '22%',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-texto-principal">
            {r.cliente_nombre || 'Cliente'} {r.cliente_apellido || ''}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-tenue md:hidden">{r.servicio_nombre || 'Servicio'}</p>
        </div>
      ),
    },
    {
      key: 'servicio',
      label: 'Servicio',
      width: '20%',
      className: 'hidden md:table-cell',
      render: (r) => <span className="text-texto-secundario">{r.servicio_nombre || '—'}</span>,
    },
    {
      key: 'estilista',
      label: 'Estilista',
      width: '18%',
      className: 'hidden lg:table-cell',
      render: (r) => (
        <span className="text-texto-secundario">
          {r.equipo_nombre || `${r.empleado_nombre || ''} ${r.empleado_apellido || ''}`.trim() || '—'}
        </span>
      ),
    },
    {
      key: 'monto',
      label: 'Monto',
      align: 'right',
      width: '14%',
      render: (r) => {
        const monto = Number(r.monto ?? r.precio_total ?? r.precio_base ?? 0) * (r.monto != null ? 1 : Number(r.cantidad_personas || 1));
        return <span className="num font-medium text-texto-principal">{dinero(monto)}</span>;
      },
    },
    {
      key: 'estado',
      label: 'Estado',
      width: '16%',
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill estado={r.estado}>{estadoLabel(r.estado)}</StatusPill>
          <span className={`text-[10px] font-medium ${estaPagada(r) ? 'text-exito' : 'text-advertencia'}`}>
            {estaPagada(r) ? 'Pagado' : 'Sin pago'}
          </span>
        </div>
      ),
    },
    {
      key: 'accion',
      label: '',
      align: 'right',
      render: (r) =>
        ['pendiente', 'confirmada'].includes(r.estado) ? (
          <Button variant="ghost" size="sm" onClick={() => abrirQr(r.qr_token || '')}>
            Validar
          </Button>
        ) : (
          <span className="text-[11px] text-tenue">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hoy"
        subtitle={`${fechaLabel} · ${reservas.length} citas · ${atencion.length} ${atencion.length === 1 ? 'requiere' : 'requieren'} atención`}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-borde bg-superficie p-0.5">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Día anterior"
                onClick={() => setFechaFiltro(formatearFechaLocal(sumarDias(new Date(`${fechaFiltro}T00:00:00`), -1)))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                aria-label="Fecha de la agenda"
                className="h-8 rounded border-0 bg-transparent px-1 text-xs text-texto-principal focus:outline-none"
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Día siguiente"
                onClick={() => setFechaFiltro(formatearFechaLocal(sumarDias(new Date(`${fechaFiltro}T00:00:00`), 1)))}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <Button variant="secundario" size="sm" onClick={recargar} aria-label="Actualizar datos">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button size="sm" onClick={() => abrirQr('')}>
              <QrCode className="h-4 w-4" aria-hidden="true" /> Validar QR
            </Button>
            <Button variant="secundario" size="sm" onClick={() => abrirCobro('')}>
              <BadgeDollarSign className="h-4 w-4" aria-hidden="true" /> Cobro
            </Button>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-texto-principal">El día en el salón</h2>
                <p className="mt-0.5 text-xs text-texto-secundario">
                  {sedeFilter ? `Filtrando por ${ubicaciones.find((u) => String(u.id) === sedeFilter)?.nombre || 'sede'}` : 'Todas las sedes'}
                </p>
              </div>
              <select
                value={sedeFilter}
                onChange={(e) => setSedeFilter(e.target.value)}
                aria-label="Filtrar por sede"
                className="h-8 rounded-md border border-control bg-superficie px-2 text-xs text-texto-principal focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
              >
                <option value="">Todas las sedes</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={String(u.id)}>{u.nombre}</option>
                ))}
              </select>
            </div>
            {reservasLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : (
              <div className="hidden lg:block">
                <RielDia reservas={reservas} fecha={fechaFiltro} />
              </div>
            )}
            {!reservasLoading && (
              <div className="lg:hidden">
                {reservas.length === 0 ? (
                  <EmptyState title="Sin citas" description="No hay reservas para esta fecha." />
                ) : (
                  <div className="space-y-2">
                    {reservas.slice(0, 8).map((r) => (
                      <div key={r.id} className="flex items-center gap-3 rounded-md border border-borde px-3 py-2.5">
                        <span className="num w-12 text-xs font-medium text-texto-principal">{horaBogotaDeIso(r.inicia_en)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-texto-principal">
                            {r.cliente_nombre || 'Cliente'} {r.cliente_apellido || ''}
                          </p>
                          <p className="truncate text-[11px] text-tenue">{r.servicio_nombre || 'Servicio'} · {r.ubicacion_nombre || 'Sede'}</p>
                        </div>
                        <StatusPill estado={r.estado}>{estadoLabel(r.estado)}</StatusPill>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="xl:hidden">{renderAtencion()}</div>

          <Card padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde p-4">
              <div>
                <h2 className="text-base font-semibold text-texto-principal">Agenda de hoy</h2>
                <p className="mt-0.5 text-xs text-texto-secundario">Los primeros turnos; el resto está en la agenda completa.</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="default">{reservas.length} citas</Badge>
                <Link to="/admin/agenda" className="text-[11px] font-medium text-acento underline-offset-2 hover:underline">Ver agenda completa</Link>
              </div>
            </div>
            {reservasLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : reservas.length === 0 ? (
              <EmptyState className="m-4" title="No hay reservas" description="No hay citas para la fecha seleccionada." />
            ) : (
              <>
                <div className="hidden md:block">
                  <DataTable
                    columns={columnas}
                    rows={reservas.slice(0, 6)}
                    getKey={(r) => r.id}
                    className="px-2"
                  />
                </div>
                <div className="divide-y divide-regla md:hidden">
                  {reservas.slice(0, 6).map((r) => (
                    <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="num w-11 shrink-0 text-xs font-medium text-texto-principal">{horaBogotaDeIso(r.inicia_en)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-texto-principal">
                          {r.cliente_nombre || 'Cliente'} {r.cliente_apellido || ''}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-tenue">{r.servicio_nombre || 'Servicio'}</p>
                        <p className="mt-1 text-[11px] text-texto-secundario">
                          {r.ubicacion_nombre || 'Sede'} · {estaPagada(r) ? 'Pagado' : 'Sin pago'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusPill estado={r.estado}>{estadoLabel(r.estado)}</StatusPill>
                        {['pendiente', 'confirmada'].includes(r.estado) && (
                          <Button variant="ghost" size="xs" onClick={() => abrirQr(r.qr_token || '')}>
                            Validar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <div className="hidden xl:block">{renderAtencion()}</div>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-texto-principal">Resumen por sede</h2>
              <MapPin className="h-4 w-4 text-tenue" strokeWidth={1.7} aria-hidden="true" />
            </div>
            {resumenSedes.length === 0 ? (
              <p className="mt-3 text-xs text-texto-secundario">Sin citas para mostrar.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {resumenSedes.map((fila) => (
                  <div key={fila.sede}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-texto-principal">{fila.sede}</span>
                      <span className="num text-texto-secundario">{fila.total}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel">
                      <div className="h-full rounded-full bg-acento" style={{ width: `${fila.porcentaje}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-texto-principal">Pagos del día</h2>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-texto-secundario">Cobrados</span>
                <span className="num font-medium text-texto-principal">{pagadas.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-texto-secundario">Sin pago</span>
                <span className="num font-medium text-texto-principal">{sinPago.length}</span>
              </div>
              <div className="flex items-center justify-between border-t border-borde pt-2.5">
                <span className="text-texto-secundario">En servicio</span>
                <span className="num font-medium text-texto-principal">{enCurso.length}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <ValidarQrModal
        open={activeSheet === 'qr'}
        tokenInicial={tokenQr}
        onClose={cerrarSeccion}
        onToast={mostrarToast}
        onActualizar={recargar}
      />
      <CobroModal
        open={activeSheet === 'cobro'}
        onClose={cerrarSeccion}
        onToast={mostrarToast}
        onActualizar={recargar}
      />
      <EmpleadosSeccion open={activeSheet === 'empleados'} onClose={cerrarSeccion} onToast={mostrarToast} />
      <ServiciosSeccion open={activeSheet === 'servicios'} onClose={cerrarSeccion} onToast={mostrarToast} />
      <SedesSeccion open={activeSheet === 'sedes'} onClose={cerrarSeccion} onToast={mostrarToast} />
      <HorariosSeccion
        open={activeSheet === 'horarios'}
        onClose={cerrarSeccion}
        onToast={mostrarToast}
        onValidarCita={(cita) => abrirQr(cita.qr_token || '')}
      />
      <ReportesSeccion open={activeSheet === 'reportes'} onClose={cerrarSeccion} onToast={mostrarToast} />
      <ClientesSeccion open={activeSheet === 'clientes'} onClose={cerrarSeccion} onToast={mostrarToast} />
      <LogsSeccion open={activeSheet === 'logs'} onClose={cerrarSeccion} onToast={mostrarToast} />
    </div>
  );
}
