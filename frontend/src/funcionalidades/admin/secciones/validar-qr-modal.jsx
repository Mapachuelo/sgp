import { useEffect, useRef, useState } from 'react';
import { QrCode, CheckCircle2, Camera, CameraOff } from 'lucide-react';
import { Button, Input, Spinner } from '../../../componentes/ui/index.jsx';
import { SheetAdmin } from './navegacion.jsx';
import api from '../../../api/cliente.js';

export default function ValidarQrModal({ open, onClose, onToast, onActualizar, tokenInicial = '' }) {
  const [qrToken, setQrToken] = useState('');
  const [monto, setMonto] = useState('0');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const apagarCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  };

  useEffect(() => {
    if (!open) {
      apagarCamara();
      setQrToken('');
      setMonto('0');
      setResultado(null);
    } else {
      setQrToken(tokenInicial || '');
    }
  }, [open, tokenInicial]);

  useEffect(() => () => apagarCamara(), []);

  const activarCamara = async () => {
    setErrorCamara('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamaraActiva(true);
    } catch {
      setErrorCamara('No se pudo acceder a la camara. Verifica los permisos.');
    }
  };

  const handleValidar = async () => {
    if (!qrToken) return onToast?.('Ingresa el token QR', 'warning');
    setCargando(true);
    setResultado(null);
    try {
      const data = await api.checkin.validar({ qr_token: qrToken, monto: parseFloat(monto) || 0 });
      setResultado(data);
      onToast?.('Entrada validada correctamente');
      onActualizar?.();
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <SheetAdmin open={open} onClose={onClose} title="Validar entrada">
      {resultado ? (
        <div className="text-center py-4 space-y-3">
          <CheckCircle2 className="w-14 h-14 mx-auto text-exito" aria-hidden="true" />
          <p className="font-semibold text-exito text-lg">Check-in y cobro registrados</p>
          <p className="text-sm text-texto-secundario">
            Cliente: <strong className="text-texto-principal">{resultado.cliente_nombre || '—'}</strong>
          </p>
          <p className="text-sm text-texto-secundario">
            Metodo: <strong className="text-texto-principal">{resultado.metodo || '—'}</strong> · Monto:{' '}
            <strong className="text-texto-principal">${parseFloat(resultado.monto || 0).toLocaleString('es-CO')}</strong>
          </p>
          <Button variant="outline" className="w-full" onClick={onClose}>Cerrar</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-texto-secundario flex items-center gap-2">
            <QrCode className="w-4 h-4" aria-hidden="true" />
            Escanea o ingresa el token QR para registrar el ingreso y el cobro.
          </p>

          {!camaraActiva ? (
            <Button variant="outline" className="w-full" onClick={activarCamara}>
              <Camera className="w-4 h-4 mr-2" aria-hidden="true" /> Activar camara
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="bg-black rounded-xl overflow-hidden" style={{ maxHeight: '220px' }}>
                <video ref={videoRef} autoPlay playsInline className="w-full" style={{ maxHeight: '220px', objectFit: 'cover' }} />
              </div>
              <Button variant="outline" className="w-full" onClick={apagarCamara}>
                <CameraOff className="w-4 h-4 mr-2" aria-hidden="true" /> Apagar camara
              </Button>
            </div>
          )}
          {errorCamara && <p className="text-error text-sm">{errorCamara}</p>}

          <Input label="Token QR" value={qrToken} onChange={(e) => setQrToken(e.target.value)} placeholder="Token QR de la reserva" />
          <Input
            label="Monto recibido (0 = pago online)"
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <Button variant="primario" className="w-full" onClick={handleValidar} disabled={cargando}>
            {cargando ? <Spinner /> : 'Validar entrada y cobro'}
          </Button>
        </div>
      )}
    </SheetAdmin>
  );
}
