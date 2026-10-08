import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Select, Spinner } from '../../../componentes/ui/index.jsx';
import api from '../../../api/cliente.js';
import { hoy } from '../utils.js';

export default function JornadaSede({ onToast }) {
  const [sedeId, setSedeId] = useState('');
  const [sedes, setSedes] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoSedes, setCargandoSedes] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.ubicaciones
      .list()
      .then((data) => setSedes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCargandoSedes(false));
  }, []);

  const cargar = async (id) => {
    if (!id) {
      setJornadas([]);
      return;
    }
    setCargando(true);
    try {
      const data = await api.reservas.jornada.get(id);
      setJornadas(Array.isArray(data) ? data : []);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const cambiarSede = (valor) => {
    setSedeId(valor);
    cargar(valor);
  };

  const actualizar = (indice, campo, valor) => {
    setJornadas((prev) => prev.map((j, i) => (i === indice ? { ...j, [campo]: valor } : j)));
  };

  const agregarFecha = () => {
    setJornadas((prev) => [...prev, { fecha: hoy(), hora_inicio: '09:00', hora_fin: '18:00', nueva: true }]);
  };

  const guardar = async () => {
    if (!sedeId) return onToast?.('Selecciona una sede', 'warning');
    const items = jornadas.map((j) => ({
      fecha: j.fecha,
      hora_inicio: j.hora_inicio,
      hora_fin: j.hora_fin,
    }));
    if (items.some((i) => !i.fecha || !i.hora_inicio || !i.hora_fin)) {
      return onToast?.('Completa fecha, hora inicio y hora fin en todas las jornadas', 'warning');
    }
    setGuardando(true);
    try {
      await api.reservas.jornada.update({ ubicacion_id: Number(sedeId), items });
      onToast?.('Jornadas actualizadas');
      await cargar(sedeId);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <Select
            label="Sede"
            options={[
              { value: '', label: cargandoSedes ? 'Cargando...' : 'Seleccionar sede...' },
              ...sedes.map((u) => ({ value: String(u.id), label: u.nombre })),
            ]}
            value={sedeId}
            onChange={(e) => cambiarSede(e.target.value)}
          />
        </div>
        <Button variant="secundario" onClick={agregarFecha} disabled={!sedeId}>
          <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Agregar fecha
        </Button>
        <Button variant="primario" onClick={guardar} disabled={guardando || !sedeId}>
          {guardando ? <Spinner /> : 'Guardar jornadas'}
        </Button>
      </Card>

      {cargando ? (
        <Card className="flex justify-center py-12"><Spinner /></Card>
      ) : !sedeId ? (
        <Card className="text-center py-10 text-sm text-texto-secundario">Selecciona una sede para ver sus jornadas.</Card>
      ) : jornadas.length === 0 ? (
        <Card className="text-center py-10 text-sm text-texto-secundario">
          No hay jornadas configuradas para esta sede. Usa &quot;Agregar fecha&quot; para crear una.
        </Card>
      ) : (
        <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
          {jornadas.map((j, indice) => (
            <Card key={`${j.fecha}-${indice}`} className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_1fr_auto] gap-3 items-end">
                <Input label="Fecha" type="date" value={j.fecha ? j.fecha.slice(0, 10) : ''} onChange={(e) => actualizar(indice, 'fecha', e.target.value)} />
                <Input label="Hora inicio" type="time" value={j.hora_inicio ? j.hora_inicio.slice(0, 5) : ''} onChange={(e) => actualizar(indice, 'hora_inicio', e.target.value)} />
                <Input label="Hora fin" type="time" value={j.hora_fin ? j.hora_fin.slice(0, 5) : ''} onChange={(e) => actualizar(indice, 'hora_fin', e.target.value)} />
                <button
                  type="button"
                  aria-label={`Quitar jornada del ${j.fecha}`}
                  onClick={() => setJornadas((prev) => prev.filter((_, i) => i !== indice))}
                  className="p-2.5 rounded-lg border border-borde text-error hover:bg-error/10 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
