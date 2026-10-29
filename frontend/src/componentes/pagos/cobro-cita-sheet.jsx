import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, CheckCircle2, QrCode, Search } from 'lucide-react';
import { Badge, Button, Input, Modal, Spinner } from '../ui/index.jsx';
import api from '../../api/cliente.js';

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

const hoyBogota = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const hora = (iso) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

function extraerToken(texto) {
  if (!texto) return '';
  const valor = String(texto).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) {
    return valor;
  }
  if (valor.startsWith('{')) {
    try {
      const datos = JSON.parse(valor);
      if (datos?.qr_token) return String(datos.qr_token).trim();
    } catch {
      /* continua con la busqueda de UUID */
    }
  }
  const encontrado = valor.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return encontrado ? encontrado[0] : valor;
}

export default function CobroCitaSheet({
  open,
  onClose,
  reserva,
  tokenInicial = '',
  onActualizado,
  onToast,
}) {
  const [citas, setCitas] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [seleccionada, setSeleccionada] = useState(null);
  const [monto, setMonto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const escaneoRef = useRef(null);
  const detectadoRef = useRef(false);

  const notificar = (texto, tipo = 'success') => onToast?.(texto, tipo);

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

  const cargarLista = useCallback(async () => {
    setCargandoLista(true);
    try {
      const data = await api.reservas.list({ fecha: hoyBogota() });
      const activas = (Array.isArray(data) ? data : []).filter(
        (item) => ['pendiente', 'confirmada', 'en_curso'].includes(item.estado) && !item.cobro_metodo
      );
      setCitas(activas);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoLista(false);
    }
  }, []);

  const seleccionarReserva = (item) => {
    setSeleccionada(item);
    setResultado(null);
    setError('');
    const total = Number(item.precio_total || item.precio_base || item.precio || 0) * Number(item.cantidad_personas || 1);
    setMonto(String(total || ''));
  };

  const consultarToken = useCallback(
    async (valor) => {
      const token = extraerToken(valor);
      if (!token) return;
      setCargando(true);
      setError('');
      try {
        const data = await api.checkin.consultar(token);
        seleccionarReserva(data);
        apagarCamara();
        detectadoRef.current = true;
      } catch (err) {
        setError(err.message);
        detectadoRef.current = false;
      } finally {
        setCargando(false);
      }
    },
    [apagarCamara]
  );

  useEffect(() => {
    if (!open) {
      apagarCamara();
      setSeleccionada(null);
      setResultado(null);
      setError('');
      setManual('');
      setMonto('');
      return;
    }
    if (reserva) {
      seleccionarReserva(reserva);
    } else if (tokenInicial) {
      consultarToken(tokenInicial);
    } else {
      cargarLista();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reserva?.id, tokenInicial]);

  useEffect(() => () => apagarCamara(), [apagarCamara]);

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
        if (codigo?.data && !detectadoRef.current) {
          detectadoRef.current = true;
          setManual(extraerToken(codigo.data));
          consultarToken(codigo.data);
        }
      }, 350);
    } catch {
      setErrorCamara('No se pudo acceder a la cámara. Busca la cita en la lista o usa el código manual.');
    }
  };

  const cerrar = () => {
    apagarCamara();
    onClose?.();
  };

  const confirmarPago = async (montoFinal) => {
    if (!seleccionada) return;
    setCargando(true);
    setError('');
    try {
      const data = await api.checkin.confirmarPago({
        reserva_id: seleccionada.reserva_id || seleccionada.id,
        monto: montoFinal,
      });
      setResultado(data);
      notificar('Pago registrado');
      setTimeout(() => {
        onActualizado?.();
        onClose?.();
      }, 1200);
    } catch (err) {
      setError(err.message);
      notificar(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const registrarLlegada = async () => {
    if (!seleccionada?.qr_token) return;
    setCargando(true);
    setError('');
    try {
      const data = await api.checkin.llegada(seleccionada.qr_token);
      setSeleccionada(data);
      notificar('Llegada registrada');
      onActualizado?.();
    } catch (err) {
      setError(err.message);
      notificar(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const total =
    Number(seleccionada?.precio_total || seleccionada?.precio_base || seleccionada?.precio || 0) *
    Number(seleccionada?.cantidad_personas || 1);
  const pagado = seleccionada?.pago_estado === 'aprobado' || Boolean(seleccionada?.cobro_metodo);

  return (
    <Modal open={open} onClose={cerrar} title="Cobrar cita" size="wide">
      {resultado ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-exito" aria-hidden="true" />
          <p className="text-lg font-semibold text-texto-principal">Pago registrado</p>
          <p className="text-sm text-texto-secundario">{`${resultado.cliente_nombre || 'Cliente'} ${resultado.cliente_apellido || ''}`.trim()}</p>
          <div className="mx-auto max-w-xs rounded-md border border-borde bg-panel/50 p-3 text-left text-xs">
            <div className="flex justify-between"><span className="text-texto-secundario">Método</span><span className="font-medium text-texto-principal">{resultado.metodo || '—'}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-texto-secundario">Monto</span><span className="num font-medium text-texto-principal">{dinero(resultado.monto)}</span></div>
          </div>
          <Button className="w-full" onClick={cerrar}>Cerrar</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {seleccionada ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-borde bg-panel/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-texto-principal">{`${seleccionada.cliente_nombre || 'Cliente'} ${seleccionada.cliente_apellido || ''}`.trim()}</p>
                    <p className="mt-0.5 text-xs text-texto-secundario">
                      {seleccionada.servicio_nombre || 'Servicio'} · {hora(seleccionada.inicia_en)}
                    </p>
                  </div>
                  <Badge variant={pagado ? 'success' : 'warning'}>{pagado ? 'Pagado' : 'Pago pendiente'}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-borde pt-2">
                  <span className="text-xs text-texto-secundario">Total</span>
                  <span className="num text-base font-semibold text-texto-principal">{dinero(total)}</span>
                </div>
              </div>

              {!seleccionada.llego_en && (
                <Button variant="outline" className="w-full" onClick={registrarLlegada} disabled={cargando}>
                  Registrar llegada
                </Button>
              )}

              {pagado ? (
                <p className="rounded-md border border-exito/30 bg-exito/10 px-3 py-2 text-xs text-exito">
                  El pago de esta cita ya está registrado.
                </p>
              ) : (
                <>
                  {seleccionada.pago_estado === 'aprobado' && (
                    <Button className="w-full" onClick={() => confirmarPago(0)} disabled={cargando}>
                      {cargando ? <Spinner /> : 'Registrar cobro del pago en línea'}
                    </Button>
                  )}
                  <Input
                    label="Monto recibido"
                    type="number"
                    min="1"
                    step="100"
                    inputMode="decimal"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                  <Button className="w-full" onClick={() => confirmarPago(Number(monto) || 0)} disabled={cargando || Number(monto) <= 0}>
                    {cargando ? <Spinner /> : 'Aceptar pago'}
                  </Button>
                </>
              )}
              <Button variant="ghost" className="w-full" onClick={() => { setSeleccionada(null); setResultado(null); cargarLista(); }}>
                Elegir otra cita
              </Button>
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-lg border border-borde bg-black" style={{ aspectRatio: '16 / 9' }}>
                {camaraActiva ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-40 w-40 rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-white/70">
                    <QrCode className="h-9 w-9" strokeWidth={1.4} aria-hidden="true" />
                    <p className="text-xs">Escanea el QR del cliente o elige una cita</p>
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
                <div className="flex min-w-0 flex-1 gap-2">
                  <input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder="Código QR manual (opcional)"
                    aria-label="Código QR manual"
                    className="h-9 min-w-0 flex-1 rounded-md border border-control bg-superficie px-3 text-xs text-texto-principal focus:border-acento focus:outline-none"
                  />
                  <Button type="button" variant="outline" onClick={() => consultarToken(manual)} disabled={!manual.trim() || cargando}>
                    <Search className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="border-t border-borde pt-3">
                <p className="mb-2 text-[11px] font-medium text-texto-secundario">Citas de hoy</p>
                {cargandoLista ? (
                  <div className="flex justify-center py-6"><Spinner /></div>
                ) : citas.length === 0 ? (
                  <p className="rounded-md border border-dashed border-control bg-panel/40 px-3 py-4 text-xs text-texto-secundario">
                    No hay citas activas para hoy.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1 scroll-thin">
                    {citas.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => seleccionarReserva(item)}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-borde px-3 py-2 text-left transition-colors hover:bg-panel"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-texto-principal">{`${item.cliente_nombre || 'Cliente'} ${item.cliente_apellido || ''}`.trim()}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-texto-secundario">
                            {hora(item.inicia_en)} · {item.servicio_nombre || 'Servicio'}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="num block text-xs font-medium text-texto-principal">{dinero(item.precio_total || item.precio_base)}</span>
                          <span className={`mt-0.5 block text-[10px] ${item.pago_estado === 'aprobado' ? 'text-exito' : 'text-advertencia'}`}>
                            {item.pago_estado === 'aprobado' ? 'Pagado' : 'Sin pago'}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {error && <p className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
