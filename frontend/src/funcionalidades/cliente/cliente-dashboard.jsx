import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Toast, Spinner } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';
import useWebSocket from '../../hooks/use-websocket.js';

const COLUMNAS = [
  { key: 'pendiente', label: 'Pendiente', variant: 'warning' },
  { key: 'confirmada', label: 'Confirmada', variant: 'info' },
  { key: 'en_curso', label: 'En curso', variant: 'info' },
  { key: 'completada', label: 'Completada', variant: 'success' },
  { key: 'cancelada', label: 'Cancelada', variant: 'danger' },
];

function estadoAVariante(estado) {
  const mapa = {
    pendiente: 'warning',
    confirmada: 'info',
    en_curso: 'info',
    completada: 'success',
    cobrado: 'success',
    cancelada: 'danger',
  };
  return mapa[estado] || 'default';
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatearHora(hora) {
  if (!hora) return '';
  return hora.substring(0, 5);
}

export default function ClienteDashboard() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { ultimoEvento } = useWebSocket();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [filtroSeleccionado, setFiltroSeleccionado] = useState('todos');

  useEffect(() => {
    if (!ultimoEvento) return;
    if (ultimoEvento.tipo === 'reserva.actualizada') {
      cargarReservas();
    }
  }, [ultimoEvento]);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const cargarReservas = async () => {
    try {
      setCargando(true);
      const data = await api.reservas.misReservas();
      setReservas(data || []);
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReservas();
  }, []);

  const cancelarReserva = async (id) => {
    try {
      await api.reservas.cancelar(id);
      mostrarToast('Reserva cancelada con exito', 'success');
      cargarReservas();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  };

  const reservasActivas = reservas.filter(
    (r) => !['cancelada', 'completada', 'cobrado'].includes(r.estado)
  );

  const reservasFiltradas = reservas.filter((r) => {
    if (filtroSeleccionado === 'todos') return true;
    if (filtroSeleccionado === 'completada') return r.estado === 'completada' || r.estado === 'cobrado';
    return r.estado === filtroSeleccionado;
  });

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold text-texto-principal mb-1">
          Hola{usuario?.nombre ? `, ${usuario.nombre}` : ''}
        </h1>
        <p className="text-texto-secundario text-lg mb-6">Reserva tu proxima cita</p>
        <div className="flex flex-wrap items-center gap-6">
          <div className="bg-fondo rounded-xl px-5 py-3 border border-borde">
            <span className="text-2xl font-bold text-primario">{reservasActivas.length}</span>
            <span className="text-texto-secundario text-sm ml-2">reservas activas</span>
          </div>
          <Button onClick={() => navigate('/cliente/reservar')}>Reservar ahora</Button>
        </div>
      </div>

      {reservas.length === 0 ? (
        <Card className="text-center py-12">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-texto-secundario/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-texto-secundario text-lg mb-4">No tienes reservas aun</p>
          <Button onClick={() => navigate('/cliente/reservar')}>Hacer mi primera reserva</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Fila de filtros por separado */}
          <div className="flex flex-wrap gap-2 border-b border-borde pb-4">
            <button
              onClick={() => setFiltroSeleccionado('todos')}
              className={`px-4 py-2 text-xs font-semibold rounded-full border transition cursor-pointer flex items-center gap-1.5 ${
                filtroSeleccionado === 'todos'
                  ? 'bg-primario text-white border-primario shadow-sm'
                  : 'bg-superficie text-texto-secundario border-borde hover:bg-fondo hover:text-texto-principal'
              }`}
            >
              Todos
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                filtroSeleccionado === 'todos'
                  ? 'bg-white/20 text-white'
                  : 'bg-fondo text-texto-secundario'
              }`}>
                {reservas.length}
              </span>
            </button>
            {COLUMNAS.map((col) => {
              const count = reservas.filter((r) => {
                if (col.key === 'completada') return r.estado === 'completada' || r.estado === 'cobrado';
                return r.estado === col.key;
              }).length;

              return (
                <button
                  key={col.key}
                  onClick={() => setFiltroSeleccionado(col.key)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border transition cursor-pointer flex items-center gap-1.5 ${
                    filtroSeleccionado === col.key
                      ? 'bg-primario text-white border-primario shadow-sm'
                      : 'bg-superficie text-texto-secundario border-borde hover:bg-fondo hover:text-texto-principal'
                  }`}
                >
                  {col.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    filtroSeleccionado === col.key
                      ? 'bg-white/20 text-white'
                      : 'bg-fondo text-texto-secundario'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grilla responsiva de tarjetas filtradas */}
          {reservasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-texto-secundario">
              No tienes reservas en este estado.
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {reservasFiltradas.map((reserva) => (
                  <Card key={reserva.id} padding={true} className="p-4 hover:shadow-md hover:-translate-y-0.5 transition duration-200">
                    <h4 className="font-semibold text-texto-principal text-sm mb-2">
                      {reserva.servicio?.nombre || reserva.servicio_nombre || 'Sin servicio'}
                    </h4>
                    <div className="text-xs text-texto-secundario space-y-1.5 mb-3">
                      <div className="flex items-center gap-1.5">
                        <svg
                          className="w-3.5 h-3.5 shrink-0 text-texto-secundario/70"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{formatearFecha(reserva.fecha)} a las {formatearHora(reserva.hora || reserva.inicia_en?.slice(11, 19))}</span>
                      </div>
                      {(reserva.empleado?.nombre || reserva.empleado_nombre) && (
                        <div className="flex items-center gap-1.5">
                          <svg
                            className="w-3.5 h-3.5 shrink-0 text-texto-secundario/70"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>Estilista: <strong className="text-texto-principal">{reserva.empleado?.nombre || reserva.empleado_nombre}</strong></span>
                        </div>
                      )}
                      {(reserva.ubicacion?.nombre || reserva.ubicacion_nombre) && (
                        <div className="flex items-center gap-1.5">
                          <svg
                            className="w-3.5 h-3.5 shrink-0 text-texto-secundario/70"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>Sede: {reserva.ubicacion?.nombre || reserva.ubicacion_nombre}</span>
                        </div>
                      )}
                      {reserva.qr_token && (
                        <div className="flex items-center gap-1.5 font-mono text-[9px] text-texto-secundario/80 break-all">
                          <span>Token: {reserva.qr_token}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-borde/40">
                      <Badge variant={estadoAVariante(reserva.estado)}>
                        {reserva.estado?.replace('_', ' ')}
                      </Badge>
                      {(reserva.estado === 'pendiente' || reserva.estado === 'confirmada') && (
                        <button
                          onClick={() => cancelarReserva(reserva.id)}
                          className="text-xs text-error hover:underline cursor-pointer font-medium"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
