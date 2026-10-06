import { useEffect, useState } from 'react';
import { BadgeDollarSign, CheckCircle2 } from 'lucide-react';
import { Button, Input, Modal, Spinner } from '../../../componentes/ui/index.jsx';
import api from '../../../api/cliente.js';

export default function CobroModal({ open, onClose, onToast, onActualizar }) {
  const [token, setToken] = useState('');
  const [monto, setMonto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (!open) {
      setToken('');
      setMonto('');
      setResultado(null);
    }
  }, [open]);

  const handleCobro = async () => {
    if (!token) return onToast?.('Ingresa el token QR', 'warning');
    setCargando(true);
    setResultado(null);
    try {
      const data = await api.checkin.validar({ qr_token: token, monto: parseFloat(monto) || 0 });
      setResultado(data);
      onToast?.('Cobro registrado correctamente');
      onActualizar?.();
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar cobro">
      {resultado ? (
        <div className="text-center py-4 space-y-3">
          <CheckCircle2 className="w-14 h-14 mx-auto text-exito" aria-hidden="true" />
          <p className="font-semibold text-exito text-lg">{resultado.cliente_nombre || 'Cobro registrado'}</p>
          <p className="text-sm text-texto-secundario">
            Metodo: <strong className="text-texto-principal">{resultado.metodo || '—'}</strong> · Monto:{' '}
            <strong className="text-texto-principal">${parseFloat(resultado.monto || 0).toLocaleString('es-CO')}</strong>
          </p>
          <Button variant="outline" className="w-full" onClick={onClose}>Cerrar</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-texto-secundario flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4" aria-hidden="true" />
            Registra el cobro por token. Usa 0 si el cliente pago online.
          </p>
          <Input label="Token QR" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token QR de la reserva" />
          <Input
            label="Monto recibido (0 = pago online)"
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <Button variant="primario" className="w-full" onClick={handleCobro} disabled={cargando}>
            {cargando ? <Spinner /> : 'Registrar cobro'}
          </Button>
        </div>
      )}
    </Modal>
  );
}
