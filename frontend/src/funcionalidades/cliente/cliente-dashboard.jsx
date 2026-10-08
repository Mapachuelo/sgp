import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Toast, Spinner } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';
import useWebSocket from '../../hooks/use-websocket.js';
import { descargarQrReserva } from '../../lib/descargas.js';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const COLUMNAS = [
  { key: 'pendiente', label: 'Pendiente', variant: 'warning' },
  { key: 'confirmada', label: 'Confirmada', variant: 'info' },
  { key: 'en_curso', label: 'En curso', variant: 'info' },
  { key: 'cobrado', label: 'Completada', variant: 'success' },
  { key: 'cancelada', label: 'Cancelada', variant: 'danger' },
];

const BORDE_ESTADO = {
  pendiente: 'border-l-4 border-l-texto-secundario',
  confirmada: 'border-l-4 border-l-info',
  en_curso: 'border-l-4 border-l-info',
  cobrado: 'border-l-4 border-l-exito',
  cancelada: 'border-l-4 border-l-error',
};

const iconoMarcador = new L.DivIcon({
  html: `<div style="display: flex; justify-content: center; align-items: center; width: 30px; height: 30px;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5E3C" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#E8D9CB"/>
      <circle cx="12" cy="10" r="3" fill="#8B5E3C"/>
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

function claveColumna(estado) {
  return estado === 'completada' ? 'cobrado' : estado;
}

function estadoAVariante(estado) {
  const mapa = {
    pendiente: 'warning',
    confirmada: 'info',
    en_curso: 'info',
    completada: 'success',
    cobrado: 'success',
    cancelada: 'danger',
  };
  return mapa[estado] || 'default';
}

function etiquetaEstado(estado) {
  if (!estado) return '';
  if (estado === 'cobrado') return 'Completada';
  if (estado === 'en_curso') return 'En curso';
  return estado.charAt(0).toUpperCase() + estado.slice(1);
}

function formatearFechaHora(iso) {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ClienteDashboard() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { ultimoEvento } = useWebSocket();
  const [reservas, setReservas] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const cargarReservas = async () => {
    try {
      setCargando(true);
      const data = await api.reservas.misReservas();
      const lista = data || [];
      setReservas(lista);
      setSeleccionada((actual) => {
        if (actual) {
          const refrescada = lista.find((r) => r.id === actual.id);
          if (refrescada) return refrescada;
        }
        return lista[0] || null;
      });
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ultimoEvento) return;
    if (ultimoEvento.tipo === 'reserva.actualizada') {
      cargarReservas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoEvento]);

  const cancelarReserva = async (id) => {
    if (!window.confirm('¿Seguro que deseas cancelar esta reserva?')) return;
    try {
      await api.reservas.cancelar(id);
      mostrarToast('Reserva cancelada con exito', 'success');
      cargarReservas();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  };

  const reservasActivas = reservas.filter((r) =>
    ['pendiente', 'confirmada', 'en_curso'].includes(r.estado)
  );

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  const porColumna = COLUMNAS.map((col) => ({
    ...col,
    items: reservas.filter((r) => claveColumna(r.estado) === col.key),
  }));

  const lat = seleccionada ? parseFloat(seleccionada.ubicacion_latitud) : null;
  const lng = seleccionada ? parseFloat(seleccionada.ubicacion_longitud) : null;
  const tieneMapa = Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-texto-principal mb-1">
          Hola{usuario?.nombre ? `, ${usuario.nombre}` : ''}
        </h1>
        <p className="text-texto-secundario text-lg mb-6">Gestiona tus reservas en el tablero</p>
        <div className="flex flex-wrap items-center gap-6">
          <div className="bg-fondo rounded-xl px-5 py-3 border border-borde">
            <span className="text-2xl font-bold text-primario">{reservasActivas.length}</span>
            <span className="text-texto-secundario text-sm ml-2">reservas activas</span>
          </div>
          <Button onClick={() => navigate('/cliente/reservar')}>Reservar ahora</Button>
        </div>
      </div>

      {reservas.length === 0 ? (
        <Card className="text-center py-12">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-texto-secundario/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-texto-secundario text-lg mb-4">No tienes reservas aun</p>
          <Button onClick={() => navigate('/cliente/reservar')}>Hacer mi primera reserva</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div
            className="flex gap-4 overflow-x-auto pb-4"
            role="list"
            aria-label="Tablero de reservas por estado"
          >
            {porColumna.map((col) => (
              <section
                key={col.key}
                className="min-w-[240px] w-64 shrink-0 bg-fondo/60 rounded-2xl border border-borde p-3"
                aria-label={`Reservas ${col.label}`}
              >
                <header className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-sm font-bold text-texto-principal">{col.label}</h2>
                  <span className="text-xs font-bold bg-superficie border border-borde rounded-full px-2 py-0.5 text-texto-secundario">
                    {col.items.length}
                  </span>
                </header>
                <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
                  {col.items.length === 0 ? (
                    <p className="text-xs text-texto-secundario text-center py-6">Sin reservas</p>
                  ) : (
                    col.items.map((reserva) => (
                      <article
                        key={reserva.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={seleccionada?.id === reserva.id}
                        onClick={() => setSeleccionada(reserva)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSeleccionada(reserva);
                          }
                        }}
                        className={`rounded-xl bg-superficie border border-borde p-3 shadow-sm cursor-pointer transition hover:shadow-md ${BORDE_ESTADO[claveColumna(reserva.estado)] || ''} ${
                          seleccionada?.id === reserva.id ? 'ring-2 ring-primario/40' : ''
                        }`}
                      >
                        <h3 className="text-sm font-semibold text-texto-principal mb-1">
                          {reserva.servicio_nombre || 'Sin servicio'}
                        </h3>
                        <p className="text-xs text-texto-secundario mb-1">
                          {formatearFechaHora(reserva.inicia_en)}
                        </p>
                        <p className="text-xs text-texto-secundario mb-2">
                          {reserva.ubicacion_nombre || 'Sede'}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={estadoAVariante(reserva.estado)}>
                            {etiquetaEstado(reserva.estado)}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {reserva.qr_data_url && (
                              <button
                                type="button"
                                aria-label={`Descargar QR de la reserva ${reserva.id}`}
                                title="Descargar QR"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  descargarQrReserva(reserva);
                                }}
                                className="p-1.5 rounded-lg text-primario hover:bg-primario/10 cursor-pointer"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                              </button>
                            )}
                            {(reserva.estado === 'pendiente' || reserva.estado === 'confirmada') && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelarReserva(reserva.id);
                                }}
                                className="text-[11px] text-error hover:underline cursor-pointer font-medium"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-20">
            {seleccionada ? (
              <Card padding={false} className="overflow-hidden">
                <div className="p-5 border-b border-borde">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h2 className="font-display text-lg font-bold text-texto-principal">Detalle</h2>
                    <Badge variant={estadoAVariante(seleccionada.estado)}>
                      {etiquetaEstado(seleccionada.estado)}
                    </Badge>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-secundario">Servicio</dt>
                      <dd className="font-semibold text-texto-principal text-right">
                        {seleccionada.servicio_nombre || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-secundario">Fecha</dt>
                      <dd className="font-semibold text-texto-principal text-right">
                        {formatearFechaHora(seleccionada.inicia_en)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-secundario">Estilista</dt>
                      <dd className="font-semibold text-texto-principal text-right">
                        {seleccionada.empleado_nombre} {seleccionada.empleado_apellido || ''}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-secundario">Personas</dt>
                      <dd className="font-semibold text-texto-principal text-right">
                        {seleccionada.cantidad_personas || 1}
                      </dd>
                    </div>
                    {seleccionada.motivo_cancelacion && (
                      <div className="bg-error/5 border border-error/20 rounded-lg p-3 text-xs text-error">
                        Motivo: {seleccionada.motivo_cancelacion}
                      </div>
                    )}
                  </dl>
                </div>

                <div className="p-5 border-b border-borde">
                  <p className="text-xs font-bold uppercase tracking-wider text-texto-secundario mb-2">
                    Ubicacion de la sede
                  </p>
                  <p className="text-xs text-texto-secundario mb-3">
                    {seleccionada.ubicacion_nombre}
                    {seleccionada.ubicacion_direccion ? ` — ${seleccionada.ubicacion_direccion}` : ''}
                  </p>
                  <div className="h-44 rounded-xl border border-borde overflow-hidden relative z-0 bg-fondo">
                    {tieneMapa ? (
                      <MapContainer
                        center={[lat, lng]}
                        zoom={15}
                        scrollWheelZoom={false}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[lat, lng]} icon={iconoMarcador} />
                        <MapRecenter lat={lat} lng={lng} />
                      </MapContainer>
                    ) : (
                      <p className="text-xs text-texto-secundario text-center pt-16">
                        La sede no tiene coordenadas configuradas.
                      </p>
                    )}
                  </div>
                </div>

                {seleccionada.qr_data_url && (
                  <div className="p-5 border-b border-borde text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-texto-secundario mb-3">
                      Codigo QR de acceso
                    </p>
                    <div className="inline-block border border-borde rounded-2xl bg-white p-3">
                      <img
                        src={seleccionada.qr_data_url}
                        alt={`Codigo QR de la reserva ${seleccionada.id}`}
                        className="w-36 h-36 mx-auto"
                      />
                    </div>
                    {seleccionada.qr_token && (
                      <span className="font-mono text-[10px] text-texto-secundario break-all block mt-2">
                        {seleccionada.qr_token}
                      </span>
                    )}
                    <Button
                      variant="secundario"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => descargarQrReserva(seleccionada)}
                    >
                      Descargar QR
                    </Button>
                  </div>
                )}

                {(seleccionada.estado === 'pendiente' || seleccionada.estado === 'confirmada') && (
                  <div className="p-5">
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={() => cancelarReserva(seleccionada.id)}
                    >
                      Cancelar reserva
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              <Card>
                <p className="text-sm text-texto-secundario text-center py-8">
                  Selecciona una reserva para ver su detalle, mapa y codigo QR.
                </p>
              </Card>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}