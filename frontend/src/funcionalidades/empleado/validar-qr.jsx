import { useState } from 'react';
import api from '../../api/cliente';
import { Button, Modal, Spinner } from '../../componentes/ui/index.jsx';

export default function ValidarQR({ open, onClose, onSuccess }) {
  const [qrToken, setQrToken] = useState('');
  const [monto, setMonto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    setCargando(true);
    try {
      const data = await api.checkin.validar({
        qr_token: qrToken,
        monto: parseFloat(monto) || 0,
      });
      setResultado(data);
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Error al validar QR');
    } finally {
      setCargando(false);
    }
  };

  const handleClose = () => {
    setQrToken('');
    setMonto('');
    setResultado(null);
    setError('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Validar QR">
      {resultado ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="font-semibold text-exito text-lg">Check-in validado</p>
          <p className="text-texto-secundario text-sm mt-1">
            Cliente: {resultado.cliente_nombre || '—'}
          </p>
          <p className="text-texto-secundario text-sm">
            Método de pago: {resultado.metodo_pago || '—'}
          </p>
          <Button variant="outline" className="mt-5" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-texto-principal mb-1">
              Código QR
            </label>
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Escanea o ingresa el código"
              className="w-full px-3 py-2.5 border border-borde rounded-lg text-texto-principal placeholder-texto-secundario/50 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-principal mb-1">
              Monto (opcional)
            </label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2.5 border border-borde rounded-lg text-texto-principal placeholder-texto-secundario/50 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
            />
          </div>

          {error && (
            <p className="text-error text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={cargando} className="w-full">
            {cargando ? <Spinner /> : 'Validar'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
