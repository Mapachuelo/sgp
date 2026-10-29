import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  Check,
  Clock3,
  MapPin,
  QrCode,
  RefreshCw,
  ScanLine,
  Users,
} from 'lucide-react';
import { toast as notificar } from 'sonner';
import api from '../../api/cliente';
import { useAuth } from '../../hooks/use-auth';
import useWebSocket from '../../hooks/use-websocket.js';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Spinner,
  StatusPill,
} from '../../componentes/ui/index.jsx';
import CobroCitaSheet from '../../componentes/pagos/cobro-cita-sheet.jsx';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  en_curso: 'En servicio',
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

const estaPagada = (cita) => cita?.pago_estado === 'aprobado' || Boolean(cita?.cobro_metodo);

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

const plural = (cantidad, singular, plural) => `${cantidad} ${cantidad === 1 ? singular : plural}`;

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

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

function minutosDesde(iso) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function LlegadaQRModal({ open, onClose, onSuccess, qrInicial = '' }) {
  const [qrToken, setQrToken] = useState(qrInicial || '');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const escaneoRef = useRef(null);
  const detectadoRef = useRef(false);

  const apagarCamara = useCallback(() => {
    if (escaneoRef.current) {
      clearInterval(escaneoRef.current);
      escaneoRef.current = null;
    }
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
      detectadoRef.current = false;
    } else {
      apagarCamara();
      setQrToken('');
      setResultado(null);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qrInicial]);

  useEffect(() => () => apagarCamara(), [apagarCamara]);

  const enviar = useCallback(
    async (token) => {
      if (!token || detectadoRef.current) return;
      detectadoRef.current = true;
      setCargando(true);
      setError('');
      try {
        const data = await api.checkin.llegada(token.trim());
        setResultado(data);
        apagarCamara();
        onSuccess?.(data);
      } catch (err) {
        setError(err.message || 'No se pudo registrar la llegada');
        detectadoRef.current = false;
      } finally {
        setCargando(false);
      }
    },
    [apagarCamara, onSuccess]
  );

  const activarCamara = async () => {
    setErrorCamara('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamaraActiva(true);
      detectadoRef.current = false;
      escaneoRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;
        const ancho = video.videoWidth;
        const alto = video.videoHeight;
        if (!ancho || !alto) return;
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, ancho, alto);
        const imagen = ctx.getImageData(0, 0, ancho, alto);
        const codigo = jsQR(imagen.data, ancho, alto, { inversionAttempts: 'dontInvert' });
        if (codigo?.data) {
          setQrToken(codigo.data);
          enviar(codigo.data);
        }
      }, 350);
    } catch {
      setErrorCamara('No se pudo acceder a la cámara. Ingresa el token manualmente.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    enviar(qrToken);
  };

  const cerrar = () => {
    apagarCamara();
    onClose?.();
  };

  return (
    <Modal open={open} onClose={cerrar} title="Registrar llegada" size="normal">
      {resultado ? (
        <div className="py-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-exito/10 text-exito">
            <Check className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
          </div>
          <p className="mt-3 text-lg font-semibold text-texto-principal">Llegada registrada</p>
          <p className="mt-1 text-sm text-texto-secundario">{resultado.cliente_nombre || 'Cliente'}</p>
          <p className="mt-0.5 text-xs text-texto-secundario">
            {resultado.servicio_nombre || 'Servicio'} · {formatearHoraLocal(resultado.inicia_en)}
          </p>
          <div className="mt-3 flex justify-center">
            <Badge variant={resultado.pagado ? 'success' : 'warning'}>
              {resultado.pagado ? 'Pagado' : 'Pago pendiente'}
            </Badge>
          </div>
          <Button className="mt-5 w-full" onClick={cerrar}>
            Cerrar
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative overflow-hidden rounded-lg border border-borde bg-black" style={{ aspectRatio: '4 / 3' }}>
            {camaraActiva ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-40 w-40 rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                <div className="absolute inset-x-0 bottom-3 flex justify-center">
                  <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-white">Apunta al QR del cliente</span>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-white/70">
                <ScanLine className="h-9 w-9" strokeWidth={1.4} aria-hidden="true" />
                <p className="text-xs">Activa la cámara o ingresa el token</p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {errorCamara && <p className="text-xs text-advertencia">{errorCamara}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={camaraActiva ? 'secundario' : 'primario'} onClick={() => (camaraActiva ? apagarCamara() : activarCamara())}>
              {camaraActiva ? <CameraOff className="h-4 w-4" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
              {camaraActiva ? 'Apagar cámara' : 'Activar cámara'}
            </Button>
            <span className="flex items-center text-[11px] text-tenue">o usa el token manual</span>
          </div>

          <Input
            label="Token QR de la reserva"
            value={qrToken}
            onChange={(e) => setQrToken(e.target.value)}
            placeholder="00000000-0000-4000-8000-000000000000"
            autoComplete="off"
            spellCheck={false}
          />

          {error && (
            <p className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={cargando || !qrToken.trim()}>
            {cargando ? <Spinner /> : 'Registrar llegada'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

export default function EmpleadoDashboard({ vista = 'cola' }) {
  const { usuario } = useAuth();
  const { ultimoEvento } = useWebSocket();
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalQR, setModalQR] = useState(false);
  const [cobroCita, setCobroCita] = useState(null);
  const [finalizarCita, setFinalizarCita] = useState(null);
  const [finalizando, setFinalizando] = useState(false);
  const [fecha, setFecha] = useState(formatearFechaLocal(new Date()));
  const [, setReloj] = useState(Date.now());

  const fechaRef = useRef(fecha);
  useEffect(() => {
    fechaRef.current = fecha;
  }, [fecha]);

  useEffect(() => {
    const intervalo = setInterval(() => setReloj(Date.now()), 30000);
    return () => clearInterval(intervalo);
  }, []);

  const [sedeHoy, setSedeHoy] = useState(null);
  const [disponibilidadHoy, setDisponibilidadHoy] = useState(null);
  const [cargandoSede, setCargandoSede] = useState(true);

  const hoy = formatearFechaLocal(new Date());
  const esHoy = fecha === hoy;

  const cambiarDia = (offset) => {
    const d = new Date(`${fecha}T00:00:00`);
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
        setSedeHoy(ubiData.find((u) => u.id === dispHoy.ubicacion_id) || null);
      } else {
        setSedeHoy(null);
      }
    } catch {
      setSedeHoy(null);
    } finally {
      setCargandoSede(false);
    }
  }, []);

  useEffect(() => {
    cargarCitas(fecha);
    cargarSedeHoy(fecha);
  }, [fecha, cargarCitas, cargarSedeHoy]);

  useEffect(() => {
    if (!ultimoEvento) return;
    if (ultimoEvento.tipo === 'reserva.actualizada') {
      cargarCitas(fechaRef.current);
      cargarSedeHoy(fechaRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoEvento]);

  const pendientes = citas.filter((c) => ['pendiente', 'confirmada'].includes(c.estado));
  const enCurso = citas.filter((c) => c.estado === 'en_curso');
  const cobrados = citas.filter((c) => ['cobrado', 'completada'].includes(c.estado));
  const enAtencion = enCurso[0] || null;
  const enEspera = citas
    .filter((c) => c.llego_en && !['en_curso', 'cobrado', 'completada', 'cancelada'].includes(c.estado))
    .sort((a, b) => new Date(a.mi_inicia_en || a.inicia_en) - new Date(b.mi_inicia_en || b.inicia_en));
  const programados = citas
    .filter((c) => !c.llego_en && ['pendiente', 'confirmada'].includes(c.estado))
    .sort((a, b) => new Date(a.mi_inicia_en || a.inicia_en) - new Date(b.mi_inicia_en || b.inicia_en));
  const siguientes = enEspera.length > 0 ? enEspera : programados;
  const totalRevenue = cobrados.reduce(
    (sum, c) => sum + (parseFloat(c.monto) || parseFloat(c.precio) || parseFloat(c.precio_total) || parseFloat(c.precio_base) || 0),
    0
  );

  const refrescar = () => {
    cargarCitas(fecha);
    cargarSedeHoy(fecha);
  };

  const handleRegistrarLlegada = async (cita) => {
    try {
      await api.checkin.llegada(cita.qr_token);
      notificar.success(`Llegada registrada: ${cita.cliente_nombre || 'cliente'}`);
      refrescar();
    } catch (err) {
      notificar.error(err.message);
    }
  };

  const handleAtender = async (cita) => {
    if (!estaPagada(cita)) {
      setCobroCita(cita);
      notificar.warning('Primero registra el pago de la cita');
      return;
    }
    try {
      await api.checkin.iniciar(cita.id);
      notificar.success('Servicio iniciado');
      refrescar();
    } catch (err) {
      notificar.error(err.message);
    }
  };

  const confirmarFinalizar = async () => {
    if (!finalizarCita) return;
    setFinalizando(true);
    try {
      await api.checkin.finalizar(finalizarCita.id);
      notificar.success('Servicio finalizado. Puedes atender al siguiente cliente.');
      setFinalizarCita(null);
      refrescar();
    } catch (err) {
      notificar.error(err.message);
    } finally {
      setFinalizando(false);
    }
  };

  const timelineCitas = (() => {
    if (!disponibilidadHoy?.hora_inicio || !disponibilidadHoy?.hora_fin) {
      return [...citas].sort((a, b) => (a.mi_inicia_en || a.inicia_en || '').localeCompare(b.mi_inicia_en || b.inicia_en || ''));
    }
    const sortedCitas = [...citas].sort((a, b) => (a.mi_inicia_en || a.inicia_en || '').localeCompare(b.mi_inicia_en || b.inicia_en || ''));
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
      const cStart = new Date(cita.mi_inicia_en || cita.inicia_en);
      const cStartMin = cStart.getHours() * 60 + cStart.getMinutes();
      const cEnd = new Date(cita.mi_termina_en || cita.termina_en);
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

  const fechaLarga = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${fecha}T00:00:00`));

  const esVistaAgenda = vista === 'agenda';

  const CitaRow = ({ cita, compacta = false }) => {
    const pagada = estaPagada(cita);
    const espera = minutosDesde(cita.llego_en);
    const inicioCita = new Date(cita.mi_inicia_en || cita.inicia_en);
    const ventanaDesde = new Date(inicioCita.getTime() - 30 * 60000);
    const puedeAtender = Date.now() >= ventanaDesde.getTime();
    const horaVentana = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(ventanaDesde);
    return (
      <div className={`rounded-lg border border-borde bg-superficie ${compacta ? 'px-3 py-2.5' : 'p-3.5'}`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-12 shrink-0 text-center">
            <p className="num text-base font-semibold leading-tight text-texto-principal">{formatearHoraLocal(cita.mi_inicia_en || cita.inicia_en)}</p>
            <p className="mt-0.5 text-[10px] text-tenue">{(cita.mi_duracion_minutos || cita.duracion_minutos || 30)} min</p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-texto-principal">{cita.cliente_nombre || 'Cliente'}</p>
              <StatusPill estado={cita.estado}>{ESTADO_LABEL[cita.estado] || cita.estado}</StatusPill>
              {!pagada && <Badge variant="warning">Sin pago</Badge>}
            </div>
            <p className="mt-0.5 truncate text-xs text-texto-secundario">
              {cita.mis_servicios || cita.servicio_nombre || 'Servicio'} · {cita.ubicacion_nombre || 'Sede'}
            </p>
            {cita.llego_en && (
              <p className="mt-1 text-[11px] text-tenue">
                Llegó {formatearHoraLocal(cita.llego_en)}
                {espera != null ? ` · ${espera} min de espera` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {['cobrado', 'completada', 'cancelada'].includes(cita.estado) ? null : cita.estado === 'en_curso' ? (
              <Button variant="danger" size="sm" onClick={() => setFinalizarCita(cita)}>
                Finalizar
              </Button>
            ) : cita.llego_en && pagada ? (
              <div className="flex flex-col items-end gap-1">
                {!puedeAtender && (
                  <span className="text-[10px] text-tenue">Disponible desde {horaVentana}</span>
                )}
                <Button size="sm" onClick={() => handleAtender(cita)} disabled={!puedeAtender} title={!puedeAtender ? `Podrás atender desde ${horaVentana}` : undefined}>
                  Atender
                </Button>
              </div>
            ) : cita.llego_en && !pagada ? (
              <Button size="sm" onClick={() => setCobroCita(cita)}>
                Cobrar
              </Button>
            ) : (
              <Button variant="secundario" size="sm" onClick={() => handleRegistrarLlegada(cita)}>
                Registrar llegada
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const header = (
    <PageHeader
      title={esVistaAgenda ? 'Mi agenda' : 'Cola de hoy'}
      subtitle={`${fechaLarga} · ${plural(citas.length, 'cita', 'citas')} · ${enEspera.length} en espera · ${enCurso.length} en servicio`}
      actions={
        <>
          <div className="flex items-center gap-1 rounded-md border border-borde bg-superficie p-0.5">
            <Button variant="ghost" size="sm" onClick={() => cambiarDia(-1)} aria-label="Día anterior">
              ←
            </Button>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-8 rounded border-0 bg-transparent px-1 text-xs text-texto-principal focus:outline-none"
              aria-label="Fecha"
            />
            <Button variant="ghost" size="sm" onClick={() => cambiarDia(1)} aria-label="Día siguiente">
              →
            </Button>
          </div>
          <Button variant="secundario" size="sm" onClick={refrescar} aria-label="Actualizar">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          {!esVistaAgenda && (
            <Button size="sm" onClick={() => setModalQR(true)}>
              <QrCode className="h-4 w-4" aria-hidden="true" /> Escanear QR
            </Button>
          )}
        </>
      }
    />
  );

  if (cargando) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <p className="text-sm text-error">{error}</p>
          <Button variant="secundario" size="sm" className="mt-3" onClick={refrescar}>
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-borde bg-superficie px-4 py-3">
          <p className="text-[11px] text-texto-secundario">En servicio</p>
          <p className="num mt-1 text-2xl font-medium text-texto-principal">{enCurso.length}</p>
        </div>
        <div className="rounded-lg border border-borde bg-superficie px-4 py-3">
          <p className="text-[11px] text-texto-secundario">En espera</p>
          <p className="num mt-1 text-2xl font-medium text-texto-principal">{enEspera.length}</p>
        </div>
        <div className="rounded-lg border border-borde bg-superficie px-4 py-3">
          <p className="text-[11px] text-texto-secundario">Programadas</p>
          <p className="num mt-1 text-2xl font-medium text-texto-principal">{programados.length}</p>
        </div>
        <div className="rounded-lg border border-borde bg-superficie px-4 py-3">
          <p className="text-[11px] text-texto-secundario">Cobrado hoy</p>
          <p className="num mt-1 text-2xl font-medium text-texto-principal">{dinero(totalRevenue)}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {!esVistaAgenda && (
            <>
              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-texto-principal">Ahora</h2>
                    <p className="mt-0.5 text-xs text-texto-secundario">
                      {enAtencion ? 'Servicio en curso' : 'Sin servicio en curso'}
                    </p>
                  </div>
                  {siguientes[0] && !enAtencion && (
                    <Badge variant="accent">
                      Siguiente: {siguientes[0].cliente_nombre || 'cliente'} · {formatearHoraLocal(siguientes[0].mi_inicia_en || siguientes[0].inicia_en)}
                    </Badge>
                  )}
                </div>

                {enAtencion ? (
                  <div className="rounded-xl border border-acento/30 bg-acento-suave/50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-medium text-acento-tinta">En servicio</p>
                        <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-texto-principal">
                          {enAtencion.cliente_nombre || 'Cliente'}
                        </p>
                        <p className="mt-1 text-sm text-texto-secundario">
                          {enAtencion.mis_servicios || enAtencion.servicio_nombre || 'Servicio'} · {formatearHoraLocal(enAtencion.mi_inicia_en || enAtencion.inicia_en)}
                        </p>
                        <p className="mt-2 text-xs text-texto-secundario">
                          Inició {formatearHoraLocal(enAtencion.inicio_servicio)}
                          {minutosDesde(enAtencion.inicio_servicio) != null
                            ? ` · ${minutosDesde(enAtencion.inicio_servicio)} min`
                            : ''}
                        </p>
                      </div>
                      <Button variant="danger" onClick={() => setFinalizarCita(enAtencion)}>
                        Terminar servicio
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No hay un servicio en curso"
                    description="Cuando llegue el siguiente cliente, escanea su QR o regístralo desde la lista de espera."
                    action={
                      <Button size="sm" onClick={() => setModalQR(true)}>
                        <QrCode className="h-4 w-4" aria-hidden="true" /> Escanear QR
                      </Button>
                    }
                  />
                )}
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-texto-principal">En espera</h2>
                    <p className="mt-0.5 text-xs text-texto-secundario">
                      {enEspera.length === 0
                        ? 'Nadie esperando ahora.'
                        : `${plural(enEspera.length, 'cliente listo', 'clientes listos')} para entrar.`}
                    </p>
                  </div>
                </div>
                {enEspera.length === 0 ? (
                  <EmptyState
                    title="La sala está despejada"
                    description="La próxima cita aparece en programadas. Escanea el QR al llegar."
                  />
                ) : (
                  <div className="space-y-2">
                    {enEspera.map((cita) => (
                      <CitaRow key={cita.id} cita={cita} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-texto-principal">Programadas</h2>
                    <p className="mt-0.5 text-xs text-texto-secundario">Las siguientes citas del día.</p>
                  </div>
                </div>
                {programados.length === 0 ? (
                  <EmptyState title="No quedan citas programadas" description="El día está completo o no hay más reservas." />
                ) : (
                  <div className="space-y-2">
                    {programados.slice(0, 6).map((cita) => (
                      <CitaRow key={cita.id} cita={cita} compacta />
                    ))}
                    {programados.length > 6 && (
                      <p className="pt-1 text-center text-[11px] text-tenue">+{programados.length - 6} citas más en la agenda</p>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {esVistaAgenda && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-texto-principal">Día completo</h2>
                <p className="mt-0.5 text-xs text-texto-secundario">Citas y espacios libres entre la apertura y el cierre.</p>
              </div>
            </div>

            {timelineCitas.length === 0 ? (
              <EmptyState
                title="Sin citas para este día"
                description={esHoy ? 'Hoy no hay reservas registradas.' : `No hay reservas para el ${fecha}.`}
              />
            ) : (
              <div className="relative space-y-2 pl-5">
                <div className="absolute bottom-2 left-[7px] top-2 w-px bg-borde" aria-hidden="true" />
                {timelineCitas.map((cita) => {
                  if (cita.esFree) {
                    return (
                      <div key={cita.id} className="relative rounded-md border border-dashed border-control bg-panel/40 px-3 py-2">
                        <span className="absolute -left-[18px] top-4 h-2 w-2 rounded-full border border-control bg-superficie" aria-hidden="true" />
                        <div className="flex items-center gap-3">
                          <p className="num w-12 text-xs text-tenue">{cita.hora_inicio}</p>
                          <p className="text-xs text-tenue">Disponible · {cita.duracion_minutos} min</p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={cita.id} className="relative">
                      <span
                        className={`absolute -left-[18px] top-4 h-2 w-2 rounded-full ${
                          cita.estado === 'en_curso' ? 'bg-acento' : cita.llego_en ? 'bg-advertencia' : 'border border-control bg-superficie'
                        }`}
                        aria-hidden="true"
                      />
                      <CitaRow cita={cita} compacta />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          )}
        </div>

        <aside className="space-y-4">
          {cargandoSede ? (
            <Card className="flex justify-center py-8">
              <Spinner />
            </Card>
          ) : sedeHoy ? (
            <Card padding={false} className="overflow-hidden">
              <div className="relative z-0 h-36 bg-panel">
                {Number.isFinite(Number(sedeHoy.latitud)) && Number.isFinite(Number(sedeHoy.longitud)) ? (
                  <MapContainer
                    center={[parseFloat(sedeHoy.latitud), parseFloat(sedeHoy.longitud)]}
                    zoom={15}
                    scrollWheelZoom={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[parseFloat(sedeHoy.latitud), parseFloat(sedeHoy.longitud)]} icon={customMarkerIcon} />
                    <MapRecenter lat={parseFloat(sedeHoy.latitud)} lng={parseFloat(sedeHoy.longitud)} />
                  </MapContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-tenue">Sin coordenadas</div>
                )}
              </div>
              <div className="p-4">
                <p className="text-[11px] text-tenue">Sede de hoy</p>
                <p className="mt-0.5 text-sm font-medium text-texto-principal">{sedeHoy.nombre}</p>
                <p className="mt-0.5 text-xs leading-5 text-texto-secundario">{sedeHoy.direccion}</p>
                <p className="mt-2 text-[11px] text-tenue">
                  {disponibilidadHoy?.hora_inicio?.slice(0, 5)}–{disponibilidadHoy?.hora_fin?.slice(0, 5)}
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-[11px] text-tenue">Sede de hoy</p>
              <p className="mt-1 text-sm font-medium text-texto-principal">Sin sede asignada</p>
              <p className="mt-1 text-xs leading-5 text-texto-secundario">Revisa tu disponibilidad para este día.</p>
            </Card>
          )}

          <Card>
            <p className="text-[11px] text-tenue">Resumen del día</p>
            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-texto-secundario">Pendientes</span>
                <span className="num font-medium text-texto-principal">{pendientes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-texto-secundario">En servicio</span>
                <span className="num font-medium text-texto-principal">{enCurso.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-texto-secundario">Cobrados</span>
                <span className="num font-medium text-texto-principal">{cobrados.length}</span>
              </div>
              <div className="flex items-center justify-between border-t border-borde pt-2.5">
                <span className="text-texto-secundario">Total</span>
                <span className="num font-medium text-texto-principal">{dinero(totalRevenue)}</span>
              </div>
            </div>
          </Card>

          <div className="rounded-lg border border-borde bg-panel/60 p-4">
            <p className="text-[11px] text-tenue">Sesión</p>
            <p className="mt-1 text-sm font-medium text-texto-principal">
              {usuario?.nombre} {usuario?.apellido}
            </p>
            <p className="mt-0.5 text-xs capitalize text-texto-secundario">{usuario?.rol}</p>
          </div>
        </aside>
      </div>

      <LlegadaQRModal open={modalQR} onClose={() => setModalQR(false)} onSuccess={() => refrescar()} />

      <CobroCitaSheet
        open={Boolean(cobroCita)}
        reserva={cobroCita}
        onClose={() => setCobroCita(null)}
        onActualizado={refrescar}
        onToast={(mensaje, tipo) => {
          if (tipo === 'error') notificar.error(mensaje);
          else if (tipo === 'warning') notificar.warning(mensaje);
          else notificar.success(mensaje);
        }}
      />

      <ConfirmDialog
        open={Boolean(finalizarCita)}
        onClose={() => setFinalizarCita(null)}
        onConfirm={confirmarFinalizar}
        title="Terminar servicio"
        description={
          finalizarCita
            ? `Se finalizará el servicio de ${finalizarCita.cliente_nombre || 'este cliente'}. Después podrás atender al siguiente.`
            : ''
        }
        confirmLabel="Terminar servicio"
        danger
        cargando={finalizando}
      />
    </div>
  );
}
