import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/cliente';
import { useAuth } from '../../hooks/use-auth';
import { Button, Card, Badge, Modal, Toast, Spinner } from '../../componentes/ui/index.jsx';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const ESTADO_COLOR = {
  pendiente: 'default',
  confirmada: 'info',
  en_curso: 'info',
  completada: 'success',
  cobrado: 'success',
  cancelada: 'danger',
};

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  completada: 'Completada',
  cobrado: 'Cobrado',
  cancelada: 'Cancelada',
};

const formatearHoraLocal = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const customMarkerIcon = new L.DivIcon({
  html: `<div style="display: flex; justify-content: center; align-items: center; width: 30px; height: 30px;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B84C3D" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#F5E6E3"/>
      <circle cx="12" cy="10" r="3" fill="#B84C3D"/>
    </svg>
  </div>`,
  className: 'custom-leaflet-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 15);
    }
  }, [lat, lng, map]);
  return null;
}

function ValidarQRModal({ open, onClose, onSuccess, citaPrevia }) {
  const [qrToken, setQrToken] = useState('');
  const [monto, setMonto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const apagarCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
    setErrorCamara('');
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (open && citaPrevia) {
      setQrToken(citaPrevia.qr_token || '');
      const precio = parseFloat(citaPrevia.precio_base || citaPrevia.precio || 0);
      setMonto(citaPrevia.estado === 'confirmada' ? '0' : String(precio));
    } else if (!open) {
      setQrToken('');
      setMonto('');
    }
  }, [open, citaPrevia]);

  const activarCamara = async () => {
    setErrorCamara('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCamaraActiva(true);
    } catch (err) {
      setErrorCamara('No se pudo acceder a la cámara real. Iniciando simulación...');
      setCamaraActiva(true); // Activa el contenedor para simulación
    }
  };

  const toggleCamara = () => {
    if (camaraActiva) {
      apagarCamara();
    } else {
      activarCamara();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    setCargando(true);
    try {
      const data = await api.checkin.validar({ qr_token: qrToken, monto: parseFloat(monto) || 0 });
      setResultado(data);
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Error al validar QR');
    } finally {
      setCargando(false);
    }
  };

  const handleClose = () => {
    apagarCamara();
    setQrToken('');
    setMonto('');
    setResultado(null);
    setError('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Validar ingreso y cobro">
      {resultado ? (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-50 flex items-center justify-center text-exito">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-exito text-lg">Check-in validado</p>
            <p className="text-texto-secundario text-xs mt-1">
              Cliente: <strong className="text-texto-principal">{resultado.cliente_nombre || '—'}</strong>
            </p>
            <p className="text-texto-secundario text-xs">
              Método: <strong className="text-texto-principal">{resultado.metodo_pago || '—'}</strong>
            </p>
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={handleClose}>Cerrar Ventana</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {citaPrevia && (
            <div className="bg-exito/5 rounded-xl p-4 border border-exito/20 text-sm">
              <p className="font-semibold text-exito">
                Cliente: {citaPrevia.cliente_nombre || `${citaPrevia.cliente?.nombre || ''} ${citaPrevia.cliente?.apellido || ''}`.trim() || '—'}
              </p>
              <p className="text-xs text-texto-secundario mt-1">
                {citaPrevia.servicio_nombre || citaPrevia.servicio?.nombre || 'Servicio'} · {formatearHoraLocal(citaPrevia.inicia_en)} - {formatearHoraLocal(citaPrevia.termina_en)}
              </p>
              {citaPrevia.estado === 'confirmada' ? (
                <p className="text-xs text-info font-medium mt-1">Pago online registrado ($0 adicionales)</p>
              ) : (
                <p className="text-xs text-advertencia font-medium mt-1">Pago pendiente en local</p>
              )}
            </div>
          )}

          {camaraActiva && (
            <div className="space-y-2">
              <div className="bg-black rounded-xl overflow-hidden aspect-video relative border border-borde flex flex-col justify-center items-center text-center p-4">
                {streamRef.current ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4 z-10">
                    <span className="text-xs text-white/80">Simulando lectura de cámara...</span>
                  </div>
                )}
                {/* Animación de láser escáner */}
                <div className="w-full h-0.5 bg-red-600 absolute top-1/2 left-0 shadow-[0_0_8px_#EF4444] animate-bounce z-20"></div>
                {!streamRef.current && (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E5DDD3" strokeWidth="1.5" className="opacity-50 z-10">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <rect x="7" y="7" width="4" height="4"/>
                    <rect x="13" y="7" width="4" height="4"/>
                    <rect x="7" y="13" width="4" height="4"/>
                    <rect x="13" y="13" width="4" height="4"/>
                  </svg>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-texto-principal uppercase tracking-wider mb-1.5">Escanear QR o Ingresar Token</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="QR-TOKEN-XXXX"
                className="flex-grow px-3 py-2 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
                required
              />
              <button
                type="button"
                onClick={toggleCamara}
                className="px-3 py-2 bg-fondo border border-borde rounded-lg text-xs font-semibold transition hover:bg-superficie shrink-0"
              >
                {camaraActiva ? 'Apagar' : 'Cámara'}
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-texto-principal uppercase tracking-wider">Cobro en efectivo</label>
              {citaPrevia && (
                <span className="text-[10px] text-texto-secundario">
                  Precio del servicio: ${parseFloat(citaPrevia.precio_base || citaPrevia.precio || 0).toLocaleString()}
                </span>
              )}
            </div>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Monto"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
            />
          </div>

          {error && <p className="text-error text-sm font-semibold">{error}</p>}
          <Button type="submit" disabled={cargando} className="w-full py-3">
            {cargando ? <Spinner /> : 'Confirmar entrada y cobro'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

export default function EmpleadoDashboard() {
  const { usuario } = useAuth();
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalQR, setModalQR] = useState(false);
  const [citaPrevia, setCitaPrevia] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  const [sedeHoy, setSedeHoy] = useState(null);
  const [disponibilidadHoy, setDisponibilidadHoy] = useState(null);
  const [cargandoSede, setCargandoSede] = useState(true);

  const hoy = new Date().toISOString().slice(0, 10);

  const cargarCitas = useCallback(async (fechaFiltro) => {
    setCargando(true);
    setError('');
    try {
      const data = await api.reservas.list({ fecha: fechaFiltro });
      setCitas(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error al cargar las citas');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarSedeHoy = useCallback(async (fechaSeleccionada) => {
    try {
      setCargandoSede(true);
      const [dispData, ubiData] = await Promise.all([
        api.disponibilidad.get().catch(() => []),
        api.ubicaciones.list().catch(() => []),
      ]);

      const dateParts = fechaSeleccionada.split('-').map(Number);
      const targetDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const diaSemanaJS = targetDate.getDay();
      const diaSemana = diaSemanaJS === 0 ? 7 : diaSemanaJS;

      const dispHoy = dispData.find((item) => item.dia_semana === diaSemana);
      setDisponibilidadHoy(dispHoy || null);
      if (dispHoy) {
        const sede = ubiData.find((u) => u.id === dispHoy.ubicacion_id);
        setSedeHoy(sede || null);
      } else {
        setSedeHoy(null);
      }
    } catch (err) {
      console.error('Error al cargar la sede:', err);
    } finally {
      setCargandoSede(false);
    }
  }, []);

  useEffect(() => {
    cargarCitas(fecha);
    cargarSedeHoy(fecha);
  }, [fecha, cargarCitas, cargarSedeHoy]);

  const pendientes = citas.filter((c) => c.estado === 'pendiente' || c.estado === 'confirmada');
  const enCurso = citas.filter((c) => c.estado === 'en_curso');
  const cobrados = citas.filter((c) => c.estado === 'cobrado' || c.estado === 'completada');
  const totalRevenue = citas
    .filter((c) => c.estado === 'cobrado' || c.estado === 'completada')
    .reduce((sum, c) => sum + (parseFloat(c.monto) || parseFloat(c.precio) || 0), 0);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const handleValidarQrSuccess = (data) => {
    mostrarToast('QR validado correctamente');
    cargarCitas(fecha);
    cargarSedeHoy(fecha);
  };

  const handleValidarClick = (cita) => {
    setCitaPrevia(cita);
    setModalQR(true);
  };

  const esHoy = fecha === hoy;

  // Genera el timeline de citas de hoy con slots disponibles
  const timelineCitas = (() => {
    if (!disponibilidadHoy || !disponibilidadHoy.hora_inicio || !disponibilidadHoy.hora_fin) {
      return citas.sort((a, b) => (a.inicia_en || '').localeCompare(b.inicia_en || ''));
    }

    const sortedCitas = [...citas].sort((a, b) => (a.inicia_en || '').localeCompare(b.inicia_en || ''));
    const timeline = [];

    const toMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const toTimeStr = (minutos) => {
      const h = String(Math.floor(minutos / 60) % 24).padStart(2, '0');
      const m = String(minutos % 60).padStart(2, '0');
      return `${h}:${m}`;
    };

    const startMin = toMinutes(disponibilidadHoy.hora_inicio.slice(0, 5));
    const endMin = toMinutes(disponibilidadHoy.hora_fin.slice(0, 5));
    let currentMin = startMin;

    sortedCitas.forEach((cita) => {
      const cStart = new Date(cita.inicia_en);
      const cStartMin = cStart.getHours() * 60 + cStart.getMinutes();
      const cEnd = new Date(cita.termina_en);
      const cEndMin = cEnd.getHours() * 60 + cEnd.getMinutes();

      if (cStartMin > currentMin) {
        timeline.push({
          id: `free-${currentMin}-${cStartMin}`,
          esFree: true,
          hora_inicio: toTimeStr(currentMin),
          hora_fin: toTimeStr(cStartMin),
          duracion_minutos: cStartMin - currentMin,
        });
      }

      timeline.push({
        ...cita,
        hora_inicio: toTimeStr(cStartMin),
        hora_fin: toTimeStr(cEndMin),
        duracion_minutos: cEndMin - cStartMin,
      });

      currentMin = Math.max(currentMin, cEndMin);
    });

    if (currentMin < endMin) {
      timeline.push({
        id: `free-${currentMin}-${endMin}`,
        esFree: true,
        hora_inicio: toTimeStr(currentMin),
        hora_fin: toTimeStr(endMin),
        duracion_minutos: endMin - currentMin,
      });
    }

    return timeline;
  })();

  const getBorderColorClass = (estado) => {
    if (estado === 'pendiente') return 'border-borde';
    if (estado === 'confirmada' || estado === 'en_curso') return 'border-blue-200';
    if (estado === 'cobrado' || estado === 'completada') return 'border-green-200 opacity-75';
    if (estado === 'cancelada') return 'border-red-200';
    return 'border-borde';
  };

  const getHoraTextClass = (estado) => {
    if (estado === 'cobrado' || estado === 'completada') return 'text-texto-secundario';
    return 'text-primario';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-texto-principal">Citas de hoy</h1>
          <p className="text-texto-secundario mt-1">
            {esHoy ? 'Mis reservas de hoy' : `Mis reservas del ${fecha}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-2.5 border border-borde rounded-lg text-texto-principal bg-superficie focus:outline-none focus:ring-2 focus:ring-primario/30 text-sm animate-fade-in"
          />
          <Button onClick={() => setModalQR(true)}>
            Validar QR
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {cargandoSede ? (
            <Card className="flex items-center justify-center py-10">
              <Spinner />
            </Card>
          ) : sedeHoy ? (
            <Card padding={true}>
              <p className="text-sm font-semibold text-texto-secundario mb-2">Sede de hoy</p>
              <div className="h-40 bg-fondo rounded-lg flex items-center justify-center border border-borde overflow-hidden relative mb-3">
                <MapContainer
                  center={[parseFloat(sedeHoy.latitud), parseFloat(sedeHoy.longitud)]}
                  zoom={15}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[parseFloat(sedeHoy.latitud), parseFloat(sedeHoy.longitud)]} icon={customMarkerIcon} />
                  <MapRecenter lat={parseFloat(sedeHoy.latitud)} lng={parseFloat(sedeHoy.longitud)} />
                </MapContainer>
              </div>
              <div>
                <p className="font-semibold text-sm text-texto-principal">{sedeHoy.nombre}</p>
                <p className="text-xs text-texto-secundario mt-0.5">{sedeHoy.direccion}</p>
              </div>
            </Card>
          ) : (
            <Card padding={true}>
              <p className="text-sm font-semibold text-texto-secundario mb-2">Sede de hoy</p>
              <div className="h-40 bg-fondo rounded-lg flex flex-col items-center justify-center border border-borde text-center p-4">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8C7B70" strokeWidth="1.5" className="mb-1 opacity-60">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <p className="font-medium text-xs text-texto-secundario">Sin sede asignada</p>
                <p className="text-[10px] text-texto-secundario/80 mt-0.5">Define tu disponibilidad</p>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="font-display text-lg font-semibold text-texto-principal mb-4">Resumen del día</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-texto-secundario">Pendientes</span>
                <Badge variant="default">{pendientes.length}</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-texto-secundario">En curso</span>
                <Badge variant="info">{enCurso.length}</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-texto-secundario">Cobrados</span>
                <Badge variant="success">{cobrados.length}</Badge>
              </div>
              <div className="border-t border-borde pt-3 mt-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-texto-secundario">Total</span>
                  <p className="font-display text-2xl font-bold text-primario">
                    $ {totalRevenue.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {cargando ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : error ? (
            <Card>
              <p className="text-error text-center">{error}</p>
            </Card>
          ) : timelineCitas.length === 0 ? (
            <Card>
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-fondo flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-texto-secundario">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h3 className="font-display text-lg font-semibold text-texto-principal mb-1">Sin citas</h3>
                <p className="text-texto-secundario text-sm">
                  {esHoy ? 'No hay reservas para el día de hoy.' : `No hay reservas para la fecha ${fecha}.`}
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {timelineCitas.map((cita) => {
                if (cita.esFree) {
                  return (
                    <div
                      key={cita.id}
                      className="bg-fondo rounded-xl border border-dashed border-borde p-4 flex items-center gap-4 transition hover:bg-fondo/80"
                    >
                      <div className="text-center w-16 shrink-0">
                        <p className="font-bold text-lg text-texto-secundario/50">{cita.hora_inicio}</p>
                        <p className="text-xs text-texto-secundario/50">—</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-texto-secundario/50 italic text-sm">Disponible</p>
                        <p className="text-[10px] text-texto-secundario/40 mt-0.5">{cita.duracion_minutos} min libres</p>
                      </div>
                    </div>
                  );
                }

                const horaIni = cita.hora_inicio || formatearHoraLocal(cita.inicia_en);
                const duracion = cita.duracion_minutos || (cita.servicio?.duracion_base_minutos || 30);

                return (
                  <div
                    key={cita.id}
                    className={`bg-superficie rounded-xl border p-4 flex items-center gap-4 shadow-sm transition hover:shadow-md ${getBorderColorClass(cita.estado)}`}
                  >
                    <div className="text-center w-16 shrink-0">
                      <p className={`font-bold text-lg ${getHoraTextClass(cita.estado)}`}>
                        {horaIni}
                      </p>
                      <p className="text-xs text-texto-secundario">{duracion} min</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-texto-principal truncate">
                        {cita.cliente?.nombre || cita.cliente_nombre || '—'}
                      </p>
                      <p className="text-sm text-texto-secundario mt-0.5">
                        {cita.servicio?.nombre || cita.servicio_nombre || 'Sin servicio'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-texto-secundario">
                        {cita.ubicacion?.nombre || cita.ubicacion_nombre || cita.sede ? (
                          <span className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {cita.ubicacion?.nombre || cita.ubicacion_nombre || cita.sede}
                          </span>
                        ) : null}
                        {cita.monto || cita.precio || cita.precio_base || cita.servicio?.precio_base ? (
                          <span className="flex items-center gap-1 font-medium text-exito">
                            $ {parseFloat(cita.monto || cita.precio || cita.precio_base || cita.servicio?.precio_base || 0).toLocaleString('es-CO')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={ESTADO_COLOR[cita.estado] || 'default'}>
                        {ESTADO_LABEL[cita.estado] || cita.estado}
                      </Badge>
                      {(cita.estado === 'pendiente' || cita.estado === 'confirmada') && (
                        <Button
                          variant="primario"
                          size="sm"
                          onClick={() => handleValidarClick(cita)}
                          className="shrink-0"
                        >
                          Validar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ValidarQRModal
        open={modalQR}
        onClose={() => {
          setModalQR(false);
          setCitaPrevia(null);
        }}
        onSuccess={handleValidarQrSuccess}
        citaPrevia={citaPrevia}
      />
    </div>
  );
}
