import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock, ImageOff, MapPin, Search, Users, X } from 'lucide-react';
import {
  Badge,
  BuscadorSelect,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Toast,
} from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import useWebSocket from '../../hooks/use-websocket.js';
import { descargarQrReserva } from '../../lib/descargas.js';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const customMarkerIcon = new L.DivIcon({
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

const PASOS = [
  { num: 1, label: 'Sede' },
  { num: 2, label: 'Servicios' },
  { num: 3, label: 'Equipo' },
  { num: 4, label: 'Horario' },
  { num: 5, label: 'Confirmar' },
  { num: 6, label: 'Pago' },
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function dinero(valor) {
  return `$${Number(valor || 0).toLocaleString('es-CO')}`;
}

function formatearFechaLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function obtenerIniciales(nombre) {
  if (!nombre) return '??';
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

function fechaBonita(valor) {
  if (!valor) return '';
  const [anio, mes, dia] = valor.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(anio, mes - 1, dia));
}

function horaDeIso(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

function horasDelRango(preferencias, granularidad) {
  const desde = preferencias?.rango_hora_desde?.slice(0, 5) || '09:00';
  const hasta = preferencias?.rango_hora_hasta?.slice(0, 5) || '18:00';
  const [hI, mI] = desde.split(':').map(Number);
  const [hF, mF] = hasta.split(':').map(Number);
  let actual = hI * 60 + mI;
  const fin = hF * 60 + mF;
  const horas = [];
  while (actual < fin) {
    horas.push(`${String(Math.floor(actual / 60)).padStart(2, '0')}:${String(actual % 60).padStart(2, '0')}`);
    actual += granularidad;
  }
  return horas;
}

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

function AjustarMapa({ puntos }) {
  const map = useMap();
  const clave = puntos.map((p) => p.join(',')).join(';');
  useEffect(() => {
    const validos = puntos.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (validos.length > 1) {
      map.fitBounds(L.latLngBounds(validos), { padding: [28, 28], maxZoom: 14 });
    } else if (validos.length === 1) {
      map.setView(validos[0], 14);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map]);
  return null;
}

function ImagenServicio({ src, nombre }) {
  if (!src) {
    return (
      <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-borde bg-panel text-tenue sm:h-32 sm:w-full">
        <ImageOff className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={`Imagen de ${nombre}`}
      loading="lazy"
      className="h-24 w-24 shrink-0 rounded-md border border-borde object-cover sm:h-32 sm:w-full"
    />
  );
}

const iconoMarcadorActual = new L.DivIcon({
  html: `<div style="display:flex;justify-content:center;align-items:center;width:30px;height:30px;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5e625f" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#e8e8e3"/>
      <circle cx="12" cy="10" r="3" fill="#5e625f"/>
    </svg>
  </div>`,
  className: 'custom-leaflet-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function InvalidarMapa() {
  const map = useMap();
  useEffect(() => {
    const temporizador = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(temporizador);
  }, [map]);
  return null;
}

function ModalDetalleServicio({ servicio, abierto, onClose, seleccionado, puedeAgregar, onToggle }) {
  const [imagenes, setImagenes] = useState([]);
  const [indice, setIndice] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto || !servicio?.id) return undefined;
    let activo = true;
    setIndice(0);
    setError('');
    setImagenes(servicio.imagen_url ? [servicio.imagen_url] : []);
    setCargando(true);
    api.reservas
      .imagenesServicio(servicio.id)
      .then((data) => {
        if (!activo) return;
        const urls = (Array.isArray(data) ? data : [])
          .sort((a, b) => Number(a.orden) - Number(b.orden))
          .map((imagen) => imagen.imagen_url)
          .filter(Boolean);
        if (urls.length > 0) setImagenes(urls);
      })
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, [abierto, servicio?.id, servicio?.imagen_url]);

  const total = imagenes.length;
  const irA = (delta) => {
    if (total <= 1) return;
    setIndice((actual) => (actual + delta + total) % total);
  };

  return (
    <Modal open={abierto && Boolean(servicio)} onClose={onClose} title={servicio?.nombre || 'Detalle del servicio'} size="wide">
      {servicio && (
        <div className="space-y-4">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <div
                className="relative overflow-hidden rounded-lg border border-borde bg-panel"
                tabIndex={0}
                onKeyDown={(evento) => {
                  if (evento.key === 'ArrowLeft') { evento.preventDefault(); irA(-1); }
                  if (evento.key === 'ArrowRight') { evento.preventDefault(); irA(1); }
                }}
                aria-label={total > 1 ? `Galería de ${servicio.nombre}. Usa las flechas para cambiar de imagen.` : `Imagen de ${servicio.nombre}`}
              >
                {cargando && total === 0 ? (
                  <div className="flex aspect-[4/3] items-center justify-center"><Spinner /></div>
                ) : total === 0 ? (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-tenue">
                    <ImageOff className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                    <span className="text-[11px]">Sin imágenes</span>
                  </div>
                ) : (
                  <img
                    src={imagenes[indice]}
                    alt={`${servicio.nombre}, imagen ${indice + 1} de ${total}`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                )}
                {total > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => irA(-1)}
                      aria-label="Imagen anterior"
                      className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-borde bg-superficie text-texto-principal hover:bg-panel"
                    >
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => irA(1)}
                      aria-label="Imagen siguiente"
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-borde bg-superficie text-texto-principal hover:bg-panel"
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="num absolute bottom-2 right-2 rounded border border-borde bg-superficie px-1.5 py-0.5 text-[10px] font-medium text-texto-secundario" aria-live="polite">
                      {indice + 1} / {total}
                    </span>
                  </>
                )}
              </div>

              {total > 1 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scroll-thin" aria-label="Miniaturas de imágenes">
                  {imagenes.map((imagen, posicion) => (
                    <button
                      key={`${posicion}-${imagen.slice(-16)}`}
                      type="button"
                      onClick={() => setIndice(posicion)}
                      aria-label={`Ver imagen ${posicion + 1}`}
                      aria-current={posicion === indice ? 'true' : undefined}
                      className={`h-12 w-12 shrink-0 overflow-hidden rounded border ${
                        posicion === indice ? 'border-acento ring-1 ring-acento/20' : 'border-borde opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={imagen} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              {error && <p className="mt-2 text-[11px] text-error">No se pudieron cargar todas las imágenes.</p>}
            </div>

            <div className="min-w-0">
              <Badge variant="accent">{servicio.categoria_nombre || 'Servicio'}</Badge>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-texto-principal">{servicio.nombre}</h3>
              {servicio.descripcion ? (
                <p className="mt-2 text-sm leading-6 text-texto-secundario">{servicio.descripcion}</p>
              ) : (
                <p className="mt-2 text-sm text-tenue">Sin descripción.</p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-borde pt-4">
                <div>
                  <p className="text-[11px] text-tenue">Precio</p>
                  <p className="num mt-0.5 text-lg font-semibold text-texto-principal">{dinero(servicio.precio_base)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-tenue">Duración</p>
                  <p className="num mt-0.5 text-lg font-semibold text-texto-principal">{servicio.duracion_base_minutos || 30} min</p>
                </div>
              </div>
              {!seleccionado && !puedeAgregar && (
                <p className="mt-4 rounded-md border border-advertencia/30 bg-advertencia/10 p-2.5 text-[11px] text-advertencia">
                  Alcanzaste el máximo de servicios por cita.
                </p>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col gap-2 border-t border-borde bg-superficie p-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <span className="num text-sm font-semibold text-texto-principal">
              {dinero(servicio.precio_base)} · {servicio.duracion_base_minutos || 30} min
            </span>
            <div className="flex gap-2">
              <Button variant="secundario" onClick={onClose}>Cerrar</Button>
              <Button
                variant={seleccionado ? 'dangerSuave' : 'primario'}
                disabled={!seleccionado && !puedeAgregar}
                onClick={() => {
                  onToggle(servicio);
                  onClose();
                }}
              >
                {seleccionado ? 'Quitar de la cita' : 'Agregar a la cita'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ModalSedesServicio({
  abierto, servicio, sedeActual, sedes = [], cargando, error,
  seleccionada, onSeleccionar, onCambiar, onQuedarse, onCerrar, onReintentar, cambiando,
}) {
  const actualLat = Number.parseFloat(sedeActual?.latitud);
  const actualLng = Number.parseFloat(sedeActual?.longitud);
  const alternativas = sedes
    .map((sede) => ({ ...sede, lat: Number.parseFloat(sede.latitud), lng: Number.parseFloat(sede.longitud) }))
    .filter((sede) => Number.isFinite(sede.lat) && Number.isFinite(sede.lng));
  const puntos = [
    ...(Number.isFinite(actualLat) && Number.isFinite(actualLng) ? [[actualLat, actualLng]] : []),
    ...alternativas.map((sede) => [sede.lat, sede.lng]),
  ];
  const centro = puntos[0] || [4.60971, -74.08175];
  const elegida = sedes.find((sede) => String(sede.id) === String(seleccionada)) || null;

  return (
    <Modal open={abierto && Boolean(servicio)} onClose={onCerrar} title={servicio ? `Sedes con ${servicio.nombre}` : 'Sedes disponibles'} size="wide">
      <div className="space-y-4">
        <p className="text-xs leading-5 text-texto-secundario">
          {sedeActual ? `No hay estilista en ${sedeActual.nombre}.` : 'No hay estilista en esta sede.'}{' '}
          Estas sedes sí ofrecen el servicio. La disponibilidad exacta se confirma al elegir el horario.
        </p>

        {cargando ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : error ? (
          <div className="rounded-md border border-error/30 bg-error/10 p-3 text-xs text-error">
            {error}
            <Button variant="secundario" size="sm" className="mt-2" onClick={onReintentar}>Reintentar</Button>
          </div>
        ) : sedes.length === 0 ? (
          <div className="rounded-md border border-advertencia/30 bg-advertencia/10 p-4 text-xs leading-5 text-advertencia">
            Ninguna sede tiene estilistas para este servicio. Puedes quitarlo y seguir con los demás.
          </div>
        ) : (
          <>
            {puntos.length > 0 && (
              <div className="relative z-0 h-52 overflow-hidden rounded-lg border border-borde bg-panel">
                <MapContainer center={centro} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <AjustarMapa puntos={puntos} />
                  <InvalidarMapa />
                  {Number.isFinite(actualLat) && Number.isFinite(actualLng) && (
                    <Marker position={[actualLat, actualLng]} icon={iconoMarcadorActual} title={sedeActual.nombre} />
                  )}
                  {alternativas.map((sede) => (
                    <Marker
                      key={sede.id}
                      position={[sede.lat, sede.lng]}
                      icon={customMarkerIcon}
                      title={sede.nombre}
                      eventHandlers={{ click: () => onSeleccionar(String(sede.id)) }}
                    />
                  ))}
                </MapContainer>
              </div>
            )}

            <div className="space-y-2">
              {sedes.map((sede) => {
                const activa = String(sede.id) === String(seleccionada);
                return (
                  <button
                    key={sede.id}
                    type="button"
                    onClick={() => onSeleccionar(String(sede.id))}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      activa ? 'border-acento bg-acento-suave/30 ring-1 ring-acento/20' : 'border-borde bg-superficie hover:bg-panel/60'
                    }`}
                  >
                    <MapPin className={`h-4 w-4 shrink-0 ${activa ? 'text-acento' : 'text-texto-secundario'}`} strokeWidth={1.7} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-texto-principal">{sede.nombre}</span>
                      {sede.direccion && <span className="mt-0.5 block text-[11px] leading-4 text-texto-secundario">{sede.direccion}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num block text-sm font-semibold text-texto-principal">{sede.total_estilistas}</span>
                      <span className="block text-[10px] text-tenue">estilista(s)</span>
                    </span>
                    {activa && <Check className="h-4 w-4 shrink-0 text-acento" strokeWidth={2.5} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col gap-2 border-t border-borde bg-superficie p-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:p-5">
          <Button variant="secundario" onClick={onQuedarse} disabled={cambiando}>
            Quedarme en esta sede y quitar el servicio
          </Button>
          {sedes.length > 0 && (
            <Button
              onClick={() => elegida && onCambiar(elegida)}
              disabled={!elegida || cambiando}
            >
              {cambiando ? <Spinner /> : `Cambiar a ${elegida?.nombre || 'la sede'}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function NuevaReserva() {
  const navigate = useNavigate();
  const { ultimoEvento } = useWebSocket();
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [cargandoCalendario, setCargandoCalendario] = useState(false);
  const [creando, setCreando] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [isMobile, setIsMobile] = useState(false);
  const [diaInicioMovil, setDiaInicioMovil] = useState(0);

  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('Todas');

  const [catalogo, setCatalogo] = useState([]);
  const [categoriasApi, setCategoriasApi] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState('todas');
  const [busquedaServicio, setBusquedaServicio] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [configuracion, setConfiguracion] = useState({ max_servicios_reserva: 5 });
  const [detalleServicio, setDetalleServicio] = useState(null);
  const [sedesModal, setSedesModal] = useState(null);
  const [cambiandoSede, setCambiandoSede] = useState(false);
  const sedesCacheRef = useRef(new Map());

  const [empleadosPorServicio, setEmpleadosPorServicio] = useState({});
  const [asignaciones, setAsignaciones] = useState({});
  const [cargandoEquipo, setCargandoEquipo] = useState(false);

  const [semana, setSemana] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState({});
  const [preferencias, setPreferencias] = useState(null);
  const [granularidad, setGranularidad] = useState(30);
  const [fechaBase, setFechaBase] = useState(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  const [cantidad, setCantidad] = useState(1);
  const [reservaCreada, setReservaCreada] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [pagoEstado, setPagoEstado] = useState('inicial');
  const [pagoMensaje, setPagoMensaje] = useState('');
  const [intencionPago, setIntencionPago] = useState(null);
  const [pagoCompletado, setPagoCompletado] = useState(false);
  const [transaccionManual, setTransaccionManual] = useState('');
  const intentosPagoRef = useRef(0);
  const pasoRef = useRef(paso);
  const fechaBaseRef = useRef(fechaBase);
  const cargarCalendarioRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { pasoRef.current = paso; }, [paso]);
  useEffect(() => { fechaBaseRef.current = fechaBase; }, [fechaBase]);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3200);
  };

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([
      api.ubicaciones.list().catch(() => []),
      api.reservas.servicios().catch(() => []),
      api.reservas.categorias().catch(() => []),
      api.reservas.configuracion().catch(() => ({ max_servicios_reserva: 5 })),
      api.preferencias.get().catch(() => null),
    ])
      .then(([ubis, servs, cats, cfg, prefs]) => {
        if (!activo) return;
        setUbicaciones(Array.isArray(ubis) ? ubis : []);
        setCatalogo(Array.isArray(servs) ? servs.filter((servicio) => servicio.activo !== false) : []);
        setCategoriasApi(Array.isArray(cats) ? cats : []);
        setConfiguracion(cfg || { max_servicios_reserva: 5 });
        setPreferencias(prefs || null);
        if ([15, 30, 60].includes(Number(prefs?.granularidad_calendario))) {
          setGranularidad(Number(prefs.granularidad_calendario));
        }
      })
      .catch((error) => mostrarToast(error.message, 'error'))
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const obtenerCiudad = (direccion) => {
    if (!direccion) return 'Otras';
    const partes = direccion.split(',');
    return partes.length > 1 ? partes[partes.length - 1].trim() : 'Otras';
  };

  const ciudades = useMemo(
    () => ['Todas', ...new Set(ubicaciones.map((u) => obtenerCiudad(u.direccion)))],
    [ubicaciones]
  );

  const ubicacionesFiltradas = useMemo(() => {
    const termino = normalizar(filtroNombre);
    return ubicaciones.filter((ubicacion) => {
      const coincideNombre =
        !termino ||
        normalizar(ubicacion.nombre).includes(termino) ||
        normalizar(ubicacion.direccion).includes(termino);
      const ciudad = obtenerCiudad(ubicacion.direccion);
      const coincideCiudad = filtroCiudad === 'Todas' || normalizar(ciudad) === normalizar(filtroCiudad);
      return coincideNombre && coincideCiudad;
    });
  }, [ubicaciones, filtroNombre, filtroCiudad]);

  const categoriasCliente = useMemo(() => {
    const conServicios = new Map();
    catalogo.forEach((servicio) => {
      const id = servicio.categoria_id ?? 'otros';
      if (!conServicios.has(id)) {
        conServicios.set(id, {
          id,
          nombre: servicio.categoria_nombre || 'Otros',
          orden: servicio.categoria_orden ?? 999,
          total: 0,
        });
      }
      conServicios.get(id).total += 1;
    });
    const base = categoriasApi.length
      ? categoriasApi
          .filter((categoria) => conServicios.has(categoria.id))
          .map((categoria) => ({
            id: categoria.id,
            nombre: categoria.nombre,
            orden: categoria.orden,
            total: conServicios.get(categoria.id)?.total || 0,
          }))
      : [...conServicios.values()];
    return [
      { id: 'todas', nombre: 'Todos', orden: -1, total: catalogo.length },
      ...base.sort((a, b) => Number(a.orden) - Number(b.orden) || a.nombre.localeCompare(b.nombre)),
    ];
  }, [catalogo, categoriasApi]);

  useEffect(() => {
    if (categoriaActiva !== 'todas' && !categoriasCliente.some((c) => String(c.id) === String(categoriaActiva))) {
      setCategoriaActiva('todas');
    }
  }, [categoriasCliente, categoriaActiva]);

  const serviciosFiltrados = useMemo(() => {
    const termino = normalizar(busquedaServicio);
    return catalogo.filter((servicio) => {
      const coincideCategoria =
        categoriaActiva === 'todas' || String(servicio.categoria_id) === String(categoriaActiva);
      if (!coincideCategoria) return false;
      if (!termino) return true;
      const contenido = normalizar(
        `${servicio.nombre} ${servicio.descripcion || ''} ${servicio.categoria_nombre || ''}`
      );
      return contenido.includes(termino);
    });
  }, [catalogo, categoriaActiva, busquedaServicio]);

  const maxServicios = Number(configuracion?.max_servicios_reserva) || 5;
  const totalServicios = seleccionados.reduce((sum, servicio) => sum + Number(servicio.precio_base || 0), 0);
  const duracionTotal = seleccionados.reduce((sum, servicio) => sum + Number(servicio.duracion_base_minutos || 30), 0);

  const equipo = useMemo(
    () =>
      seleccionados.map((servicio) => {
        const opciones = empleadosPorServicio[servicio.id] || [];
        const empleado = opciones.find((item) => String(item.id) === String(asignaciones[servicio.id]));
        return { ...servicio, empleado };
      }),
    [seleccionados, empleadosPorServicio, asignaciones]
  );

  const equipoListo = equipo.length > 0 && equipo.every((item) => item.empleado);
  const equipoUnico = equipoListo && new Set(equipo.map((item) => item.empleado.id)).size === 1;
  const duracionEquipo = equipo.reduce(
    (sum, item) => sum + Number(item.empleado?.duracion_minutos || item.duracion_base_minutos || 30),
    0
  );
  const duracionPlan = (slotSeleccionado?.plan || []).reduce(
    (sum, segmento) => sum + Number(segmento.duracion_minutos || 0),
    0
  ) || duracionEquipo;
  const sinEstilista = seleccionados.filter((servicio) => !(empleadosPorServicio[servicio.id] || []).length);

  const horas = useMemo(() => horasDelRango(preferencias, granularidad), [preferencias, granularidad]);
  const totalReserva = Number(reservaCreada?.precio_total ?? totalServicios) * Number(reservaCreada?.cantidad_personas ?? cantidad);

  const toggleServicio = (servicio) => {
    const ya = seleccionados.some((item) => item.id === servicio.id);
    if (ya) {
      setSeleccionados((prev) => prev.filter((item) => item.id !== servicio.id));
      setAsignaciones((prev) => {
        const next = { ...prev };
        delete next[servicio.id];
        return next;
      });
      setDisponibilidad({});
      setSlotSeleccionado(null);
      setDiaSeleccionado(null);
      return;
    }
    if (seleccionados.length >= maxServicios) {
      mostrarToast(`Puedes elegir hasta ${maxServicios} servicios por reserva`, 'warning');
      return;
    }
    setSeleccionados((prev) => [...prev, servicio]);
    setDisponibilidad({});
    setSlotSeleccionado(null);
    setDiaSeleccionado(null);
  };

  const cargarSedesServicio = useCallback(async (servicioId) => {
    if (sedesCacheRef.current.has(servicioId)) {
      return sedesCacheRef.current.get(servicioId);
    }
    const data = await api.reservas.sedesPorServicio(servicioId);
    const sedes = Array.isArray(data) ? data : [];
    sedesCacheRef.current.set(servicioId, sedes);
    return sedes;
  }, []);

  const cargarEquipo = async (sede = ubicacionSeleccionada) => {
    if (!sede || seleccionados.length === 0) return;
    setCargandoEquipo(true);
    try {
      const respuestas = await Promise.all(
        seleccionados.map(async (servicio) => {
          const data = await api.reservas
            .empleadosPorServicio({ ubicacion_id: sede.id, servicio_id: servicio.id })
            .catch(() => []);
          return [servicio.id, Array.isArray(data) ? data : []];
        })
      );
      const mapa = Object.fromEntries(respuestas);
      setEmpleadosPorServicio(mapa);

      const faltantes = seleccionados.filter((servicio) => !(mapa[servicio.id] || []).length);
      if (faltantes.length > 0) {
        Promise.all(faltantes.map((servicio) => cargarSedesServicio(servicio.id).catch(() => []))).catch(() => {});
      }

      const conteo = new Map();
      Object.values(mapa).flat().forEach((empleado) => {
        conteo.set(empleado.id, (conteo.get(empleado.id) || 0) + 1);
      });
      let principal = null;
      let maximo = 0;
      conteo.forEach((total, id) => {
        if (total > maximo) {
          maximo = total;
          principal = id;
        }
      });

      setAsignaciones((prev) => {
        const siguiente = {};
        seleccionados.forEach((servicio) => {
          const opciones = mapa[servicio.id] || [];
          if (!opciones.length) {
            siguiente[servicio.id] = '';
            return;
          }
          const previo = prev[servicio.id];
          if (previo && opciones.some((empleado) => String(empleado.id) === String(previo))) {
            siguiente[servicio.id] = String(previo);
            return;
          }
          const candidato = opciones.find((empleado) => empleado.id === principal) || opciones[0];
          siguiente[servicio.id] = String(candidato.id);
        });
        return siguiente;
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
    } finally {
      setCargandoEquipo(false);
    }
  };

  const abrirSedesModal = async (servicio) => {
    setSedesModal({
      servicio,
      sedes: [],
      seleccionada: '',
      cargando: true,
      error: '',
    });
    try {
      const sedes = await cargarSedesServicio(servicio.id);
      setSedesModal((prev) => (
        prev && prev.servicio.id === servicio.id
          ? { ...prev, sedes, seleccionada: sedes[0] ? String(sedes[0].id) : '', cargando: false }
          : prev
      ));
    } catch (error) {
      setSedesModal((prev) => (
        prev && prev.servicio.id === servicio.id
          ? { ...prev, cargando: false, error: error.message }
          : prev
      ));
    }
  };

  const cambiarSedeDesdeModal = async (sede) => {
    if (!sede) return;
    setCambiandoSede(true);
    try {
      setUbicacionSeleccionada(sede);
      setEmpleadosPorServicio({});
      setAsignaciones({});
      setDisponibilidad({});
      setSlotSeleccionado(null);
      setDiaSeleccionado(null);
      setSedesModal(null);
      await cargarEquipo(sede);
      mostrarToast(`Ahora estás en ${sede.nombre}`);
    } finally {
      setCambiandoSede(false);
    }
  };

  const quitarServicioDesdeModal = () => {
    const servicio = sedesModal?.servicio;
    if (!servicio) return;
    const restantes = seleccionados.filter((item) => item.id !== servicio.id);
    setSeleccionados(restantes);
    setAsignaciones((prev) => {
      const siguiente = { ...prev };
      delete siguiente[servicio.id];
      return siguiente;
    });
    setEmpleadosPorServicio((prev) => {
      const siguiente = { ...prev };
      delete siguiente[servicio.id];
      return siguiente;
    });
    setDisponibilidad({});
    setSlotSeleccionado(null);
    setDiaSeleccionado(null);
    setSedesModal(null);
    mostrarToast('Quitamos el servicio que no tenía estilista en esta sede', 'warning');
    if (restantes.length === 0) setPaso(2);
  };

  const cargarCalendario = useCallback(
    async (baseDate, pasoGranularidad = granularidad) => {
      if (!ubicacionSeleccionada || seleccionados.length === 0 || !equipoListo) return;
      setCargandoCalendario(true);
      try {
        const prefs = preferencias || (await api.preferencias.get().catch(() => null));
        if (prefs) setPreferencias(prefs);
        const candidata = Number(pasoGranularidad) || Number(prefs?.granularidad_calendario) || 30;
        const g = [15, 30, 60].includes(candidata) ? candidata : 30;
        setGranularidad(g);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const base = new Date(baseDate || new Date());
        base.setHours(0, 0, 0, 0);
        if (base < hoy) base.setTime(hoy.getTime());

        const dias = [];
        for (let i = 0; i < 6; i += 1) {
          const fecha = new Date(base);
          fecha.setDate(base.getDate() + i);
          dias.push({
            fecha: formatearFechaLocal(fecha),
            objetoFecha: fecha,
            esHoy: fecha.getTime() === hoy.getTime(),
            esPasado: fecha < hoy,
          });
        }

        const resultados = await Promise.all(
          dias.map(async (dia) => {
            try {
              const data = await api.reservas.disponibilidadCombo({
                ubicacion_id: ubicacionSeleccionada.id,
                fecha: dia.fecha,
                granularidad: g,
                servicios: seleccionados.map((servicio) => ({
                  servicio_id: servicio.id,
                  empleado_id: Number(asignaciones[servicio.id]),
                })),
              });
              return [dia.fecha, data || { slots: [] }];
            } catch {
              return [dia.fecha, { slots: [] }];
            }
          })
        );

        const mapa = Object.fromEntries(resultados);
        const primerDiaConSlots = dias.findIndex((dia) => (mapa[dia.fecha]?.slots || []).length > 0);
        setSemana(dias);
        setFechaBase(base);
        setDiaInicioMovil(
          primerDiaConSlots >= 0 ? Math.min(primerDiaConSlots, Math.max(0, dias.length - 2)) : 0
        );
        setDisponibilidad(mapa);
      } catch (error) {
        mostrarToast(error.message, 'error');
      } finally {
        setCargandoCalendario(false);
      }
    },
    [ubicacionSeleccionada, seleccionados, asignaciones, equipoListo, preferencias, granularidad]
  );

  useEffect(() => { cargarCalendarioRef.current = cargarCalendario; }, [cargarCalendario]);

  useEffect(() => {
    if (!ultimoEvento) return;
    if (
      ['disponibilidad.actualizada', 'reserva.actualizada'].includes(ultimoEvento.tipo) &&
      pasoRef.current === 4
    ) {
      cargarCalendarioRef.current?.(fechaBaseRef.current || new Date(), granularidad);
    }
  }, [ultimoEvento, granularidad]);

  const volverAtras = () => {
    if (paso === 2) {
      setPaso(1);
    } else if (paso === 3) {
      setPaso(2);
      setEmpleadosPorServicio({});
      setAsignaciones({});
    } else if (paso === 4) {
      setPaso(3);
      setDisponibilidad({});
      setSlotSeleccionado(null);
      setDiaSeleccionado(null);
    } else if (paso === 5) {
      setPaso(4);
    }
  };

  const irAServicios = () => {
    if (!ubicacionSeleccionada) return;
    setPaso(2);
    setEmpleadosPorServicio({});
    setAsignaciones({});
    setDisponibilidad({});
    setSlotSeleccionado(null);
    setDiaSeleccionado(null);
  };

  const irAEquipo = () => {
    if (seleccionados.length === 0) {
      mostrarToast('Elige al menos un servicio', 'warning');
      return;
    }
    setPaso(3);
    cargarEquipo();
  };

  const irAHorario = () => {
    if (!equipoListo) {
      mostrarToast('Completa el equipo de estilistas', 'warning');
      return;
    }
    setPaso(4);
    cargarCalendario(new Date());
  };

  const cambiarUbicacion = () => {
    setUbicacionSeleccionada(null);
    setSeleccionados([]);
    setAsignaciones({});
    setEmpleadosPorServicio({});
    setDisponibilidad({});
    setSlotSeleccionado(null);
    setDiaSeleccionado(null);
    setPaso(1);
  };

  const slotEnDia = (fecha, hora) =>
    (disponibilidad[fecha]?.slots || []).find((slot) => slot.hora === hora) || null;

  const estadoCelda = (dia, hora) => {
    const slot = slotEnDia(dia.fecha, hora);
    const instante = new Date(`${dia.fecha}T${hora}:00-05:00`);
    const ahora = new Date();
    const diffMin = (instante - ahora) / 60000;
    if (diffMin <= 0) return { clase: 'slot-pasado', label: 'Pasado', disponible: false, slot: null };
    if (diffMin < 60) return { clase: 'slot-antelacion', label: '< 60 min', disponible: false, slot: null };
    if (slot) return { clase: 'slot-libre', label: 'Libre', disponible: true, slot };
    return { clase: 'slot-no-disponible', label: 'No disp.', disponible: false, slot: null };
  };

  const handleSlotClick = (dia, hora) => {
    const estado = estadoCelda(dia, hora);
    if (!estado.disponible || !estado.slot) return;
    setDiaSeleccionado(dia);
    setSlotSeleccionado(estado.slot);
    setPaso(5);
  };

  const handleCrearReserva = async () => {
    if (!slotSeleccionado || !diaSeleccionado || !equipoListo) return;
    setCreando(true);
    try {
      const data = await api.reservas.create({
        empleado_id: Number(asignaciones[seleccionados[0].id]),
        ubicacion_id: ubicacionSeleccionada.id,
        inicia_en: slotSeleccionado.inicia_en,
        cantidad_personas: cantidad,
        servicios: seleccionados.map((servicio) => ({
          servicio_id: servicio.id,
          empleado_id: Number(asignaciones[servicio.id]),
        })),
      });
      setReservaCreada(data);
      setPagoEstado('inicial');
      setPagoMensaje('');
      setIntencionPago(null);
      setTransaccionManual('');
      setMetodoPago('efectivo');
      setPaso(6);
      mostrarToast('Reserva creada con éxito');
    } catch (error) {
      if (/superpone|fuera de la disponibilidad|no esta disponible/i.test(error.message)) {
        mostrarToast(`${error.message}. Elige otro horario.`, 'error');
        setSlotSeleccionado(null);
        setDiaSeleccionado(null);
        setPaso(4);
        cargarCalendario(fechaBase || new Date());
      } else {
        mostrarToast(error.message, 'error');
      }
    } finally {
      setCreando(false);
    }
  };

  const cargarScriptWompi = () =>
    new Promise((resolve, reject) => {
      if (window.WidgetCheckout) {
        resolve();
        return;
      }
      const existente = document.querySelector('script[data-wompi-widget]');
      if (existente) {
        existente.addEventListener('load', () => resolve());
        existente.addEventListener('error', () => reject(new Error('No se pudo cargar el checkout de Wompi')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;
      script.dataset.wompiWidget = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el checkout de Wompi'));
      document.head.appendChild(script);
    });

  const aplicarEstadoPago = (pago) => {
    if (!pago) return;
    if (pago.estado === 'aprobado') {
      setPagoEstado('aprobado');
      setPagoMensaje('Pago aprobado. Tu reserva quedó confirmada.');
      setPagoCompletado(true);
      mostrarToast('Pago aprobado correctamente');
    } else if (pago.estado === 'declinado' || pago.estado === 'error') {
      setPagoEstado(pago.estado);
      setPagoMensaje(
        pago.estado === 'declinado'
          ? 'El pago fue rechazado. Puedes intentar con otro medio o pagar en el local.'
          : 'Ocurrió un error procesando el pago. Intenta de nuevo.'
      );
    } else {
      setPagoEstado('pendiente');
      setPagoMensaje('El pago aún no aparece aprobado. Si ya pagaste, verifica el estado.');
    }
  };

  const consultarEstadoPago = async () => {
    if (!intencionPago) return;
    try {
      const pago = await api.pagos.estado(intencionPago.pago_id);
      aplicarEstadoPago(pago);
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  };

  const verificarPago = async (transactionId) => {
    if (!intencionPago) return;
    try {
      const pago = await api.pagos.verificar(intencionPago.pago_id, transactionId);
      aplicarEstadoPago(pago);
    } catch (error) {
      setPagoEstado('error');
      setPagoMensaje(error.message);
      mostrarToast(error.message, 'error');
    }
  };

  const pagarConWompi = async () => {
    if (!reservaCreada) return;
    setPagoEstado('procesando');
    setPagoMensaje('');
    try {
      const intencion = await api.pagos.intencion(reservaCreada.id);
      setIntencionPago(intencion);
      setTransaccionManual('');
      await cargarScriptWompi();
      const checkout = new window.WidgetCheckout({
        currency: intencion.moneda,
        amountInCents: intencion.monto_en_centavos,
        reference: intencion.referencia,
        publicKey: intencion.llave_publica,
        signature: { integrity: intencion.firma_integridad },
        customerData: {
          email: intencion.customer_data?.email,
          fullName: intencion.customer_data?.full_name,
        },
      });
      checkout.open(async (resultado) => {
        const transaccion = resultado?.transaction;
        if (transaccion?.id) await verificarPago(transaccion.id);
        else await consultarEstadoPago();
      });
      setPagoEstado('esperando');
      setPagoMensaje('Completa el pago en la ventana segura de Wompi.');
    } catch (error) {
      setPagoEstado('error');
      setPagoMensaje(error.message);
      mostrarToast(error.message, 'error');
    }
  };

  const confirmarPagoEfectivo = () => {
    setPagoCompletado(true);
    mostrarToast('Reserva activada. Paga en el local al llegar.');
  };

  useEffect(() => {
    if (!intencionPago || pagoEstado !== 'esperando') return undefined;
    intentosPagoRef.current = 0;
    const intervalo = setInterval(async () => {
      intentosPagoRef.current += 1;
      if (intentosPagoRef.current > 6) {
        clearInterval(intervalo);
        setPagoEstado('pendiente');
        setPagoMensaje('No detectamos el pago aún. Usa "Ya pagué, actualizar estado" si ya pagaste.');
        return;
      }
      try {
        const pago = await api.pagos.estado(intencionPago.pago_id);
        if (pago.estado !== 'pendiente') aplicarEstadoPago(pago);
      } catch {
        /* reintenta */
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [intencionPago, pagoEstado]);

  const descargarQR = () => descargarQrReserva(reservaCreada);

  if (pagoCompletado) {
    return (
      <div className="mx-auto max-w-2xl py-8 text-center sm:py-14">
        <Toast open={toast.open} message={toast.message} type={toast.type} />
        <Card className="p-7 sm:p-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-exito/10 text-exito">
            <Check className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-texto-principal">
            {pagoEstado === 'aprobado' ? 'Cita confirmada' : 'Reserva registrada'}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-texto-secundario">
            {pagoEstado === 'aprobado'
              ? 'El pago fue aprobado. Muestra el código QR al llegar al salón.'
              : 'Tu cita quedó activa. Muestra el código QR al llegar y paga en el local.'}
          </p>
          {reservaCreada?.qr_data_url && (
            <div className="mx-auto mt-6 inline-block max-w-full rounded-lg border border-borde bg-white p-4">
              <img src={reservaCreada.qr_data_url} alt="Código QR de la cita" className="mx-auto h-40 w-40" />
              {reservaCreada.qr_token && (
                <span className="mono mt-2 block break-all text-[10px] text-tenue">{reservaCreada.qr_token}</span>
              )}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="secundario" onClick={descargarQR}>Descargar QR</Button>
            <Button onClick={() => navigate('/cliente')}>Ir a mis citas</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 pb-32 md:pb-0">
      <Toast open={toast.open} message={toast.message} type={toast.type} />
      <PageHeader
        title="Reservar cita"
        subtitle="Elige sede, servicios, equipo y horario. Puedes sumar varios servicios en una sola cita."
        actions={
          <Button variant="ghost" onClick={() => navigate('/cliente')}>
            Cancelar
          </Button>
        }
      />

      <div className="rounded-lg border border-borde bg-superficie px-3 py-2.5">
        <div className="flex items-center gap-3 sm:hidden">
          <span className="mono shrink-0 text-[11px] font-medium text-texto-principal">
            {paso}/{PASOS.length}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel">
            <div className="h-full rounded-full bg-acento" style={{ width: `${(paso / PASOS.length) * 100}%` }} />
          </div>
          <span className="shrink-0 text-[11px] font-medium text-texto-principal">{PASOS[paso - 1]?.label}</span>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          {PASOS.map((p, i) => {
            const activo = p.num === paso;
            const completado = p.num < paso;
            return (
              <div key={p.num} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                    activo
                      ? 'bg-primario text-primario-texto'
                      : completado
                        ? 'bg-acento-suave text-acento-tinta'
                        : 'bg-panel text-tenue'
                  }`}
                >
                  {completado ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : p.num}
                </span>
                <span className={`text-[11px] ${activo || completado ? 'font-medium text-texto-principal' : 'text-tenue'}`}>
                  {p.label}
                </span>
                {i < PASOS.length - 1 && <span className={`h-px flex-1 ${completado ? 'bg-acento/40' : 'bg-borde'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {paso === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-texto-principal">Elige la sede</h2>
            <p className="mt-0.5 text-xs text-texto-secundario">
              Busca por nombre o ciudad, o selecciona un punto en el mapa.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Buscar sede"
                  placeholder="Nombre o dirección..."
                  value={filtroNombre}
                  onChange={(evento) => setFiltroNombre(evento.target.value)}
                />
                <Select
                  label="Ciudad"
                  value={filtroCiudad}
                  onChange={(evento) => setFiltroCiudad(evento.target.value)}
                  options={ciudades.map((ciudad) => ({ value: ciudad, label: ciudad }))}
                />
              </div>

              {cargando && ubicaciones.length === 0 ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : ubicacionesFiltradas.length === 0 ? (
                <EmptyState title="No encontramos sedes" description="Prueba con otro nombre o quita el filtro de ciudad." />
              ) : (
                <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1 scroll-thin">
                  {ubicacionesFiltradas.map((ubicacion) => {
                    const seleccionada = ubicacionSeleccionada?.id === ubicacion.id;
                    return (
                      <button
                        key={ubicacion.id}
                        type="button"
                        onClick={() => setUbicacionSeleccionada(ubicacion)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                          seleccionada
                            ? 'border-acento bg-acento-suave/40 ring-1 ring-acento/20'
                            : 'border-borde bg-superficie hover:bg-panel/60'
                        }`}
                      >
                        <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${seleccionada ? 'text-acento' : 'text-texto-secundario'}`} strokeWidth={1.7} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-texto-principal">{ubicacion.nombre}</span>
                          {ubicacion.direccion && (
                            <span className="mt-0.5 block text-xs leading-5 text-texto-secundario">{ubicacion.direccion}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-borde bg-superficie p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-texto-secundario">Mapa de sedes</p>
                {ubicacionSeleccionada && <Badge variant="accent">{ubicacionSeleccionada.nombre}</Badge>}
              </div>
              <div className="relative z-0 h-64 overflow-hidden rounded-md border border-borde bg-panel">
                <MapContainer
                  center={ubicacionSeleccionada ? [parseFloat(ubicacionSeleccionada.latitud), parseFloat(ubicacionSeleccionada.longitud)] : [4.60971, -74.08175]}
                  zoom={13}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {ubicacionesFiltradas.map((ubicacion) => (
                    <Marker
                      key={ubicacion.id}
                      position={[parseFloat(ubicacion.latitud), parseFloat(ubicacion.longitud)]}
                      icon={customMarkerIcon}
                      eventHandlers={{ click: () => setUbicacionSeleccionada(ubicacion) }}
                    />
                  ))}
                  <AjustarMapa puntos={ubicacionesFiltradas.map((u) => [parseFloat(u.latitud), parseFloat(u.longitud)])} />
                  {ubicacionSeleccionada && (
                    <MapRecenter lat={parseFloat(ubicacionSeleccionada.latitud)} lng={parseFloat(ubicacionSeleccionada.longitud)} />
                  )}
                </MapContainer>
              </div>
              <Button onClick={irAServicios} disabled={!ubicacionSeleccionada} className="hidden w-full md:inline-flex">
                Continuar con servicios
              </Button>
            </div>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button type="button" onClick={volverAtras} className="inline-flex items-center gap-1 text-xs font-medium text-acento hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Volver
              </button>
              <h2 className="mt-1 text-base font-semibold text-texto-principal">Elige tus servicios</h2>
              <p className="mt-0.5 text-xs text-texto-secundario">
                {ubicacionSeleccionada?.nombre} · hasta {maxServicios} servicios por cita.
              </p>
            </div>
            <Badge variant={seleccionados.length >= maxServicios ? 'warning' : 'accent'}>
              {seleccionados.length}/{maxServicios} seleccionados
            </Badge>
          </div>

          <Card padding={false} className="flex h-[clamp(300px,calc(100dvh-24rem),520px)] flex-col overflow-hidden lg:h-[clamp(420px,calc(100dvh-21rem),640px)]">
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <aside className="shrink-0 border-b border-borde bg-panel/40 p-2 lg:w-[220px] lg:overflow-y-auto lg:border-b-0 lg:border-r scroll-thin">
                <p className="hidden px-2 py-1 text-[11px] font-medium text-tenue lg:block">
                  Categorías
                </p>
                <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                  {categoriasCliente.map((categoria) => {
                    const activa = String(categoriaActiva) === String(categoria.id);
                    return (
                      <button
                        key={categoria.id}
                        type="button"
                        onClick={() => setCategoriaActiva(String(categoria.id))}
                        aria-pressed={activa}
                        className={`flex shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors lg:w-full ${
                          activa
                            ? 'bg-superficie font-medium text-texto-principal ring-1 ring-borde'
                            : 'text-texto-secundario hover:bg-superficie/70 hover:text-texto-principal'
                        }`}
                      >
                        <span className="whitespace-nowrap">{categoria.nombre}</span>
                        <span className="num text-[10px] text-tenue">{categoria.total}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4">
                <div className="relative shrink-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" strokeWidth={1.7} aria-hidden="true" />
                  <input
                    type="search"
                    value={busquedaServicio}
                    onChange={(evento) => setBusquedaServicio(evento.target.value)}
                    placeholder="Buscar corte, barba, tinte..."
                    aria-label="Buscar servicio"
                    className="h-10 w-full rounded-md border border-control bg-superficie pl-9 pr-9 text-sm text-texto-principal placeholder:text-tenue/70 focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
                  />
                  {busquedaServicio && (
                    <button
                      type="button"
                      onClick={() => setBusquedaServicio('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-tenue hover:bg-panel hover:text-texto-principal"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {cargando ? (
                  <div className="flex flex-1 items-center justify-center"><Spinner /></div>
                ) : serviciosFiltrados.length === 0 ? (
                  <div className="mt-4 flex min-h-0 flex-1 items-start justify-center">
                    <EmptyState
                      title="No encontramos servicios"
                      description="Prueba con otra palabra o cambia de categoría."
                    />
                  </div>
                ) : (
                  <div
                    className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 scroll-thin"
                    role="region"
                    aria-label="Lista de servicios"
                    tabIndex={0}
                  >
                    <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {serviciosFiltrados.map((servicio) => {
                        const seleccionado = seleccionados.some((item) => item.id === servicio.id);
                        const bloqueado = !seleccionado && seleccionados.length >= maxServicios;
                        const totalImagenes = Number(servicio.total_imagenes) || (servicio.imagen_url ? 1 : 0);
                        return (
                          <div
                            key={servicio.id}
                            className={`flex gap-3 rounded-lg border p-2.5 transition-colors sm:flex-col sm:gap-0 ${
                              seleccionado
                                ? 'border-acento bg-acento-suave/30 ring-1 ring-acento/20'
                                : 'border-borde bg-superficie'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setDetalleServicio(servicio)}
                              aria-label={`Ver detalle de ${servicio.nombre}`}
                              className="flex min-w-0 flex-1 items-start gap-3 text-left sm:flex-col sm:items-stretch"
                            >
                              <span className="relative block shrink-0 sm:w-full">
                                <ImagenServicio src={servicio.imagen_url} nombre={servicio.nombre} />
                                {seleccionado && (
                                  <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-acento text-acento-texto">
                                    <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                                  </span>
                                )}
                                {totalImagenes > 1 && (
                                  <Badge variant="accent" className="absolute bottom-1.5 right-1.5">
                                    {totalImagenes} fotos
                                  </Badge>
                                )}
                              </span>
                              <span className="min-w-0 flex-1 sm:pt-2.5">
                                <span className="block text-[10px] font-medium text-tenue">
                                  {servicio.categoria_nombre || 'Servicio'}
                                </span>
                                <span className="mt-0.5 block truncate text-sm font-medium text-texto-principal">{servicio.nombre}</span>
                                {servicio.descripcion && (
                                  <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-texto-secundario">{servicio.descripcion}</span>
                                )}
                                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-acento">
                                  Ver detalle <ChevronRight className="h-3 w-3" aria-hidden="true" />
                                </span>
                              </span>
                            </button>
                            <div className="flex shrink-0 flex-col items-end justify-between gap-2 sm:flex-row sm:items-end sm:pt-2">
                              <div className="text-right sm:text-left">
                                <p className="num text-sm font-semibold text-texto-principal">{dinero(servicio.precio_base)}</p>
                                <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-tenue sm:justify-start">
                                  <Clock className="h-3 w-3" strokeWidth={1.7} aria-hidden="true" />
                                  {servicio.duracion_base_minutos || 30} min
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleServicio(servicio)}
                                disabled={bloqueado}
                                className={`h-7 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                                  seleccionado
                                    ? 'border-acento/30 bg-superficie text-acento-tinta hover:bg-panel'
                                    : bloqueado
                                      ? 'cursor-not-allowed border-borde text-tenue opacity-50'
                                      : 'border-control bg-superficie text-texto-principal hover:bg-panel'
                                }`}
                              >
                                {seleccionado ? 'Quitar' : 'Agregar'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="hidden shrink-0 items-center justify-between gap-3 border-t border-borde p-3 md:flex">
              <div className="text-xs text-texto-secundario">
                {seleccionados.length === 0 ? (
                  'Elige al menos un servicio'
                ) : (
                  <>
                    <span className="font-medium text-texto-principal">{seleccionados.length} servicio(s)</span> ·{' '}
                    {duracionTotal} min · <span className="num">{dinero(totalServicios)}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secundario" onClick={volverAtras}>Atrás</Button>
                <Button onClick={irAEquipo} disabled={seleccionados.length === 0}>
                  Continuar con equipo <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {paso === 3 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button type="button" onClick={volverAtras} className="inline-flex items-center gap-1 text-xs font-medium text-acento hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Volver
              </button>
              <h2 className="mt-1 text-base font-semibold text-texto-principal">Elige tu equipo</h2>
              <p className="mt-0.5 text-xs text-texto-secundario">
                Cada servicio puede tener un estilista distinto. El sistema propone uno disponible.
              </p>
            </div>
            <Badge variant={equipoUnico ? 'accent' : 'info'}>
              {equipoListo ? (equipoUnico ? 'Un estilista' : `${new Set(equipo.map((item) => item.empleado.id)).size} estilistas`) : 'Equipo pendiente'}
            </Badge>
          </div>

          {!cargandoEquipo && sinEstilista.length > 0 && (
            <div className="rounded-lg border border-advertencia/30 bg-advertencia/10 p-4">
              <p className="text-sm font-medium text-advertencia">
                Faltan estilistas en {ubicacionSeleccionada?.nombre}
              </p>
              <p className="mt-1 text-xs leading-5 text-advertencia">
                Estos servicios sí están disponibles en otras sedes. Puedes cambiar de sede o quitar el servicio.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sinEstilista.map((servicio) => (
                  <Button
                    key={servicio.id}
                    variant="secundario"
                    size="sm"
                    onClick={() => abrirSedesModal(servicio)}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {servicio.nombre} · Ver sedes
                  </Button>
                ))}
              </div>
            </div>
          )}

          {cargandoEquipo ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="space-y-3 lg:max-h-[calc(100dvh-24rem)] lg:overflow-y-auto lg:pr-1 scroll-thin">
              {equipo.map((servicio) => {
                const opciones = (empleadosPorServicio[servicio.id] || []).map((empleado) => ({
                  value: String(empleado.id),
                  label: `${empleado.nombre} ${empleado.apellido || ''}`,
                  description: `${empleado.duracion_minutos || servicio.duracion_base_minutos} min · ${dinero(empleado.precio_base || servicio.precio_base)}`,
                }));
                return (
                  <Card key={servicio.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {servicio.imagen_url ? (
                          <img
                            src={servicio.imagen_url}
                            alt={`Imagen de ${servicio.nombre}`}
                            className="h-12 w-12 rounded-md border border-borde object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-md border border-borde bg-panel text-tenue">
                            <ImageOff className="h-4 w-4" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-tenue">
                            {servicio.categoria_nombre || 'Servicio'}
                          </p>
                          <p className="truncate text-sm font-medium text-texto-principal">{servicio.nombre}</p>
                          <p className="mt-0.5 text-[11px] text-texto-secundario">
                            {servicio.duracion_base_minutos || 30} min · <span className="num">{dinero(servicio.precio_base)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="w-full sm:w-72">
                        {opciones.length === 0 ? (
                          <div className="rounded-md border border-advertencia/30 bg-advertencia/10 p-3 text-xs text-advertencia">
                            <p>No hay estilista en esta sede.</p>
                            <Button
                              variant="secundario"
                              size="sm"
                              className="mt-2"
                              onClick={() => abrirSedesModal(servicio)}
                            >
                              Ver sedes con este servicio
                            </Button>
                          </div>
                        ) : (
                          <BuscadorSelect
                            label="Estilista"
                            value={asignaciones[servicio.id] || ''}
                            onChange={(valor) => {
                              setAsignaciones((prev) => ({ ...prev, [servicio.id]: valor }));
                              setDisponibilidad({});
                              setSlotSeleccionado(null);
                              setDiaSeleccionado(null);
                            }}
                            options={opciones}
                            placeholder="Buscar estilista..."
                            allowClear={false}
                          />
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

            </div>
          )}

          <div className="hidden items-center justify-between gap-3 border-t border-borde pt-4 md:flex">
            <div className="text-xs text-texto-secundario">
              {equipoListo ? (
                <>
                  <Users className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                  {equipoUnico ? 'Un solo estilista' : 'Varios estilistas en secuencia'} · {duracionEquipo} min
                </>
              ) : (
                'Completa el estilista de cada servicio'
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secundario" onClick={volverAtras}>Atrás</Button>
              <Button onClick={irAHorario} disabled={!equipoListo || cargandoEquipo}>
                Continuar con horario <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {paso === 4 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <button type="button" onClick={volverAtras} className="inline-flex items-center gap-1 text-xs font-medium text-acento hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Volver
              </button>
              <h2 className="mt-1 text-base font-semibold text-texto-principal">Elige día y hora</h2>
              <p className="mt-0.5 text-xs text-texto-secundario">
                {seleccionados.length} servicio(s) · {duracionEquipo} min ·{' '}
                {equipoUnico ? 'un estilista' : `${new Set(equipo.map((item) => item.empleado.id)).size} estilistas`} · mínimo 60 min de anticipación.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {fechaBase && (
                <div className="flex items-center gap-1 rounded-md border border-borde bg-superficie p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nueva = new Date(fechaBase);
                      nueva.setDate(nueva.getDate() - 6);
                      const hoy = new Date();
                      hoy.setHours(0, 0, 0, 0);
                      cargarCalendario(nueva < hoy ? hoy : nueva, granularidad);
                    }}
                    aria-label="Ver 6 días anteriores"
                  >
                    ←
                  </Button>
                  <input
                    type="date"
                    value={fechaBase ? formatearFechaLocal(fechaBase) : ''}
                    min={formatearFechaLocal(new Date())}
                    onChange={(evento) => {
                      if (!evento.target.value) return;
                      const [anio, mes, dia] = evento.target.value.split('-').map(Number);
                      cargarCalendario(new Date(anio, mes - 1, dia), granularidad);
                    }}
                    className="h-8 rounded border-0 bg-transparent px-1 text-xs text-texto-principal focus:outline-none"
                    aria-label="Fecha de inicio"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nueva = new Date(fechaBase);
                      nueva.setDate(nueva.getDate() + 6);
                      cargarCalendario(nueva, granularidad);
                    }}
                    aria-label="Ver siguientes 6 días"
                  >
                    →
                  </Button>
                </div>
              )}
              <select
                value={granularidad}
                onChange={(evento) => {
                  const valor = Number(evento.target.value);
                  setGranularidad(valor);
                  cargarCalendario(fechaBase || new Date(), valor);
                }}
                className="h-9 rounded-md border border-control bg-superficie px-2 text-xs text-texto-principal focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
                aria-label="Intervalo de horarios"
              >
                <option value="15">Intervalo 15m</option>
                <option value="30">Intervalo 30m</option>
                <option value="60">Intervalo 60m</option>
              </select>
            </div>
          </div>

          {cargandoCalendario ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : semana.every((dia) => !(disponibilidad[dia.fecha]?.slots || []).length) ? (
            <EmptyState
              title="No hay horarios para este equipo"
              description="Prueba con otros días, cambia un estilista o cambia de sede."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secundario" onClick={volverAtras}>Cambiar equipo</Button>
                  <Button variant="secundario" onClick={cambiarUbicacion}>Cambiar sede</Button>
                </div>
              }
            />
          ) : (
            (() => {
              const maxInicio = Math.max(0, semana.length - 2);
              const inicio = Math.min(diaInicioMovil, maxInicio);
              const diasVisibles = isMobile ? semana.slice(inicio, inicio + 2) : semana;
              return (
                <>
                  <Card padding={false} className="mx-auto max-w-4xl overflow-hidden">
                    <div className="max-h-[46vh] overflow-x-auto overflow-y-auto scroll-thin">
                      <table className={`w-full border-collapse text-xs ${isMobile ? '' : 'min-w-[760px]'}`}>
                        <thead className="sticky top-0 z-20">
                          <tr className="border-b border-borde bg-superficie">
                            <th className="sticky left-0 z-30 w-20 border-b border-borde bg-superficie px-3 py-3 text-left text-[11px] font-medium text-texto-secundario">
                              Hora
                            </th>
                            {diasVisibles.map((dia) => (
                              <th key={dia.fecha} className="border-b border-borde px-2 py-2.5 text-center">
                                <span className="block text-[10px] font-medium text-texto-secundario">
                                  {DIAS_CORTOS[dia.objetoFecha.getDay()]}
                                </span>
                                <span className="num block text-sm font-medium text-texto-principal">
                                  {dia.objetoFecha.getDate()}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {horas.map((hora) => (
                            <tr key={hora} className="transition-colors hover:bg-panel/50">
                              <td className="sticky left-0 z-10 whitespace-nowrap border-b border-regla bg-superficie px-3 py-2 text-[11px] font-medium text-texto-secundario">
                                {hora}
                              </td>
                              {diasVisibles.map((dia) => {
                                const estado = estadoCelda(dia, hora);
                                return (
                                  <td key={dia.fecha} className="border-b border-r border-regla p-0.5 last:border-r-0">
                                    <button
                                      type="button"
                                      onClick={() => handleSlotClick(dia, hora)}
                                      disabled={!estado.disponible}
                                      title={estado.disponible ? `Elegir ${hora} con ${equipo.map((item) => item.empleado?.nombre).filter(Boolean).join(', ')}` : estado.label}
                                      className={`relative w-full rounded px-1 py-1.5 text-[10px] font-medium transition-colors ${estado.clase}`}
                                    >
                                      {estado.label}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                  {isMobile && (
                    <div className="mx-auto flex max-w-4xl items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDiaInicioMovil(Math.max(0, inicio - 1))}
                        disabled={inicio <= 0}
                        aria-label="Ver días anteriores"
                        className="rounded border border-borde bg-superficie px-3 py-1.5 text-xs font-semibold transition hover:bg-panel disabled:opacity-50"
                      >
                        ←
                      </button>
                      <span className="text-xs font-semibold text-texto-secundario">
                        Días {inicio + 1}–{inicio + diasVisibles.length} de {semana.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDiaInicioMovil(Math.min(maxInicio, inicio + 1))}
                        disabled={inicio >= maxInicio}
                        aria-label="Ver días siguientes"
                        className="rounded border border-borde bg-superficie px-3 py-1.5 text-xs font-semibold transition hover:bg-panel disabled:opacity-50"
                      >
                        →
                      </button>
                    </div>
                  )}
                </>
              );
            })()
          )}

          <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-2 border-t border-borde pt-4 text-[11px] text-texto-secundario">
            <span className="flex items-center gap-1.5"><span className="slot-libre h-3.5 w-3.5 rounded-sm border" /> Libre</span>
            <span className="flex items-center gap-1.5"><span className="slot-no-disponible h-3.5 w-3.5 rounded-sm border" /> No disponible</span>
            <span className="flex items-center gap-1.5"><span className="slot-pasado h-3.5 w-3.5 rounded-sm border" /> Pasado</span>
            <span className="flex items-center gap-1.5"><span className="slot-antelacion h-3.5 w-3.5 rounded-sm border" /> Anticipación &lt;60m</span>
          </div>

          <div className="mt-2 flex justify-center">
            <Button variant="secundario" onClick={volverAtras}>Atrás</Button>
          </div>
        </div>
      )}

      {paso === 5 && slotSeleccionado && diaSeleccionado && (
        <div className="space-y-5">
          <div>
            <button type="button" onClick={volverAtras} className="inline-flex items-center gap-1 text-xs font-medium text-acento hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Volver al horario
            </button>
            <h2 className="mt-1 text-base font-semibold text-texto-principal">Confirma tu cita</h2>
            <p className="mt-0.5 text-xs text-texto-secundario">Revisa los servicios, el equipo y el total antes de reservar.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-texto-secundario">Sede</span>
                  <span className="text-right font-medium text-texto-principal">{ubicacionSeleccionada?.nombre}</span>
                  <span className="text-texto-secundario">Fecha</span>
                  <span className="text-right font-medium text-texto-principal">{fechaBonita(diaSeleccionado.fecha)}</span>
                  <span className="text-texto-secundario">Inicio</span>
                  <span className="num text-right font-medium text-texto-principal">{horaDeIso(slotSeleccionado.inicia_en)}</span>
                  <span className="text-texto-secundario">Fin</span>
                  <span className="num text-right font-medium text-texto-principal">{horaDeIso(slotSeleccionado.termina_en)}</span>
                  <span className="text-texto-secundario">Duración</span>
                  <span className="text-right font-medium text-texto-principal">{duracionPlan} min</span>
                </div>
              </Card>

              <Card padding={false} className="overflow-hidden">
                <div className="border-b border-borde bg-panel/40 px-4 py-3">
                  <h3 className="text-sm font-semibold text-texto-principal">Servicios y equipo</h3>
                </div>
                <div className="divide-y divide-regla">
                  {(slotSeleccionado.plan || []).map((segmento) => (
                    <div key={`${segmento.servicio_id}-${segmento.orden}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-texto-principal">{segmento.nombre}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-texto-secundario">
                          <span>{segmento.empleado_nombre}</span>
                          <span className="text-tenue">·</span>
                          <span className="num">{horaDeIso(segmento.inicia_en)}–{horaDeIso(segmento.termina_en)}</span>
                          <span className="text-tenue">·</span>
                          <span>{segmento.duracion_minutos} min</span>
                        </p>
                      </div>
                      <span className="num shrink-0 text-sm font-medium text-texto-principal">{dinero(segmento.precio)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <span className="text-[11px] text-texto-secundario">Personas</span>
                <div className="mt-1.5 flex items-center gap-2" role="group" aria-label="Cantidad de personas">
                  <button
                    type="button"
                    aria-label="Quitar una persona"
                    onClick={() => setCantidad((valor) => Math.max(1, valor - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-control text-base transition-colors hover:bg-panel"
                  >
                    −
                  </button>
                  <span className="num w-8 text-center text-sm font-medium" aria-live="polite">{cantidad}</span>
                  <button
                    type="button"
                    aria-label="Agregar una persona"
                    onClick={() => setCantidad((valor) => Math.min(5, valor + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-control text-base transition-colors hover:bg-panel"
                  >
                    +
                  </button>
                </div>
                <div className="mt-4 border-t border-borde pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-texto-secundario">Servicios</span>
                    <span className="num text-texto-principal">{dinero(totalServicios)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-texto-secundario">Personas</span>
                    <span className="num text-texto-principal">× {cantidad}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-borde pt-3">
                    <span className="text-sm font-medium text-texto-principal">Total estimado</span>
                    <span className="num text-xl font-semibold text-texto-principal">{dinero(totalServicios * cantidad)}</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-tenue">
                  El monto final se calcula en el servidor al confirmar la reserva. La disponibilidad puede cambiar mientras completas el pago.
                </p>
              </Card>

              <div className="hidden gap-2 md:flex">
                <Button variant="secundario" className="flex-1" onClick={volverAtras}>Atrás</Button>
                <Button className="flex-1" onClick={handleCrearReserva} disabled={creando}>
                  {creando ? <Spinner /> : 'Confirmar reserva'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {paso === 6 && reservaCreada && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-texto-principal">Elige cómo pagar</h2>
            <p className="mt-0.5 text-xs text-texto-secundario">
              Tu cita ya está registrada. El pago en línea o en efectivo la deja lista.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col items-center rounded-lg border border-borde bg-superficie p-5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-exito/10 text-exito">
                <Check className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-texto-principal">Reserva registrada</h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-texto-secundario">
                Muestra el QR al llegar. Si eliges efectivo, el pago se registra en recepción.
              </p>
              {reservaCreada.qr_data_url && (
                <div className="mt-4 inline-block rounded-md border border-borde bg-white p-3">
                  <img src={reservaCreada.qr_data_url} alt="Código QR de la cita" className="h-32 w-32" />
                  {reservaCreada.qr_token && (
                    <span className="mono mt-2 block break-all text-[9px] text-tenue">{reservaCreada.qr_token}</span>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button variant="secundario" size="sm" onClick={descargarQR}>Descargar QR</Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/cliente')}>Ir a mis citas</Button>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-borde bg-superficie p-5">
              <div>
                <p className="text-xs font-medium text-texto-principal">Forma de pago</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago('efectivo')}
                    className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors ${
                      metodoPago === 'efectivo' ? 'border-acento bg-acento-suave/50' : 'border-borde hover:bg-panel'
                    }`}
                  >
                    <span className={`text-xs font-medium ${metodoPago === 'efectivo' ? 'text-acento-tinta' : 'text-texto-secundario'}`}>
                      Efectivo en local
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('online')}
                    className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors ${
                      metodoPago === 'online' ? 'border-acento bg-acento-suave/50' : 'border-borde hover:bg-panel'
                    }`}
                  >
                    <span className={`text-xs font-medium ${metodoPago === 'online' ? 'text-acento-tinta' : 'text-texto-secundario'}`}>
                      Pago en línea
                    </span>
                  </button>
                </div>
              </div>

              {metodoPago === 'efectivo' ? (
                <div className="space-y-3">
                  <p className="text-xs leading-5 text-texto-secundario">
                    Reserva ahora y paga en el local al presentar tu código QR.
                  </p>
                  <Button onClick={confirmarPagoEfectivo} className="w-full">
                    Confirmar y pagar en local
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-borde bg-panel/60 p-3">
                    <p className="text-[11px] font-medium text-texto-secundario">Medios disponibles en Wompi</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-texto-principal">
                      <span className="rounded border border-borde bg-superficie px-2 py-1.5">Tarjeta</span>
                      <span className="rounded border border-borde bg-superficie px-2 py-1.5">PSE</span>
                      <span className="rounded border border-borde bg-superficie px-2 py-1.5">Nequi</span>
                      <span className="rounded border border-borde bg-superficie px-2 py-1.5">Bancolombia</span>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-texto-secundario">
                    Total: <strong className="num text-texto-principal">{dinero(totalReserva)}</strong>. El cobro lo procesa Wompi; el SGP no almacena datos de tarjeta.
                  </p>
                  {pagoMensaje && (
                    <p
                      className={`text-xs font-medium ${
                        pagoEstado === 'aprobado'
                          ? 'text-exito'
                          : pagoEstado === 'declinado' || pagoEstado === 'error'
                            ? 'text-error'
                            : 'text-advertencia'
                      }`}
                    >
                      {pagoMensaje}
                    </p>
                  )}
                  <Button
                    onClick={pagarConWompi}
                    disabled={pagoEstado === 'procesando' || pagoEstado === 'aprobado'}
                    className="w-full"
                  >
                    {pagoEstado === 'procesando' ? (
                      <Spinner />
                    ) : pagoEstado === 'declinado' || pagoEstado === 'error' ? (
                      'Reintentar pago en línea'
                    ) : (
                      'Pagar con Wompi'
                    )}
                  </Button>
                  {(pagoEstado === 'esperando' || pagoEstado === 'pendiente') && (
                    <div className="space-y-2 rounded-md border border-borde bg-panel/50 p-3">
                      <label className="block text-[11px] font-medium text-texto-principal">
                        Número de transacción (comprobante de Wompi)
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={transaccionManual}
                          onChange={(evento) => setTransaccionManual(evento.target.value)}
                          placeholder="01-1531231271-19365"
                          className="h-9 w-full rounded-md border border-control bg-superficie px-3 text-xs text-texto-principal focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
                        />
                        <Button
                          variant="secundario"
                          size="sm"
                          onClick={() => verificarPago(transaccionManual.trim())}
                          disabled={!transaccionManual.trim()}
                        >
                          Verificar
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={consultarEstadoPago}
                        className="text-[11px] font-medium text-acento underline-offset-2 hover:underline"
                      >
                        Ya pagué, actualizar estado
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-30 border-t border-borde bg-superficie p-3 md:hidden">
          <Button onClick={irAServicios} disabled={!ubicacionSeleccionada || cargando} className="w-full">
            Continuar con servicios
          </Button>
        </div>
      )}

      {paso === 2 && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-30 border-t border-borde bg-superficie p-3 md:hidden">
          <div className="mb-2 flex items-center justify-between text-[11px] text-texto-secundario">
            <span>{seleccionados.length} servicio(s) · {duracionTotal} min</span>
            <span className="num font-medium text-texto-principal">{dinero(totalServicios)}</span>
          </div>
          <Button onClick={irAEquipo} disabled={seleccionados.length === 0} className="w-full">
            Continuar con equipo
          </Button>
        </div>
      )}

      {paso === 3 && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-30 border-t border-borde bg-superficie p-3 md:hidden">
          <Button onClick={irAHorario} disabled={!equipoListo || cargandoEquipo} className="w-full">
            Continuar con horario
          </Button>
        </div>
      )}

      {paso === 5 && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-30 border-t border-borde bg-superficie p-3 md:hidden">
          <Button onClick={handleCrearReserva} disabled={creando} className="w-full">
            {creando ? <Spinner /> : `Confirmar reserva · ${dinero(totalServicios * cantidad)}`}
          </Button>
        </div>
      )}

      <ModalDetalleServicio
        servicio={detalleServicio}
        abierto={Boolean(detalleServicio)}
        onClose={() => setDetalleServicio(null)}
        seleccionado={Boolean(detalleServicio && seleccionados.some((servicio) => servicio.id === detalleServicio.id))}
        puedeAgregar={Boolean(detalleServicio && (seleccionados.some((servicio) => servicio.id === detalleServicio.id) || seleccionados.length < maxServicios))}
        onToggle={toggleServicio}
      />

      <ModalSedesServicio
        abierto={Boolean(sedesModal)}
        servicio={sedesModal?.servicio}
        sedeActual={ubicacionSeleccionada}
        sedes={sedesModal?.sedes || []}
        cargando={sedesModal?.cargando}
        error={sedesModal?.error}
        seleccionada={sedesModal?.seleccionada}
        cambiando={cambiandoSede}
        onSeleccionar={(id) => setSedesModal((prev) => (prev ? { ...prev, seleccionada: id } : prev))}
        onCambiar={cambiarSedeDesdeModal}
        onQuedarse={quitarServicioDesdeModal}
        onCerrar={() => setSedesModal(null)}
        onReintentar={() => sedesModal?.servicio && abrirSedesModal(sedesModal.servicio)}
      />
    </div>
  );
}
