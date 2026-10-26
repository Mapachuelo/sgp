import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/cliente';
import { useAuth } from '../../hooks/use-auth';
import useWebSocket from '../../hooks/use-websocket.js';
import { Button, Card, Badge, Modal, Toast, Spinner } from '../../componentes/ui/index.jsx';
import PagoReservaModal from '../../componentes/pagos/pago-reserva-modal.jsx';
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

const formatearFechaLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatearHoraLocal = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const estaPagada = (cita) =>
  cita?.pago_estado === 'aprobado' || Boolean(cita?.cobro_metodo);

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

function LlegadaQRModal({ open, onClose, onSuccess, qrInicial = '' }) {
  const [qrToken, setQrToken] = useState(qrInicial || '');
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
    if (open) {
      setQrToken(qrInicial || '');
      setResultado(null);
      setError('');
    } else {
      apagarCamara();
      setQrToken('');
      setResultado(null);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qrInicial]);

  useEffect(() => () => apagarCamara(), [apagarCamara]);

  const activarCamara = async () => {
    setErrorCamara('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamaraActiva(true);
    } catch {
      setErrorCamara('No se pudo acceder a la camara. Ingresa el token manualmente.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    setCargando(true);
    try {
      const data = await api.checkin.llegada(qrToken.trim());
      setResultado(data);
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Error al registrar la llegada');
    } finally {
      setCargando(false);
    }
  };

  const cerrar = () => {
    apagarCamara();
    onClose?.();
  };

  return (
    <Modal open={open} onClose={cerrar} title="Registrar llegada">
      {resultado ? (
        <div className="text-center py-5 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center text-exito">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="font-semibold text-exito text-lg">Llegada registrada</p>
          <p className="text-xs text-texto-secundario">
            Cliente: <strong className="text-texto-principal">{resultado.cliente_nombre || '—'}</strong>
          </p>
          <p className="text-xs text-texto-secundario">
            {resultado.servicio_nombre || 'Servicio'} · {formatearHoraLocal(resultado.inicia_en)}
          </p>
          <Badge variant={resultado.pagado ? 'success' : 'warning'}>
            {resultado.pagado ? 'Pagado' : 'Pago pendiente'}
          </Badge>
          <Button className="w-full" onClick={cerrar}>Cerrar</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {camaraActiva && (
            <div className="bg-black rounded-xl overflow-hidden aspect-video relative border border-borde">
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
              <div className="w-full h-0.5 bg-red-600 absolute top-1/2 left-0 shadow-[0_0_8px_#EF4444] animate-bounce z-20" />
            </div>
          )}
          {errorCamara && <p className="text-xs text-advertencia">{errorCamara}</p>}
          <div>
            <label className="block text-xs font-semibold text-texto-principal uppercase tracking-wider mb-1.5">
              Token QR de la reserva
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="00000000-0000-4000-8000-000000000000"
                className="flex-grow px-3 py-2 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
                required
              />
              <button
                type="button"
                onClick={() => (camaraActiva ? apagarCamara() : activarCamara())}
                className="px-3 py-2 bg-fondo border border-borde rounded-lg text-xs font-semibold transition hover:bg-superficie shrink-0"
              >
                {camaraActiva ? 'Apagar' : 'Camara'}
              </button>
            </div>
          </div>
          {error && <p className="text-error text-sm font-semibold">{error}</p>}
          <Button type="submit" disabled={cargando} className="w-full py-3">
            {cargando ? <Spinner /> : 'Registrar llegada'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

function CobroEfectivoModal({ open, cita, onClose, onSuccess, onToast }) {
  const [monto, setMonto] = useState('');
  const [cargando, setCargando] = useState(false);

  const total = cita ? Number(cita.precio_base || 0) * Number(cita.cantidad_personas || 1) : 0;

  useEffect(() => {
    if (open && cita) setMonto(String(total || ''));
  }, [open, cita, total]);

  const cobrar = async () => {
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) {
      onToast?.('Ingresa un monto mayor a 0', 'warning');
      return;
    }
    setCargando(true);
    try {
      await api.checkin.cobroEfectivo(cita.id, valor);
      onToast?.('Cobro en efectivo registrado');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cobro en efectivo">
      {cita && (
        <div className="space-y-4">
          <div className="rounded-xl border border-borde bg-fondo/40 p-3 text-sm">
            <p className="font-semibold text-texto-principal">{cita.cliente_nombre || 'Cliente'}</p>
            <p className="text-xs text-texto-secundario mt-1">
              {cita.servicio_nombre || 'Servicio'} · Total ${total.toLocaleString('es-CO')}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-texto-principal uppercase mb-1">Monto recibido</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-3 py-2 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </div>
          <Button className="w-full" onClick={cobrar} disabled={cargando}>
            {cargando ? <Spinner /> : 'Registrar cobro'}
          </Button>
        </div>
      )}
    </Modal>
  );
}

export default function EmpleadoDashboard() {
  const { usuario } = useAuth();
  const { ultimoEvento } = useWebSocket();
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalQR, setModalQR] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [pagoReserva, setPagoReserva] = useState(null);
  const [cobroEfectivoCita, setCobroEfectivoCita] = useState(null);
  const [fecha, setFecha] = useState(formatearFechaLocal(new Date()));

  const fechaRef = useRef(fecha);
  useEffect(() => { fechaRef.current = fecha; }, [fecha]);

  useEffect(() => {
    if (!ultimoEvento) return;
    if (ultimoEvento.tipo === 'reserva.actualizada') {
      const f = fechaRef.current;
      cargarCitas(f);
      cargarSedeHoy(f);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoEvento]);

  const [sedeHoy, setSedeHoy] = useState(null);
  const [disponibilidadHoy, setDisponibilidadHoy] = useState(null);
  const [cargandoSede, setCargandoSede] = useState(true);

  const hoy = formatearFechaLocal(new Date());

  const cambiarDia = (offset) => {
    const d = new Date(fecha + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setFecha(formatearFechaLocal(d));
  };

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
  const enAtencion = enCurso[0] || null;
  const enEspera = citas
    .filter((c) => c.llego_en && !['en_curso', 'cobrado', 'cancelada'].includes(c.estado))
    .sort((a, b) => new Date(a.inicia_en) - new Date(b.inicia_en));
  const programados = citas
    .filter((c) => !c.llego_en && ['pendiente', 'confirmada'].includes(c.estado))
    .sort((a, b) => new Date(a.inicia_en) - new Date(b.inicia_en));
  const siguientes = enEspera.length > 0 ? enEspera : programados;
  const totalRevenue = citas
    .filter((c) => c.estado === 'cobrado' || c.estado === 'completada')
    .reduce((sum, c) => sum + (parseFloat(c.monto) || parseFloat(c.precio) || 0), 0);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const refrescar = () => {
    cargarCitas(fecha);
    cargarSedeHoy(fecha);
  };

  const handleValidarQrSuccess = () => {
    mostrarToast('Llegada registrada correctamente');
    refrescar();
  };

  const handleRegistrarLlegada = async (cita) => {
    try {
      await api.checkin.llegada(cita.qr_token);
      mostrarToast(`Llegada registrada: ${cita.cliente_nombre || 'cliente'}`);
      refrescar();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  };

  const handleAtender = async (cita) => {
    if (!estaPagada(cita)) {
      setPagoReserva(cita);
      mostrarToast('Primero registra el pago por QR o en efectivo', 'warning');
      return;
    }
    try {
      await api.checkin.iniciar(cita.id);
      mostrarToast('Servicio iniciado');
      refrescar();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  };

  const handleFinalizar = async (cita) => {
    if (!window.confirm(`¿Finalizar el servicio de ${cita.cliente_nombre || 'este cliente'}?`)) return;
    try {
      await api.checkin.finalizar(cita.id);
      mostrarToast('Servicio finalizado. Puedes atender al siguiente cliente.');
      refrescar();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
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
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => cambiarDia(-1)}
            className="px-3 py-2.5 border border-borde rounded-lg text-texto-principal bg-superficie hover:bg-fondo text-sm font-semibold transition cursor-pointer"
            title="Día anterior"
          >
            ←
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-2.5 border border-borde rounded-lg text-texto-principal bg-superficie focus:outline-none focus:ring-2 focus:ring-primario/30 text-sm"
          />
          <button
            type="button"
            onClick={() => cambiarDia(1)}
            className="px-3 py-2.5 border border-borde rounded-lg text-texto-principal bg-superficie hover:bg-fondo text-sm font-semibold transition cursor-pointer"
            title="Día siguiente"
          >
            →
          </button>
          <Button className="w-full sm:w-auto" onClick={() => setModalQR(true)}>
            Escanear QR
          </Button>
          <Button className="w-full sm:w-auto" variant="secundario" onClick={refrescar}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 order-2 lg:order-1 space-y-4">
          {cargandoSede ? (
            <Card className="flex items-center justify-center py-10">
              <Spinner />
            </Card>
          ) : sedeHoy ? (
            <Card padding={true}>
              <p className="text-sm font-semibold text-texto-secundario mb-2">Sede de hoy</p>
              <div className="h-40 bg-fondo rounded-lg flex items-center justify-center border border-borde overflow-hidden relative z-0 isolate mb-3">
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

        <div className="lg:col-span-3 order-1 lg:order-2">
          {!cargando && !error && (
            <div className="space-y-3 mb-5">
              <Card padding={true} className="border-l-4 border-l-primario">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-texto-principal">Cola de atencion</h2>
                    <p className="text-xs text-texto-secundario">
                      {enEspera.length} en espera · {programados.length} programados
                    </p>
                  </div>
                  {siguientes[0] && (
                    <Badge variant="info">
                      Siguiente: {siguientes[0].cliente_nombre || 'cliente'} · {formatearHoraLocal(siguientes[0].inicia_en)}
                    </Badge>
                  )}
                </div>

                {enAtencion ? (
                  <div className="rounded-xl border border-info/30 bg-info/5 p-3 mb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-info">En atencion</p>
                        <p className="font-semibold text-texto-principal">{enAtencion.cliente_nombre || 'Cliente'}</p>
                        <p className="text-xs text-texto-secundario">
                          {enAtencion.servicio_nombre || 'Servicio'} · inicio {formatearHoraLocal(enAtencion.inicio_servicio)}
                        </p>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => handleFinalizar(enAtencion)}>
                        Finalizar servicio
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-texto-secundario mb-3">No hay un servicio en curso.</p>
                )}

                {enEspera.length === 0 ? (
                  <p className="text-xs text-texto-secundario">
                    No hay clientes en espera. Cuando llegue el siguiente, escanea su QR.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {enEspera.map((cita) => {
                      const pagada = estaPagada(cita);
                      return (
                        <div
                          key={cita.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-borde bg-superficie p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-texto-principal truncate">
                              {cita.cliente_nombre || 'Cliente'}
                            </p>
                            <p className="text-xs text-texto-secundario">
                              {formatearHoraLocal(cita.inicia_en)} · {cita.servicio_nombre || 'Servicio'} · llegó {formatearHoraLocal(cita.llego_en)}
                            </p>
                          </div>
                          <Badge variant={pagada ? 'success' : 'warning'}>
                            {pagada ? 'Pagado' : 'Pago pendiente'}
                          </Badge>
                          {pagada ? (
                            <Button size="sm" onClick={() => handleAtender(cita)}>Atender</Button>
                          ) : (
                            <>
                              <Button size="sm" onClick={() => setPagoReserva(cita)}>Cobrar QR</Button>
                              <Button variant="outline" size="sm" onClick={() => setCobroEfectivoCita(cita)}>Efectivo</Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {programados.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs font-semibold text-primario cursor-pointer">
                      Ver citas programadas ({programados.length})
                    </summary>
                    <div className="space-y-2 mt-2">
                      {programados.map((cita) => (
                        <div key={cita.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-borde/70 bg-fondo/40 p-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-texto-principal truncate">{cita.cliente_nombre || 'Cliente'}</p>
                            <p className="text-xs text-texto-secundario">
                              {formatearHoraLocal(cita.inicia_en)} · {cita.servicio_nombre || 'Servicio'}
                            </p>
                          </div>
                          <Badge variant={estaPagada(cita) ? 'success' : 'warning'}>
                            {estaPagada(cita) ? 'Pagado' : 'Pago pendiente'}
                          </Badge>
                          <Button variant="outline" size="sm" onClick={() => handleRegistrarLlegada(cita)}>
                            Registrar llegada
                          </Button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Card>
            </div>
          )}

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
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
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
                    className={`bg-superficie rounded-xl border p-4 flex flex-wrap items-center gap-3 sm:gap-4 shadow-sm transition hover:shadow-md ${getBorderColorClass(cita.estado)}`}
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
                    <div className="flex flex-wrap items-center gap-2 shrink-0 ml-auto">
                      <Badge variant={estaPagada(cita) ? 'success' : 'warning'}>
                        {estaPagada(cita) ? 'Pagado' : 'Pago pendiente'}
                      </Badge>
                      <Badge variant={ESTADO_COLOR[cita.estado] || 'default'}>
                        {ESTADO_LABEL[cita.estado] || cita.estado}
                      </Badge>
                      {(cita.estado === 'pendiente' || cita.estado === 'confirmada') && !cita.llego_en && (
                        <Button variant="primario" size="sm" onClick={() => handleRegistrarLlegada(cita)} className="shrink-0">
                          Registrar llegada
                        </Button>
                      )}
                      {(cita.estado === 'pendiente' || cita.estado === 'confirmada') && cita.llego_en && !estaPagada(cita) && (
                        <>
                          <Button size="sm" onClick={() => setPagoReserva(cita)}>Cobrar QR</Button>
                          <Button variant="outline" size="sm" onClick={() => setCobroEfectivoCita(cita)}>Efectivo</Button>
                        </>
                      )}
                      {(cita.estado === 'pendiente' || cita.estado === 'confirmada') && cita.llego_en && estaPagada(cita) && (
                        <Button size="sm" onClick={() => handleAtender(cita)}>Atender</Button>
                      )}
                      {cita.estado === 'en_curso' && (
                        <Button variant="danger" size="sm" onClick={() => handleFinalizar(cita)}>Finalizar</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <LlegadaQRModal
        open={modalQR}
        onClose={() => setModalQR(false)}
        onSuccess={handleValidarQrSuccess}
      />

      <PagoReservaModal
        open={Boolean(pagoReserva)}
        reservaId={pagoReserva?.id}
        modo="qr"
        onClose={() => setPagoReserva(null)}
        onPagado={refrescar}
        onToast={mostrarToast}
      />

      <CobroEfectivoModal
        open={Boolean(cobroEfectivoCita)}
        cita={cobroEfectivoCita}
        onClose={() => setCobroEfectivoCita(null)}
        onSuccess={refrescar}
        onToast={mostrarToast}
      />
    </div>
  );
}
