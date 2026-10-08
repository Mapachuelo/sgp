import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Button, Card, Select, Spinner } from '../../../componentes/ui/index.jsx';
import api from '../../../api/cliente.js';
import { DIAS_SEMANA, estiloSede, fechaHoyBogota, formatearFechaLocal, lunesDeSemana, sumarDias } from '../utils.js';

const OFFSETS_SEMANAS = [-2, -1, 0, 1, 2];

function normalizar(jornada) {
  return {
    fecha: String(jornada.fecha).slice(0, 10),
    hora_inicio: String(jornada.hora_inicio).slice(0, 5),
    hora_fin: String(jornada.hora_fin).slice(0, 5),
  };
}

function etiquetaDia(fecha) {
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export default function JornadaSede({ onToast }) {
  const [sedeId, setSedeId] = useState('');
  const [sedes, setSedes] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoSedes, setCargandoSedes] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [semanaBase, setSemanaBase] = useState(() => lunesDeSemana(fechaHoyBogota()));
  const [seleccion, setSeleccion] = useState(null);
  const [borrador, setBorrador] = useState({ horaInicio: '09:00', horaFin: '18:00' });

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
      setJornadas(Array.isArray(data) ? data.map(normalizar) : []);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const cambiarSede = (valor) => {
    setSedeId(valor);
    setSeleccion(null);
    setSemanaBase(lunesDeSemana(fechaHoyBogota()));
    cargar(valor);
  };

  const mapaJornadas = useMemo(() => {
    const mapa = new Map();
    jornadas.forEach((j) => mapa.set(j.fecha, j));
    return mapa;
  }, [jornadas]);

  const semanas = useMemo(
    () =>
      OFFSETS_SEMANAS.map((offset) => {
        const inicio = sumarDias(semanaBase, offset * 7);
        const dias = DIAS_SEMANA.map((dia, indice) => {
          const fecha = sumarDias(inicio, indice);
          const iso = formatearFechaLocal(fecha);
          return { ...dia, fecha, iso, jornada: mapaJornadas.get(iso) || null, esHoy: iso === formatearFechaLocal(fechaHoyBogota()) };
        });
        return { offset, inicio, fin: sumarDias(inicio, 6), dias };
      }),
    [semanaBase, mapaJornadas]
  );

  const indiceSede = sedes.findIndex((s) => String(s.id) === sedeId);

  const abrirEditor = (dia) => {
    setSeleccion({ ...dia });
    setBorrador({
      horaInicio: dia.jornada?.hora_inicio || '09:00',
      horaFin: dia.jornada?.hora_fin || '18:00',
    });
  };

  const persistir = async (items, mensaje) => {
    setGuardando(true);
    try {
      await api.reservas.jornada.update({ ubicacion_id: Number(sedeId), items });
      onToast?.(mensaje);
      setSeleccion(null);
      await cargar(sedeId);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const guardarDia = () => {
    if (!borrador.horaInicio || !borrador.horaFin) return onToast?.('Completa hora inicio y hora fin', 'warning');
    if (borrador.horaInicio >= borrador.horaFin) return onToast?.('La hora fin debe ser mayor a la hora inicio', 'warning');
    const items = jornadas
      .filter((j) => j.fecha !== seleccion.iso)
      .concat([{ fecha: seleccion.iso, hora_inicio: borrador.horaInicio, hora_fin: borrador.horaFin }]);
    persistir(items, 'Jornada guardada');
  };

  const cerrarDia = () => {
    const items = jornadas.filter((j) => j.fecha !== seleccion.iso);
    persistir(items, 'Dia cerrado sin jornada');
  };

  const diasConJornada = jornadas.length;

  const chip = (jornada) =>
    jornada ? (
      <span className="inline-flex items-center rounded-md border px-1.5 py-1 text-[10px] font-bold leading-tight" style={estiloSede(indiceSede)}>
        {jornada.hora_inicio}-{jornada.hora_fin}
      </span>
    ) : (
      <span className="inline-flex items-center rounded-md border border-dashed border-borde px-1.5 py-1 text-[10px] text-texto-secundario/70">
        Sin jornada
      </span>
    );

  const editor = seleccion ? (
    <Card padding={false} className="overflow-hidden xl:sticky xl:top-4">
      <div className="p-4 border-b border-borde bg-fondo/40">
        <p className="text-sm font-bold text-texto-principal flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-primario" aria-hidden="true" /> Editar jornada
        </p>
        <p className="text-xs text-texto-secundario mt-1">
          {seleccion.nombre} · {etiquetaDia(seleccion.fecha)}
        </p>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-texto-secundario">
            Hora inicio
            <input
              type="time"
              value={borrador.horaInicio}
              onChange={(e) => setBorrador((prev) => ({ ...prev, horaInicio: e.target.value }))}
              className="mt-1 w-full px-2.5 py-2 border border-borde rounded-lg bg-superficie text-sm focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </label>
          <label className="text-xs font-semibold text-texto-secundario">
            Hora fin
            <input
              type="time"
              value={borrador.horaFin}
              onChange={(e) => setBorrador((prev) => ({ ...prev, horaFin: e.target.value }))}
              className="mt-1 w-full px-2.5 py-2 border border-borde rounded-lg bg-superficie text-sm focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </label>
        </div>
        <p className="text-[11px] text-texto-secundario flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          Al cerrar un dia la sede no tendra atencion en esa fecha.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primario" size="sm" onClick={guardarDia} disabled={guardando}>
            {guardando ? <Spinner /> : 'Guardar'}
          </Button>
          {seleccion.jornada && (
            <Button variant="danger" size="sm" onClick={cerrarDia} disabled={guardando}>
              Cerrar dia
            </Button>
          )}
          <Button variant="secundario" size="sm" onClick={() => setSeleccion(null)} disabled={guardando}>
            Cancelar
          </Button>
        </div>
      </div>
    </Card>
  ) : (
    <Card className="xl:sticky xl:top-4">
      <p className="text-sm font-bold text-texto-principal mb-2">Como usar la jornada</p>
      <p className="text-xs text-texto-secundario leading-relaxed">
        Haz clic en un dia de la tabla para definir su horario de atencion o cerrarlo. Los cambios se guardan al instante y
        reemplazan la jornada de esa fecha.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-texto-secundario">
        <span className="inline-flex items-center gap-1.5">{chip({ hora_inicio: '09:00', hora_fin: '18:00' })} Con jornada</span>
        <span className="inline-flex items-center gap-1.5">{chip(null)} Cerrado</span>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 min-w-0">
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
        {sedeId && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" aria-label="Semana anterior" onClick={() => setSemanaBase((prev) => sumarDias(prev, -7))}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <span className="text-xs font-semibold text-texto-principal whitespace-nowrap">
              {etiquetaDia(sumarDias(semanaBase, -14))} — {etiquetaDia(sumarDias(semanaBase, 20))}
            </span>
            <Button variant="outline" size="sm" aria-label="Semana siguiente" onClick={() => setSemanaBase((prev) => sumarDias(prev, 7))}>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button variant="secundario" size="sm" onClick={() => setSemanaBase(lunesDeSemana(fechaHoyBogota()))}>
              Hoy
            </Button>
            <span className="text-[11px] text-texto-secundario whitespace-nowrap">{diasConJornada} dias con jornada</span>
          </div>
        )}
      </Card>

      {!sedeId ? (
        <Card className="text-center py-10 text-sm text-texto-secundario">Selecciona una sede para ver sus jornadas.</Card>
      ) : cargando ? (
        <Card className="flex justify-center py-12"><Spinner /></Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
          <div className="order-2 xl:order-1 space-y-4 min-w-0">
            <Card padding={false} className="overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[860px]">
                  <thead>
                    <tr className="border-b border-borde bg-fondo/60">
                      <th className="sticky left-0 z-10 bg-fondo/95 text-left px-4 py-3 font-bold text-texto-secundario uppercase tracking-wider w-36">
                        Semana
                      </th>
                      {DIAS_SEMANA.map((dia) => (
                        <th key={dia.numero} className="px-2 py-3 text-center font-bold text-texto-principal">
                          <span className="block text-[10px] uppercase tracking-wider text-texto-secundario">{dia.corto}</span>
                          <span className="font-display text-sm">{etiquetaDia(sumarDias(semanaBase, dia.numero - 1))}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {semanas.map((semana) => (
                      <tr key={semana.offset} className="border-b border-borde/40">
                        <th className="sticky left-0 z-10 bg-superficie text-left px-4 py-2 font-semibold text-texto-secundario whitespace-nowrap">
                          {etiquetaDia(semana.inicio)} — {etiquetaDia(semana.fin)}
                          {semana.offset === 0 && <span className="ml-1.5 text-[10px] text-primario font-bold">Actual</span>}
                        </th>
                        {semana.dias.map((dia) => (
                          <td key={dia.iso} className="border-l border-borde/30 p-1.5">
                            <button
                              type="button"
                              onClick={() => abrirEditor(dia)}
                              aria-label={`Editar jornada del ${dia.nombre} ${etiquetaDia(dia.fecha)}`}
                              aria-pressed={seleccion?.iso === dia.iso}
                              className={`w-full text-left rounded-lg border p-1.5 min-h-[52px] transition cursor-pointer ${
                                seleccion?.iso === dia.iso
                                  ? 'ring-2 ring-primario/50 border-primario bg-fondo/40'
                                  : 'border-borde hover:border-primario/60 hover:bg-fondo/40'
                              } ${dia.esHoy ? 'bg-primario/5' : ''}`}
                            >
                              {chip(dia.jornada)}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="md:hidden space-y-2">
              {semanas
                .find((s) => s.offset === 0)
                ?.dias.map((dia) => (
                  <Card key={dia.iso} padding={false} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-texto-principal">
                        {dia.nombre} · {etiquetaDia(dia.fecha)}
                        {dia.esHoy && <span className="ml-1.5 text-[10px] text-primario font-bold">Hoy</span>}
                      </p>
                      <div className="mt-1">{chip(dia.jornada)}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => abrirEditor(dia)} aria-label={`Editar jornada del ${dia.nombre} ${etiquetaDia(dia.fecha)}`}>
                      Editar
                    </Button>
                  </Card>
                ))}
              {!cargando && jornadas.length === 0 && (
                <Card className="text-center py-8 text-sm text-texto-secundario">
                  No hay jornadas configuradas. Toca un dia para crear la primera.
                </Card>
              )}
            </div>
          </div>
          <div className="order-1 xl:order-2">{editor}</div>
        </div>
      )}
    </div>
  );
}
