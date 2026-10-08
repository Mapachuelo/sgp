import { useCallback, useEffect, useState } from 'react';
import { Search, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Spinner } from '../../../componentes/ui/index.jsx';
import { SheetAdmin } from './navegacion.jsx';
import api from '../../../api/cliente.js';

export default function ClientesSeccion({ open, onClose, onToast }) {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [bloqueoId, setBloqueoId] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.clientes.list();
      setClientes(Array.isArray(data) ? data : []);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  const bloquear = async () => {
    if (!motivo.trim()) return onToast?.('Ingresa un motivo de bloqueo', 'warning');
    try {
      await api.clientes.block(bloqueoId, motivo);
      onToast?.('Cliente bloqueado');
      setBloqueoId(null);
      setMotivo('');
      await cargar();
    } catch (error) {
      onToast?.(error.message, 'error');
    }
  };

  const desbloquear = async (id) => {
    try {
      await api.clientes.unblock(id);
      onToast?.('Cliente desbloqueado');
      await cargar();
    } catch (error) {
      onToast?.(error.message, 'error');
    }
  };

  const eliminar = async (cliente) => {
    if (!window.confirm(`¿Eliminar permanentemente a "${cliente.nombre} ${cliente.apellido}"? Esta accion es irreversible.`)) return;
    try {
      await api.clientes.delete(cliente.id);
      onToast?.('Cliente eliminado');
      await cargar();
    } catch (error) {
      onToast?.(error.message, 'error');
    }
  };

  const filtrados = clientes.filter((cliente) =>
    `${cliente.nombre} ${cliente.apellido} ${cliente.email}`.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <SheetAdmin open={open} onClose={onClose} title="Moderacion de clientes">
      <div className="space-y-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-texto-secundario" aria-hidden="true" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente..."
            aria-label="Buscar cliente"
            className="pl-9 pr-3 py-2.5 border border-borde rounded-lg text-sm bg-superficie focus:outline-none focus:ring-2 focus:ring-primario/30 w-full"
          />
        </div>

        {cargando ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borde">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-fondo/60">
                <tr className="text-left text-texto-secundario text-xs uppercase">
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Telefono</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((cliente) => (
                  <tr key={cliente.id} className="border-t border-borde/50 hover:bg-fondo/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-texto-principal">{cliente.nombre} {cliente.apellido}</td>
                    <td className="py-2.5 px-3 text-xs text-texto-secundario">{cliente.email}</td>
                    <td className="py-2.5 px-3 text-xs">{cliente.telefono}</td>
                    <td className="py-2.5 px-3">
                      {cliente.esta_bloqueado ? <Badge variant="danger">Bloqueado</Badge> : <Badge variant="success">Activo</Badge>}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap justify-end items-center gap-1">
                        {cliente.esta_bloqueado ? (
                          <Button variant="exito" size="sm" onClick={() => desbloquear(cliente.id)}>
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Desbloquear
                          </Button>
                        ) : bloqueoId === cliente.id ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <input
                              className="px-2 py-1.5 border border-borde rounded text-xs w-36"
                              placeholder="Motivo"
                              value={motivo}
                              autoFocus
                              onChange={(e) => setMotivo(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && bloquear()}
                            />
                            <Button variant="danger" size="sm" onClick={bloquear}>Confirmar</Button>
                            <Button variant="secundario" size="sm" onClick={() => { setBloqueoId(null); setMotivo(''); }}>Cancelar</Button>
                          </div>
                        ) : (
                          <Button variant="secundario" size="sm" onClick={() => { setBloqueoId(cliente.id); setMotivo(''); }}>
                            <ShieldOff className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Bloquear
                          </Button>
                        )}
                        <Button variant="danger" size="sm" aria-label={`Eliminar ${cliente.nombre}`} onClick={() => eliminar(cliente)}>
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan="5" className="py-10 text-center text-texto-secundario">No hay clientes registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Card className="p-3 text-[11px] text-texto-secundario">
          Un cliente solo puede eliminarse si acumula 3 o mas no-shows.
        </Card>
      </div>
    </SheetAdmin>
  );
}
