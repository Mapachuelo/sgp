import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  QrCode,
  RefreshCw,
  Scissors,
  Users,
} from 'lucide-react';
import { toast as notificar } from 'sonner';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  Sheet,
  Spinner,
  StatusPill,
  Tabs,
} from '../../componentes/ui/index.jsx';
import PagoReservaModal from '../../componentes/pagos/pago-reserva-modal.jsx';
import ImagenSede from '../../componentes/ubicaciones/imagen-sede.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';
import useWebSocket from '../../hooks/use-websocket.js';
import { descargarQrReserva } from '../../lib/descargas.js';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const iconoMarcador = new L.DivIcon({
  html: `<div style="display:flex;justify-content:center;align-items:center;width:30px;height:30px;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6C80" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#E6F1F3"/>
      <circle cx="12" cy="10" r="3" fill="#1B6C80"/>
    </svg>
  </div>`,
  className: 'custom-leaflet-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

const ETIQUETA_ESTADO = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  cobrado: 'Completada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

function estaPagada(reserva) {
  return reserva?.pago_estado === 'aprobado' || Boolean(reserva?.cobro_metodo);
}

function totalReserva(reserva) {
  if (!reserva) return 0;
  if (reserva.pago_monto != null) return Number(reserva.pago_monto);
  return Number(reserva.precio_total || reserva.precio_base || 0) * Number(reserva.cantidad_personas || 1);
}

function estadoPago(reserva) {
  if (!reserva) return { texto: '', tono: 'tenue', accion: null };
  if (reserva.estado === 'cancelada') return { texto: 'Cancelada', tono: 'tenue', accion: null };
  if (estaPagada(reserva)) {
    return {
      texto: reserva.cobro_metodo === 'fisico' ? 'Pagado en efectivo' : 'Pagado con Wompi',
      tono: 'exito',
      accion: null,
    };
  }
  if (reserva.pago_estado === 'pendiente') {
    return { texto: 'Pago en proceso', tono: 'advertencia', accion: 'reintentar' };
  }
  if (reserva.pago_estado === 'declinado' || reserva.pago_estado === 'error') {
    return { texto: 'Pago no completado', tono: 'error', accion: 'reintentar' };
  }
  return { texto: 'Pago pendiente', tono: 'advertencia', accion: 'pagar' };
}

const TONO_PAGO = {
  exito: { punto: 'bg-exito', texto: 'text-exito' },
  advertencia: { punto: 'bg-advertencia', texto: 'text-advertencia' },
  error: { punto: 'bg-error', texto: 'text-error' },
  tenue: { punto: 'bg-tenue', texto: 'text-tenue' },
};

function EstadoPago({ reserva }) {
  const estado = estadoPago(reserva);
  const tono = TONO_PAGO[estado.tono] || TONO_PAGO.tenue;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${tono.texto}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tono.punto}`} aria-hidden="true" />
      {estado.texto}
    </span>
  );
}

function localeActual() {
  return typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-US' : 'es-CO';
}

function personas(cantidad) {
  const n = cantidad || 1;
  if (localeActual() === 'en-US') return `${n} ${n === 1 ? 'person' : 'people'}`;
  return `${n} ${n === 1 ? 'persona' : 'personas'}`;
}

function fecha(iso) {
  if (!iso) return 'Sin fecha';
  return new Intl.DateTimeFormat(localeActual(), {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function hora(iso) {
  if (!iso) return '--:--';
  return new Intl.DateTimeFormat(localeActual(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function fechaLarga(iso) {
  if (!iso) return 'Sin fecha';
  return new Intl.DateTimeFormat(localeActual(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

function dinero(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');
}

function esFutura(reserva) {
  return new Date(reserva.inicia_en).getTime() >= Date.now() - 60 * 60 * 1000;
}

function DetalleReserva({ reserva, abierto, onClose, onPagar, onCancelar }) {
  if (!reserva) return null;
  const lat = Number.parseFloat(reserva.ubicacion_latitud);
  const lng = Number.parseFloat(reserva.ubicacion_longitud);
  const tieneMapa = Number.isFinite(lat) && Number.isFinite(lng);
  const pagada = estaPagada(reserva);
  const pago = estadoPago(reserva);
  const activa = ['pendiente', 'confirmada', 'en_curso'].includes(reserva.estado);
  const mapsUrl = tieneMapa
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
    : null;

  return (
    <Sheet open={abierto} onClose={onClose} title="Detalle de la cita" size="normal">
      <div className="space-y-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] text-tenue">{fechaLarga(reserva.inicia_en)}</p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-texto-principal">{hora(reserva.inicia_en)}</p>
            </div>
            <StatusPill estado={reserva.estado}>{ETIQUETA_ESTADO[reserva.estado] || reserva.estado}</StatusPill>
          </div>
          <p className="mt-3 text-base font-medium text-texto-principal">{reserva.servicio_nombre || 'Servicio'}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-texto-secundario">
            <Avatar nombre={reserva.empleado_nombre} apellido={reserva.empleado_apellido} fotoUrl={reserva.empleado_foto_url} size="sm" />
            <span>{reserva.equipo_nombre || `${reserva.empleado_nombre || ''} ${reserva.empleado_apellido || ''}`.trim()} · {personas(reserva.cantidad_personas)}</span>
          </p>
        </div>

        <div className="rounded-md border border-borde bg-panel/60 p-3">
          <p className="text-[11px] font-medium text-texto-secundario">Sede</p>
          <p className="mt-1 text-sm font-medium text-texto-principal">{reserva.ubicacion_nombre || 'Sede por confirmar'}</p>
          {reserva.ubicacion_direccion && <p className="mt-0.5 text-xs text-texto-secundario">{reserva.ubicacion_direccion}</p>}
          {(reserva.ubicacion_ciudad || reserva.ubicacion_departamento) && (
            <p className="mt-0.5 text-[11px] text-tenue">
              {[reserva.ubicacion_ciudad, reserva.ubicacion_departamento].filter(Boolean).join(' · ')}
            </p>
          )}
          {reserva.ubicacion_imagen_url && (
            <ImagenSede
              sede={{
                nombre: reserva.ubicacion_nombre,
                direccion: reserva.ubicacion_direccion,
                ciudad: reserva.ubicacion_ciudad,
                departamento: reserva.ubicacion_departamento,
                imagen_url: reserva.ubicacion_imagen_url,
              }}
              className="mt-3 h-36 w-full rounded-md"
            />
          )}
          {tieneMapa ? (
            <div className="relative z-0 mt-3 h-40 overflow-hidden rounded-md border border-borde">
              <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lng]} icon={iconoMarcador} />
                <MapRecenter lat={lat} lng={lng} />
              </MapContainer>
            </div>
          ) : (
            <p className="mt-2 text-xs text-tenue">La sede no tiene coordenadas configuradas.</p>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-acento underline-offset-2 hover:underline"
            >
              Abrir en el mapa <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] text-tenue">Personas</p>
            <p className="mt-0.5 font-medium text-texto-principal">{reserva.cantidad_personas || 1}</p>
          </div>
          <div>
            <p className="text-[11px] text-tenue">Total</p>
            <p className="num mt-0.5 font-medium text-texto-principal">
              {dinero(totalReserva(reserva))}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-tenue">Pago</p>
            <div className="mt-0.5"><EstadoPago reserva={reserva} /></div>
          </div>
          <div>
            <p className="text-[11px] text-tenue">Duración</p>
            <p className="mt-0.5 font-medium text-texto-principal">
              {reserva.duracion_minutos ? `${reserva.duracion_minutos} min` : 'Según servicio'}
            </p>
          </div>
        </div>

        {!pagada && pago.accion && activa && (
          <p className="rounded-md border border-advertencia/30 bg-advertencia/10 p-3 text-[11px] leading-5 text-advertencia">
            {pago.accion === 'reintentar'
              ? 'Tu último intento de pago no se completó. Puedes reintentarlo en línea o pagar en recepción el día de la cita.'
              : 'Aún no registras el pago. Puedes pagar en línea ahora o en efectivo en recepción.'}
          </p>
        )}

        {reserva.motivo_cancelacion && (
          <div className="rounded-md border border-error/30 bg-error/10 p-3 text-xs text-error">
            Motivo: {reserva.motivo_cancelacion}
          </div>
        )}

        {reserva.qr_data_url && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-[11px] font-medium text-texto-secundario">Código QR de acceso</p>
            <div className="rounded-md border border-borde bg-white p-3">
              <img src={reserva.qr_data_url} alt={`Código QR de la cita ${reserva.id}`} className="h-40 w-40" />
            </div>
            <Button variant="secundario" size="sm" className="w-full sm:w-auto" onClick={() => descargarQrReserva(reserva)}>
              <QrCode className="h-4 w-4" aria-hidden="true" /> Descargar QR
            </Button>
          </div>
        )}

        {activa && (
          <div className="flex flex-col gap-2 border-t border-borde pt-4 sm:flex-row">
            {!pagada && (
              <Button className="flex-1" onClick={() => onPagar(reserva)}>
                {pago.accion === 'reintentar' ? 'Reintentar pago' : 'Pagar ahora'}
              </Button>
            )}
            {['pendiente', 'confirmada'].includes(reserva.estado) && (
              <Button variant="dangerSuave" className="flex-1" onClick={() => onCancelar(reserva)}>
                Cancelar cita
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default function ClienteDashboard() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { ultimoEvento } = useWebSocket();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('proximas');
  const [detalle, setDetalle] = useState(null);
  const [qrReserva, setQrReserva] = useState(null);
  const [pagoReserva, setPagoReserva] = useState(null);
  const [cancelarReserva, setCancelarReserva] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  const cargarReservas = async () => {
    try {
      setCargando(true);
      const data = await api.reservas.misReservas();
      setReservas(Array.isArray(data) ? data : []);
    } catch (err) {
      notificar.error(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReservas();
  }, []);

  useEffect(() => {
    if (ultimoEvento?.tipo === 'reserva.actualizada') cargarReservas();
  }, [ultimoEvento]);

  const activas = useMemo(
    () =>
      reservas
        .filter((r) => ['pendiente', 'confirmada', 'en_curso'].includes(r.estado))
        .sort((a, b) => new Date(a.inicia_en) - new Date(b.inicia_en)),
    [reservas]
  );

  const proximas = useMemo(
    () => activas.filter((r) => esFutura(r) || r.estado === 'en_curso'),
    [activas]
  );

  const proxima = proximas[0] || null;

  const pendientesPago = useMemo(
    () =>
      activas
        .filter((reserva) => !estaPagada(reserva))
        .sort((a, b) => new Date(a.inicia_en) - new Date(b.inicia_en)),
    [activas]
  );

  const otrosPendientes = useMemo(
    () => pendientesPago.filter((reserva) => reserva.id !== proxima?.id),
    [pendientesPago, proxima]
  );

  const totalPendiente = useMemo(
    () => otrosPendientes.reduce((sum, reserva) => sum + totalReserva(reserva), 0),
    [otrosPendientes]
  );

  const historial = useMemo(
    () =>
      reservas
        .filter((r) => ['cobrado', 'completada', 'cancelada'].includes(r.estado))
        .sort((a, b) => new Date(b.inicia_en) - new Date(a.inicia_en)),
    [reservas]
  );

  const canceladas = useMemo(() => historial.filter((r) => r.estado === 'cancelada'), [historial]);

  const listaVisible = tab === 'proximas' ? proximas : tab === 'historial' ? historial : canceladas;

  const confirmarCancelacion = async () => {
    if (!cancelarReserva) return;
    setCancelando(true);
    try {
      await api.reservas.cancelar(cancelarReserva.id);
      notificar.success('Cita cancelada');
      setCancelarReserva(null);
      setDetalle(null);
      await cargarReservas();
    } catch (err) {
      notificar.error(err.message);
    } finally {
      setCancelando(false);
    }
  };

  if (cargando) {
    return (
      <div className="space-y-4">
        <Spinner label="Cargando tus citas" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Tu próxima cita"
        subtitle="Todo lo que necesitas para llegar, pagar y disfrutar tu servicio."
        actions={
          <>
            <Button variant="secundario" onClick={cargarReservas}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Actualizar
            </Button>
            <Button onClick={() => navigate('/cliente/reservar')}>Reservar cita</Button>
          </>
        }
      />

      {!proxima ? (
        <EmptyState
          title="No tienes citas próximas"
          description="Elige una sede, un servicio y un horario. En menos de un minuto tienes tu turno."
          action={<Button onClick={() => navigate('/cliente/reservar')}>Reservar mi primera cita</Button>}
        />
      ) : (
        <section className="grid overflow-hidden rounded-xl border border-borde bg-superficie lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill estado={proxima.estado}>{ETIQUETA_ESTADO[proxima.estado] || proxima.estado}</StatusPill>
              <EstadoPago reserva={proxima} />
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[13px] text-texto-secundario">{fechaLarga(proxima.inicia_en)}</p>
                <p className="num mt-1 text-[38px] font-semibold leading-none tracking-[-0.05em] text-texto-principal">
                  {hora(proxima.inicia_en)}
                </p>
                <p className="mt-3 text-lg font-medium text-texto-principal">{proxima.servicio_nombre || 'Servicio'}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-texto-secundario">
                  <Avatar nombre={proxima.empleado_nombre} apellido={proxima.empleado_apellido} fotoUrl={proxima.empleado_foto_url} size="sm" />
                  {proxima.equipo_nombre || `${proxima.empleado_nombre || ''} ${proxima.empleado_apellido || ''}`.trim()}
                </p>
              </div>
              <div className="min-w-[180px] rounded-lg border border-borde bg-panel/60 p-3">
                <p className="text-[11px] text-tenue">Sede</p>
                <p className="mt-0.5 text-sm font-medium text-texto-principal">{proxima.ubicacion_nombre || 'Por confirmar'}</p>
                {proxima.ubicacion_direccion && (
                  <p className="mt-0.5 text-xs leading-5 text-texto-secundario">{proxima.ubicacion_direccion}</p>
                )}
                <button
                  type="button"
                  onClick={() => setDetalle(proxima)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-acento underline-offset-2 hover:underline"
                >
                  Ver mapa y detalle <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-borde pt-4 text-xs text-texto-secundario">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {personas(proxima.cantidad_personas)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {proxima.duracion_minutos ? `${proxima.duracion_minutos} min` : 'Duración según servicio'}
              </span>
              <span className="num inline-flex items-center gap-1.5 font-medium text-texto-principal">
                {dinero(totalReserva(proxima))}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {!estaPagada(proxima) && (
                <Button onClick={() => setPagoReserva(proxima)}>
                  {estadoPago(proxima).accion === 'reintentar' ? 'Reintentar pago' : 'Pagar ahora'}
                </Button>
              )}
              <Button variant="secundario" onClick={() => setDetalle(proxima)}>
                <MapPin className="h-4 w-4" aria-hidden="true" /> Cómo llegar
              </Button>
              {proxima.qr_data_url && (
                <Button variant="secundario" className="lg:hidden" onClick={() => setQrReserva(proxima)}>
                  <QrCode className="h-4 w-4" aria-hidden="true" /> Ver QR
                </Button>
              )}
              {['pendiente', 'confirmada'].includes(proxima.estado) && (
                <Button variant="ghost" onClick={() => setCancelarReserva(proxima)}>
                  Cancelar cita
                </Button>
              )}
            </div>
          </div>

          <div className="hidden flex-col items-center justify-center border-t border-borde bg-panel/50 px-4 py-4 lg:flex lg:border-l lg:border-t-0 lg:p-5">
            {proxima.qr_data_url ? (
              <>
                <img
                  src={proxima.qr_data_url}
                  alt={`Código QR de la cita ${proxima.id}`}
                  className="h-28 w-28 bg-white lg:h-40 lg:w-40"
                />
                <p className="mt-1.5 text-center text-[10px] leading-4 text-texto-secundario lg:mt-2 lg:text-[11px]">
                  Muestra este código al llegar.
                </p>
                <Button variant="secundario" size="sm" className="mt-1.5 lg:mt-2" onClick={() => descargarQrReserva(proxima)}>
                  <QrCode className="h-4 w-4" aria-hidden="true" /> Descargar QR
                </Button>
              </>
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-md border border-dashed border-control text-center text-[11px] text-tenue lg:h-40 lg:w-40">
                QR disponible al confirmar
              </div>
            )}
          </div>
        </section>
      )}

      {otrosPendientes.length > 0 && (
        <section aria-labelledby="pagos-pendientes-titulo">
          <Card padding={false} className="overflow-hidden border-advertencia/30">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde bg-advertencia/5 px-4 py-3.5 sm:px-5">
              <div>
                <h2 id="pagos-pendientes-titulo" className="text-sm font-semibold text-texto-principal">
                  {proxima ? 'Otros pagos pendientes' : 'Pagos pendientes'}
                </h2>
                <p className="mt-0.5 text-xs text-texto-secundario">
                  {otrosPendientes.length} cita(s) por pagar · {dinero(totalPendiente)}
                </p>
              </div>
              <Badge variant="warning">{otrosPendientes.length}</Badge>
            </div>
            <ul className="divide-y divide-regla">
              {otrosPendientes.map((reserva) => {
                const pago = estadoPago(reserva);
                return (
                  <li key={reserva.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-texto-principal">{reserva.servicio_nombre || 'Servicio'}</p>
                      <p className="mt-0.5 text-xs text-texto-secundario">
                        {fecha(reserva.inicia_en)} · {hora(reserva.inicia_en)} · {reserva.ubicacion_nombre || 'Sede'}
                      </p>
                      <div className="mt-1"><EstadoPago reserva={reserva} /></div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="num text-sm font-semibold text-texto-principal">{dinero(totalReserva(reserva))}</span>
                      <Button size="sm" onClick={() => setPagoReserva(reserva)}>
                        {pago.accion === 'reintentar' ? 'Reintentar pago' : 'Pagar ahora'}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-borde px-4 py-2.5 text-[11px] leading-5 text-tenue sm:px-5">
              También puedes pagar en efectivo en recepción el día de tu cita.
            </p>
          </Card>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-texto-principal">Tus citas</h2>
            <p className="mt-0.5 text-xs text-texto-secundario">Próximas, historial y canceladas.</p>
          </div>
          <Button size="sm" variant="secundario" onClick={() => navigate('/cliente/reservar')}>
            <CalendarDays className="h-4 w-4" aria-hidden="true" /> Nueva cita
          </Button>
        </div>

        <Tabs
          items={[
            { value: 'proximas', label: 'Próximas', count: proximas.length },
            { value: 'historial', label: 'Historial', count: historial.length },
            { value: 'canceladas', label: 'Canceladas', count: canceladas.length },
          ]}
          value={tab}
          onChange={setTab}
          label="Filtrar citas"
          className="mb-4"
        />

        {listaVisible.length === 0 ? (
          <EmptyState
            title={tab === 'proximas' ? 'No tienes citas próximas' : 'No hay citas en esta vista'}
            description={tab === 'proximas' ? 'Reserva una cita para verla aquí.' : 'Cuando tengas citas en este estado aparecerán aquí.'}
            action={tab === 'proximas' ? <Button size="sm" onClick={() => navigate('/cliente/reservar')}>Reservar</Button> : null}
          />
        ) : (
          <Card padding={false} className="overflow-hidden">
            <ul className="divide-y divide-regla">
              {listaVisible.map((reserva) => {
                const pagada = estaPagada(reserva);
                const activa = ['pendiente', 'confirmada', 'en_curso'].includes(reserva.estado);
                const pago = estadoPago(reserva);
                return (
                  <li key={reserva.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <button
                      type="button"
                      onClick={() => setDetalle(reserva)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left transition-colors hover:opacity-85"
                    >
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[10px] font-medium text-tenue">{fecha(reserva.inicia_en).split(' ')[0].replace(',', '')}</p>
                        <p className="num text-lg font-semibold leading-tight text-texto-principal">{hora(reserva.inicia_en)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-texto-principal">{reserva.servicio_nombre || 'Servicio'}</p>
                        <p className="mt-0.5 truncate text-xs text-texto-secundario">
                          {reserva.ubicacion_nombre || 'Sede'} · {reserva.equipo_nombre || `${reserva.empleado_nombre || ''} ${reserva.empleado_apellido || ''}`.trim()}
                        </p>
                        <p className="mt-1 text-[11px] text-tenue">
                          {fecha(reserva.inicia_en)} · {personas(reserva.cantidad_personas)}
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill estado={reserva.estado}>{ETIQUETA_ESTADO[reserva.estado] || reserva.estado}</StatusPill>
                      <EstadoPago reserva={reserva} />
                      {!pagada && activa && (
                        <Button
                          size="sm"
                          variant="secundario"
                          aria-label={`Pagar ${reserva.servicio_nombre || 'la cita'}`}
                          onClick={() => setPagoReserva(reserva)}
                        >
                          {pago.accion === 'reintentar' ? 'Reintentar' : 'Pagar'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <DetalleReserva
        reserva={detalle}
        abierto={Boolean(detalle)}
        onClose={() => setDetalle(null)}
        onPagar={(reserva) => {
          setDetalle(null);
          setPagoReserva(reserva);
        }}
        onCancelar={(reserva) => {
          setDetalle(null);
          setCancelarReserva(reserva);
        }}
      />

      <Modal open={Boolean(qrReserva)} onClose={() => setQrReserva(null)} title="Código QR de acceso" size="sm">
        {qrReserva?.qr_data_url ? (
          <div className="text-center">
            <p className="text-xs text-texto-secundario">
              {fechaLarga(qrReserva.inicia_en)} · {hora(qrReserva.inicia_en)}
            </p>
            <div className="mx-auto mt-4 inline-block rounded-lg border border-borde bg-white p-4">
              <img src={qrReserva.qr_data_url} alt="Código QR de la cita" className="h-56 w-56" />
            </div>
            <p className="mt-3 text-xs leading-5 text-texto-secundario">Muestra este código al llegar al salón.</p>
            <Button className="mt-4 w-full" onClick={() => descargarQrReserva(qrReserva)}>
              <QrCode className="h-4 w-4" aria-hidden="true" /> Descargar QR
            </Button>
          </div>
        ) : (
          <p className="text-sm text-texto-secundario">El QR estará disponible cuando la cita esté confirmada.</p>
        )}
      </Modal>

      <PagoReservaModal
        open={Boolean(pagoReserva)}
        reservaId={pagoReserva?.id}
        modo="cliente"
        monto={pagoReserva ? totalReserva(pagoReserva) : null}
        resumen={pagoReserva ? `${pagoReserva.servicio_nombre || 'Servicio'} · ${fecha(pagoReserva.inicia_en)} ${hora(pagoReserva.inicia_en)}` : ''}
        onClose={() => {
          setPagoReserva(null);
          cargarReservas();
        }}
        onPagado={() => {
          cargarReservas();
          notificar.success('Pago confirmado. Tu cita quedó al día.');
        }}
        onToast={(mensaje, tipo) => {
          if (tipo === 'error') notificar.error(mensaje);
          else if (tipo === 'warning') notificar.warning(mensaje);
          else notificar.success(mensaje);
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelarReserva)}
        onClose={() => setCancelarReserva(null)}
        onConfirm={confirmarCancelacion}
        title="Cancelar cita"
        description={
          cancelarReserva
            ? `Se cancelará la cita de ${cancelarReserva.servicio_nombre || 'servicio'} del ${fecha(cancelarReserva.inicia_en)} a las ${hora(cancelarReserva.inicia_en)}. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Cancelar cita"
        danger
        cargando={cancelando}
      />
    </div>
  );
}
