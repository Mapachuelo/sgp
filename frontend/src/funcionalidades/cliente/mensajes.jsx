import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarX2, CheckCheck, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';

function fechaHora(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export default function MensajesCliente() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await api.notificaciones.listar();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setNoLeidas(Number(data?.no_leidas) || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const marcarLeida = async (notificacion) => {
    if (notificacion.leida_en) return;
    try {
      await api.notificaciones.marcarLeida(notificacion.id);
      setItems((previo) => previo.map((item) => (
        item.id === notificacion.id ? { ...item, leida_en: new Date().toISOString() } : item
      )));
      setNoLeidas((previo) => Math.max(0, previo - 1));
    } catch (err) {
      setError(err.message);
    }
  };

  const marcarTodas = async () => {
    if (noLeidas === 0) return;
    setActualizando(true);
    try {
      await api.notificaciones.marcarTodas();
      setItems((previo) => previo.map((item) => ({ ...item, leida_en: item.leida_en || new Date().toISOString() })));
      setNoLeidas(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setActualizando(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mensajes"
        subtitle="Avisos del salón sobre tus citas, cancelaciones y reembolsos."
        actions={
          <>
            <Button variant="secundario" onClick={cargar}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Actualizar
            </Button>
            <Button variant="outline" onClick={marcarTodas} disabled={noLeidas === 0 || actualizando}>
              {actualizando ? <Spinner /> : <><CheckCheck className="h-4 w-4" aria-hidden="true" /> Marcar todo como leído</>}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={noLeidas > 0 ? 'accent' : 'default'}>
          {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo leído'}
        </Badge>
        <span className="text-[11px] text-texto-secundario">{items.length} mensaje(s)</span>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/10 p-3 text-xs text-error">{error}</p>}

      {cargando ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No tienes mensajes"
          description="Cuando el salón cancele o cambie una cita, verás el aviso aquí."
          action={<Button variant="secundario" onClick={() => navigate('/cliente')}>Ver mis citas</Button>}
        />
      ) : (
        <Card padding={false} className="overflow-hidden">
          <ul className="divide-y divide-regla">
            {items.map((notificacion) => {
              const sinLeer = !notificacion.leida_en;
              return (
                <li key={notificacion.id}>
                  <button
                    type="button"
                    onClick={() => marcarLeida(notificacion)}
                    className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-panel/50 sm:px-5 ${
                      sinLeer ? 'bg-acento/[0.04]' : ''
                    }`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                      sinLeer ? 'border-acento/30 bg-acento/10 text-acento' : 'border-borde bg-panel text-texto-secundario'
                    }`}>
                      <CalendarX2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${sinLeer ? 'font-semibold text-texto-principal' : 'font-medium text-texto-principal'}`}>
                          {notificacion.titulo}
                        </span>
                        {sinLeer && <Badge variant="accent">Nuevo</Badge>}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-texto-secundario">{notificacion.mensaje}</span>
                      <span className="mt-1.5 block text-[10px] text-tenue">{fechaHora(notificacion.creado_en)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="secundario" onClick={() => navigate('/cliente')}>Ir a mis citas</Button>
      </div>
    </div>
  );
}
