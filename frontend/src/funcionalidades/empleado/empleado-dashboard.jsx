import { useState, useEffect, useCallback } from 'react';
import api from '../../api/cliente';
import { useAuth } from '../../hooks/use-auth';
import { Button, Card, Badge, Modal, Toast, Spinner } from '../../componentes/ui/index.jsx';

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

function ValidarQRModal({ open, onClose, onSuccess }) {
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
    setQrToken('');
    setMonto('');
    setResultado(null);
    setError('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Validar QR">
      {resultado ? (
        <div className="text-center py-4">
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
            Método: {resultado.metodo_pago || '—'}
          </p>
          <Button variant="outline" className="mt-4" onClick={handleClose}>Cerrar</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-texto-principal mb-1">Código QR</label>
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Escanea o ingresa el código QR"
              className="w-full px-3 py-2.5 border border-borde rounded-lg text-texto-principal placeholder-texto-secundario/50 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-principal mb-1">Monto (opcional)</label>
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
          {error && <p className="text-error text-sm">{error}</p>}
          <Button type="submit" disabled={cargando} className="w-full">
            {cargando ? <Spinner /> : 'Validar'}
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
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

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

  useEffect(() => {
    cargarCitas(fecha);
  }, [fecha, cargarCitas]);

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
  };

  const esHoy = fecha === hoy;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-texto-principal">Mis Citas</h1>
          <p className="text-texto-secundario mt-1">
            {esHoy ? 'Reservas del día de hoy' : `Reservas del ${fecha}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-2.5 border border-borde rounded-lg text-texto-principal bg-superficie focus:outline-none focus:ring-2 focus:ring-primario/30 text-sm"
          />
          <Button onClick={() => setModalQR(true)}>
            Validar QR
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
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
                <span className="text-sm text-texto-secundario">Ingresos totales</span>
                <p className="font-display text-2xl font-bold text-texto-principal mt-1">
                  S/ {totalRevenue.toFixed(2)}
                </p>
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
          ) : citas.length === 0 ? (
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
            <div className="space-y-4">
              {citas
                .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))
                .map((cita) => (
                  <Card key={cita.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-texto-principal text-lg">
                            {cita.hora_inicio ? cita.hora_inicio.slice(0, 5) : '—'}
                            {cita.hora_fin ? ` - ${cita.hora_fin.slice(0, 5)}` : ''}
                          </span>
                          <Badge variant={ESTADO_COLOR[cita.estado] || 'default'}>
                            {ESTADO_LABEL[cita.estado] || cita.estado}
                          </Badge>
                        </div>
                        <p className="font-semibold text-texto-principal">
                          {cita.cliente?.nombre || cita.cliente_nombre || '—'}
                        </p>
                        <p className="text-sm text-texto-secundario mt-0.5">
                          {cita.servicio?.nombre || cita.servicio_nombre || 'Sin servicio'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-texto-secundario">
                          {cita.ubicacion?.nombre || cita.sede ? (
                            <span className="flex items-center gap-1">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              {cita.ubicacion?.nombre || cita.sede}
                            </span>
                          ) : null}
                          {cita.monto || cita.precio ? (
                            <span className="flex items-center gap-1">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                              </svg>
                              S/ {parseFloat(cita.monto || cita.precio || 0).toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </div>

      <ValidarQRModal
        open={modalQR}
        onClose={() => setModalQR(false)}
        onSuccess={handleValidarQrSuccess}
      />
    </div>
  );
}
