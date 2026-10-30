import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check, ChevronLeft, ChevronRight, Info, Lock, PartyPopper, RotateCcw } from 'lucide-react';
import { Button, Card, Input, Modal, Select, Spinner } from '../../../componentes/ui/index.jsx';
import api from '../../../api/cliente.js';
import { DIAS_SEMANA, estiloSede, fechaHoyBogota, formatearFechaLocal, lunesDeSemana, sumarDias } from '../utils.js';
import { avisarAdmin } from './avisos.js';

const OFFSETS_SEMANAS = [-2, -1, 0, 1, 2];

function normalizar(jornada) {
  return {
    fecha: String(jornada.fecha).slice(0, 10),
    hora_inicio: String(jornada.hora_inicio || '09:00').slice(0, 5),
    hora_fin: String(jornada.hora_fin || '18:00').slice(0, 5),
    cerrado: Boolean(jornada.cerrado),
    motivo: jornada.motivo || '',
  };
}

function etiquetaDia(fecha) {
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function isoLocal(fecha) {
  return formatearFechaLocal(fecha);
}

function plantillaInicial() {
  return DIAS_SEMANA.map((dia) => ({
    dia_semana: dia.numero,
    abierto: dia.numero <= 5,
    hora_inicio: '09:00',
    hora_fin: '18:00',
  }));
}

export default function JornadaSede({ onToast = avisarAdmin }) {
  const [sedeId, setSedeId] = useState('');
  const [departamentoFiltro, setDepartamentoFiltro] = useState('');
  const [ciudadFiltro, setCiudadFiltro] = useState('');
  const [sedes, setSedes] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [plantilla, setPlantilla] = useState([]);
  const [festivos, setFestivos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoSedes, setCargandoSedes] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [semanaBase, setSemanaBase] = useState(() => lunesDeSemana(fechaHoyBogota()));
  const [seleccion, setSeleccion] = useState(null);
  const [borrador, setBorrador] = useState({ horaInicio: '09:00', horaFin: '18:00', cerrado: false });
  const [plantillaForm, setPlantillaForm] = useState(plantillaInicial);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]);
  const [ultimoSeleccionado, setUltimoSeleccionado] = useState(null);
  const [bulk, setBulk] = useState({ horaInicio: '09:00', horaFin: '18:00' });
  const [festivoModal, setFestivoModal] = useState(null);
  const [festivoForm, setFestivoForm] = useState(null);

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
      setPlantilla([]);
      setFestivos([]);
      return;
    }
    setCargando(true);
    try {
      const desde = formatearFechaLocal(sumarDias(fechaHoyBogota(), -42));
      const hasta = formatearFechaLocal(sumarDias(fechaHoyBogota(), 60));
      const [data, plantillaData, festivosData] = await Promise.all([
        api.reservas.jornada.get(id),
        api.reservas.jornada.getPlantilla(id),
        api.reservas.festivos(desde, hasta).catch(() => []),
      ]);
      setJornadas(Array.isArray(data) ? data.map(normalizar) : []);
      setPlantilla(Array.isArray(plantillaData) ? plantillaData : []);
      setFestivos(Array.isArray(festivosData) ? festivosData : []);
    } catch (error) {
      onToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    setSedeId('');
    setJornadas([]);
    setPlantilla([]);
    setFestivos([]);
  }, [departamentoFiltro, ciudadFiltro]);

  const cambiarSede = (valor) => {
    setSedeId(valor);
    setSeleccion(null);
    setModoSeleccion(false);
    setSeleccionados([]);
    setSemanaBase(lunesDeSemana(fechaHoyBogota()));
    cargar(valor);
  };

  useEffect(() => {
    setPlantillaForm(
      plantilla.length
        ? DIAS_SEMANA.map((dia) => {
          const fila = plantilla.find((item) => Number(item.dia_semana) === dia.numero);
          return {
            dia_semana: dia.numero,
            abierto: fila ? Boolean(fila.abierto) : dia.numero <= 5,
            hora_inicio: String(fila?.hora_inicio || '09:00').slice(0, 5),
            hora_fin: String(fila?.hora_fin || '18:00').slice(0, 5),
          };
        })
        : plantillaInicial()
    );
  }, [plantilla]);

  const departamentos = useMemo(
    () => [...new Set(sedes.map((sede) => sede.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [sedes]
  );
  const ciudades = useMemo(
    () => [...new Set(
      sedes
        .filter((sede) => !departamentoFiltro || sede.departamento === departamentoFiltro)
        .map((sede) => sede.ciudad)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b)),
    [sedes, departamentoFiltro]
  );
  const sedesFiltradas = useMemo(
    () => sedes.filter((sede) => {
      if (departamentoFiltro && sede.departamento !== departamentoFiltro) return false;
      if (ciudadFiltro && sede.ciudad !== ciudadFiltro) return false;
      return true;
    }),
    [sedes, departamentoFiltro, ciudadFiltro]
  );

  const mapaJornadas = useMemo(() => new Map(jornadas.map((jornada) => [jornada.fecha, jornada])), [jornadas]);
  const mapaFestivos = useMemo(() => new Map(festivos.map((festivo) => [festivo.fecha, festivo])), [festivos]);
  const plantillaActiva = plantilla.length > 0;

  const jornadaDe = (dia) => {
    const exacta = mapaJornadas.get(dia.iso);
    if (exacta) return { ...exacta, es_plantilla: false };
    const festivo = mapaFestivos.get(dia.iso);
    if (festivo) {
      return {
        fecha: dia.iso,
        cerrado: true,
        motivo: `Festivo: ${festivo.nombre}`,
        es_festivo: true,
        es_plantilla: false,
      };
    }
    if (!plantillaActiva) return null;
    const fila = plantilla.find((item) => Number(item.dia_semana) === dia.numero);
    if (!fila) return null;
    return {
      fecha: dia.iso,
      hora_inicio: String(fila.hora_inicio).slice(0, 5),
      hora_fin: String(fila.hora_fin).slice(0, 5),
      cerrado: !fila.abierto,
      motivo: fila.abierto ? '' : 'Cerrada por la plantilla semanal',
      es_plantilla: true,
      es_festivo: false,
    };
  };

  const semanas = useMemo(
    () => OFFSETS_SEMANAS.map((offset) => {
      const inicio = sumarDias(semanaBase, offset * 7);
      const dias = DIAS_SEMANA.map((dia, indice) => {
        const fecha = sumarDias(inicio, indice);
        const iso = isoLocal(fecha);
        return {
          ...dia,
          fecha,
          iso,
          esHoy: iso === formatearFechaLocal(fechaHoyBogota()),
          esFestivo: mapaFestivos.has(iso),
        };
      });
      return { offset, inicio, fin: sumarDias(inicio, 6), dias };
    }),
    [semanaBase, mapaFestivos]
  );

  const indiceSede = sedes.findIndex((sede) => String(sede.id) === sedeId);
  const diasVisibles = semanas.flatMap((semana) => semana.dias);

  const abrirEditor = (dia) => {
    const efectiva = jornadaDe(dia);
    setSeleccion({ ...dia, efectiva });
    setBorrador({
      horaInicio: efectiva?.hora_inicio || '09:00',
      horaFin: efectiva?.hora_fin || '18:00',
      cerrado: Boolean(efectiva?.cerrado),
    });
  };

  const persistir = async (items, mensaje) => {
    setGuardando(true);
    try {
      const respuesta = await api.reservas.jornada.update({ ubicacion_id: Number(sedeId), items });
      const canceladas = respuesta?.reservas_canceladas?.length || 0;
      if (canceladas > 0) {
        onToast(`${mensaje}. ${canceladas} reserva(s) futura(s) cancelada(s).`, 'warning');
      } else {
        onToast(mensaje);
      }
      setSeleccion(null);
      setSeleccionados([]);
      await cargar(sedeId);
    } catch (error) {
      onToast(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const guardarDia = () => {
    if (!borrador.cerrado && (!borrador.horaInicio || !borrador.horaFin || borrador.horaInicio >= borrador.horaFin)) {
      onToast('Completa un rango de horas válido', 'warning');
      return;
    }
    const items = jornadas
      .filter((jornada) => jornada.fecha !== seleccion.iso)
      .concat([{
        fecha: seleccion.iso,
        hora_inicio: borrador.cerrado ? '00:00' : borrador.horaInicio,
        hora_fin: borrador.cerrado ? '00:00' : borrador.horaFin,
        cerrado: Boolean(borrador.cerrado),
        motivo: borrador.cerrado ? (seleccion.esFestivo ? 'Festivo cerrado' : 'Cierre administrativo') : null,
      }]);
    persistir(items, borrador.cerrado ? 'Día cerrado' : 'Jornada guardada');
  };

  const restablecerDia = () => {
    const items = jornadas.filter((jornada) => jornada.fecha !== seleccion.iso);
    persistir(items, 'Día restablecido a la plantilla');
  };

  const toggleDia = (dia, evento) => {
    if (!modoSeleccion) {
      abrirEditor(dia);
      return;
    }
    const iso = dia.iso;
    if (evento?.shiftKey && ultimoSeleccionado) {
      const inicio = diasVisibles.findIndex((item) => item.iso === ultimoSeleccionado);
      const fin = diasVisibles.findIndex((item) => item.iso === iso);
      if (inicio >= 0 && fin >= 0) {
        const [desde, hasta] = inicio < fin ? [inicio, fin] : [fin, inicio];
        const rango = diasVisibles.slice(desde, hasta + 1).map((item) => item.iso);
        setSeleccionados((prev) => [...new Set([...prev, ...rango])]);
        setUltimoSeleccionado(iso);
        return;
      }
    }
    setUltimoSeleccionado(iso);
    setSeleccionados((prev) => (prev.includes(iso) ? prev.filter((item) => item !== iso) : [...prev, iso]));
  };

  const alternarSemana = (semana) => {
    const fechas = semana.dias.map((dia) => dia.iso);
    const todas = fechas.every((fecha) => seleccionados.includes(fecha));
    setSeleccionados((prev) => (
      todas ? prev.filter((fecha) => !fechas.includes(fecha)) : [...new Set([...prev, ...fechas])]
    ));
  };

  const seleccionar = (tipo) => {
    let fechas = [];
    if (tipo === 'todo') fechas = diasVisibles.map((dia) => dia.iso);
    if (tipo === 'semana') fechas = semanas.find((semana) => semana.offset === 0)?.dias.map((dia) => dia.iso) || [];
    if (tipo === 'laborables') fechas = diasVisibles.filter((dia) => dia.numero <= 5).map((dia) => dia.iso);
    if (tipo === 'fin') fechas = diasVisibles.filter((dia) => dia.numero >= 6).map((dia) => dia.iso);
    setSeleccionados(fechas);
  };

  const aplicarSeleccion = (cerrado) => {
    if (!seleccionados.length) return;
    const items = jornadas.filter((jornada) => !seleccionados.includes(jornada.fecha));
    seleccionados.forEach((fecha) => {
      items.push({
        fecha,
        hora_inicio: cerrado ? '00:00' : bulk.horaInicio,
        hora_fin: cerrado ? '00:00' : bulk.horaFin,
        cerrado,
        motivo: cerrado ? 'Cierre administrativo' : null,
      });
    });
    persistir(items, cerrado ? `${seleccionados.length} día(s) cerrado(s)` : `${seleccionados.length} día(s) actualizado(s)`);
  };

  const restablecerSeleccion = () => {
    if (!seleccionados.length) return;
    const items = jornadas.filter((jornada) => !seleccionados.includes(jornada.fecha));
    persistir(items, `${seleccionados.length} día(s) restablecido(s) a la plantilla`);
  };

  const guardarPlantilla = async () => {
    if (!sedeId) return;
    if (plantillaForm.some((dia) => dia.abierto && (!dia.hora_inicio || !dia.hora_fin || dia.hora_inicio >= dia.hora_fin))) {
      onToast('Revisa los horarios de la plantilla', 'warning');
      return;
    }
    setGuardandoPlantilla(true);
    try {
      const respuesta = await api.reservas.jornada.updatePlantilla({ ubicacion_id: Number(sedeId), items: plantillaForm });
      const canceladas = respuesta?.reservas_canceladas?.length || 0;
      onToast(canceladas > 0
        ? `Plantilla guardada. ${canceladas} reserva(s) futura(s) cancelada(s).`
        : 'Plantilla semanal fija guardada', canceladas > 0 ? 'warning' : 'success');
      await cargar(sedeId);
    } catch (error) {
      onToast(error.message, 'error');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const presetPlantilla = (tipo) => {
    setPlantillaForm(DIAS_SEMANA.map((dia) => ({
      dia_semana: dia.numero,
      abierto: tipo === 'todos' ? true : tipo === 'sabado' ? dia.numero <= 6 : dia.numero <= 5,
      hora_inicio: '09:00',
      hora_fin: '18:00',
    })));
  };

  const abrirFestivo = (festivo) => {
    setFestivoModal(festivo);
    setFestivoForm({
      sedes: sedeId ? [Number(sedeId)] : [],
      hora_inicio: '09:00',
      hora_fin: '18:00',
    });
  };

  const guardarFestivo = async () => {
    if (!festivoForm?.sedes?.length) {
      onToast('Selecciona al menos una sede', 'warning');
      return;
    }
    setGuardando(true);
    try {
      await api.reservas.jornada.abrirFestivo({
        fecha: festivoModal.fecha,
        sedes: festivoForm.sedes,
        hora_inicio: festivoForm.hora_inicio,
        hora_fin: festivoForm.hora_fin,
      });
      onToast('Festivo abierto en las sedes seleccionadas');
      setFestivoModal(null);
      setFestivoForm(null);
      await cargar(sedeId);
    } catch (error) {
      onToast(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const chip = (jornada, dia) => {
    if (jornada?.cerrado) {
      return (
        <span className="inline-flex w-full min-w-0 flex-col rounded-md border border-advertencia/40 bg-advertencia/10 px-1.5 py-1 text-[10px] font-bold leading-tight text-advertencia">
          <span>{jornada.es_festivo ? 'Festivo' : 'Cerrado'}</span>
          <span className="line-clamp-2 font-normal">{jornada.motivo || 'Sin atención'}</span>
        </span>
      );
    }
    if (jornada) {
      return (
        <span className="inline-flex w-full min-w-0 flex-col rounded-md border px-1.5 py-1 text-[10px] font-bold leading-tight" style={estiloSede(indiceSede)}>
          <span>{jornada.hora_inicio}–{jornada.hora_fin}</span>
          <span className="font-normal">{jornada.es_plantilla ? 'Fijo' : 'Excepción'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md border border-dashed border-borde px-1.5 py-1 text-[10px] text-texto-secundario/70">
        {dia.esFestivo ? 'Festivo sin abrir' : 'Sin jornada'}
      </span>
    );
  };

  const festivosVisibles = useMemo(() => {
    const hoy = formatearFechaLocal(fechaHoyBogota());
    return festivos.filter((festivo) => festivo.fecha >= hoy).slice(0, 10);
  }, [festivos]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Departamento"
            options={[{ value: '', label: 'Todos los departamentos' }, ...departamentos.map((item) => ({ value: item, label: item }))]}
            value={departamentoFiltro}
            onChange={(e) => {
              setDepartamentoFiltro(e.target.value);
              setCiudadFiltro('');
            }}
          />
          <Select
            label="Ciudad"
            options={[{ value: '', label: 'Todas las ciudades' }, ...ciudades.map((item) => ({ value: item, label: item }))]}
            value={ciudadFiltro}
            onChange={(e) => setCiudadFiltro(e.target.value)}
          />
          <Select
            label="Sede"
            options={[{ value: '', label: cargandoSedes ? 'Cargando...' : 'Seleccionar sede...' }, ...sedesFiltradas.map((sede) => ({ value: String(sede.id), label: sede.nombre }))]}
            value={sedeId}
            onChange={(e) => cambiarSede(e.target.value)}
          />
        </div>
        {sedeId && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" aria-label="Semana anterior" onClick={() => setSemanaBase((prev) => sumarDias(prev, -7))}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
            <span className="whitespace-nowrap text-xs font-semibold text-texto-principal">
              {etiquetaDia(sumarDias(semanaBase, -14))} — {etiquetaDia(sumarDias(semanaBase, 20))}
            </span>
            <Button variant="outline" size="sm" aria-label="Semana siguiente" onClick={() => setSemanaBase((prev) => sumarDias(prev, 7))}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
            <Button variant="secundario" size="sm" onClick={() => setSemanaBase(lunesDeSemana(fechaHoyBogota()))}>Hoy</Button>
            <span className="whitespace-nowrap text-[11px] text-texto-secundario">{jornadas.length} excepciones</span>
          </div>
        )}
      </Card>

      {!sedeId ? (
        <Card className="py-10 text-center text-sm text-texto-secundario">Selecciona una sede para ver su plantilla y sus excepciones.</Card>
      ) : cargando ? (
        <Card className="flex justify-center py-12"><Spinner /></Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-texto-principal">
                  <Lock className="h-4 w-4 text-acento" aria-hidden="true" /> Plantilla semanal fija
                </h2>
                <p className="mt-0.5 text-xs text-texto-secundario">
                  Se repite todas las semanas. Las excepciones por fecha mandan sobre esta plantilla.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" onClick={() => presetPlantilla('laborables')}>Lun–Vie</Button>
                <Button variant="outline" size="sm" onClick={() => presetPlantilla('sabado')}>Lun–Sáb</Button>
                <Button variant="outline" size="sm" onClick={() => presetPlantilla('todos')}>Todos</Button>
                <Button size="sm" onClick={guardarPlantilla} disabled={guardandoPlantilla}>
                  {guardandoPlantilla ? <Spinner /> : 'Guardar plantilla'}
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {plantillaForm.map((dia, indice) => (
                <div key={dia.dia_semana} className={`rounded-lg border p-3 ${dia.abierto ? 'border-borde bg-superficie' : 'border-borde bg-panel/50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-texto-principal">{DIAS_SEMANA[indice].nombre}</p>
                    <button
                      type="button"
                      onClick={() => setPlantillaForm((prev) => prev.map((item) => item.dia_semana === dia.dia_semana ? { ...item, abierto: !item.abierto } : item))}
                      className={`rounded border px-2 py-0.5 text-[10px] font-medium ${dia.abierto ? 'border-exito/30 bg-exito/10 text-exito' : 'border-borde bg-panel text-texto-secundario'}`}
                    >
                      {dia.abierto ? 'Abierto' : 'Cerrado'}
                    </button>
                  </div>
                  {dia.abierto && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <input
                        type="time"
                        value={dia.hora_inicio}
                        onChange={(e) => setPlantillaForm((prev) => prev.map((item) => item.dia_semana === dia.dia_semana ? { ...item, hora_inicio: e.target.value } : item))}
                        className="w-full rounded border border-borde bg-superficie px-1.5 py-1 text-[11px]"
                        aria-label={`Hora inicio ${DIAS_SEMANA[indice].nombre}`}
                      />
                      <input
                        type="time"
                        value={dia.hora_fin}
                        onChange={(e) => setPlantillaForm((prev) => prev.map((item) => item.dia_semana === dia.dia_semana ? { ...item, hora_fin: e.target.value } : item))}
                        className="w-full rounded border border-borde bg-superficie px-1.5 py-1 text-[11px]"
                        aria-label={`Hora fin ${DIAS_SEMANA[indice].nombre}`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!plantillaActiva && (
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-advertencia">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Aún no hay plantilla guardada; las excepciones por fecha siguen funcionando.
              </p>
            )}
          </Card>

          <Card padding={false} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde p-3">
              <div>
                <h2 className="text-sm font-semibold text-texto-principal">Calendario de excepciones</h2>
                <p className="text-[11px] text-texto-secundario">Clic normal para editar un día; modo selección para trabajar varios días.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant={modoSeleccion ? 'primario' : 'outline'} size="sm" onClick={() => { setModoSeleccion((prev) => !prev); setSeleccionados([]); }}>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" /> Seleccionar días
                </Button>
                {modoSeleccion && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => seleccionar('todo')}>Todo</Button>
                    <Button variant="outline" size="sm" onClick={() => seleccionar('semana')}>Semana</Button>
                    <Button variant="outline" size="sm" onClick={() => seleccionar('laborables')}>Lun–Vie</Button>
                    <Button variant="outline" size="sm" onClick={() => seleccionar('fin')}>Fin de semana</Button>
                  </>
                )}
              </div>
            </div>

            {modoSeleccion && (
              <div className="flex flex-wrap items-end gap-2 border-b border-borde bg-panel/40 p-3">
                <div className="w-28"><Input label="Desde" type="time" value={bulk.horaInicio} onChange={(e) => setBulk((prev) => ({ ...prev, horaInicio: e.target.value }))} /></div>
                <div className="w-28"><Input label="Hasta" type="time" value={bulk.horaFin} onChange={(e) => setBulk((prev) => ({ ...prev, horaFin: e.target.value }))} /></div>
                <Button size="sm" onClick={() => aplicarSeleccion(false)} disabled={!seleccionados.length || guardando}>Aplicar horario</Button>
                <Button variant="dangerSuave" size="sm" onClick={() => aplicarSeleccion(true)} disabled={!seleccionados.length || guardando}>Cerrar días</Button>
                <Button variant="outline" size="sm" onClick={restablecerSeleccion} disabled={!seleccionados.length || guardando}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restablecer</Button>
                <span className="text-[11px] text-texto-secundario">{seleccionados.length} seleccionado(s)</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[760px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-borde bg-fondo/60">
                    <th className="sticky left-0 z-10 w-36 bg-fondo/95 px-3 py-3 text-left font-bold uppercase tracking-wider text-texto-secundario">Semana</th>
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
                      <th className="sticky left-0 z-10 bg-superficie px-4 py-2 text-left font-semibold text-texto-secundario">
                        <button type="button" onClick={() => modoSeleccion && alternarSemana(semana)} className={modoSeleccion ? 'cursor-pointer hover:text-texto-principal' : ''}>
                          {etiquetaDia(semana.inicio)} — {etiquetaDia(semana.fin)}
                          {semana.offset === 0 && <span className="ml-1.5 text-[10px] font-bold text-primario">Actual</span>}
                        </button>
                      </th>
                      {semana.dias.map((dia) => {
                        const efectiva = jornadaDe(dia);
                        const activa = modoSeleccion
                          ? seleccionados.includes(dia.iso)
                          : seleccion?.iso === dia.iso;
                        return (
                          <td key={dia.iso} className="border-l border-borde/30 p-1.5">
                            <button
                              type="button"
                              onClick={(evento) => toggleDia(dia, evento)}
                              aria-label={`${modoSeleccion ? 'Seleccionar' : 'Editar'} jornada del ${dia.nombre} ${etiquetaDia(dia.fecha)}`}
                              aria-pressed={modoSeleccion ? seleccionados.includes(dia.iso) : undefined}
                              className={`min-h-[58px] w-full rounded-lg border p-1.5 text-left transition-colors ${
                                activa
                                  ? 'border-primario bg-primario/5 ring-2 ring-primario/40'
                                  : 'border-borde hover:border-primario/60 hover:bg-fondo/40'
                              } ${dia.esHoy ? 'bg-primario/5' : ''}`}
                            >
                              {chip(efectiva, dia)}
                              {dia.esFestivo && <span className="mt-1 block text-[9px] font-medium text-advertencia">Festivo</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-texto-principal">
                <PartyPopper className="h-4 w-4 text-acento" aria-hidden="true" /> Festivos próximos
              </h2>
              <p className="mt-0.5 text-xs text-texto-secundario">Por defecto no se trabaja. Abre una o varias sedes si quieres operar.</p>
              <div className="mt-3 divide-y divide-regla">
                {festivosVisibles.length === 0 ? (
                  <p className="py-3 text-xs text-texto-secundario">No hay festivos en el rango visible.</p>
                ) : festivosVisibles.map((festivo) => {
                  const exacta = jornadas.find((jornada) => jornada.fecha === festivo.fecha);
                  return (
                    <div key={festivo.fecha} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-texto-principal">{festivo.nombre}</p>
                        <p className="text-[11px] text-texto-secundario">{etiquetaDia(new Date(`${festivo.fecha}T00:00:00`))}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {exacta && !exacta.cerrado ? (
                          <span className="text-[10px] text-exito">Abierto {exacta.hora_inicio}–{exacta.hora_fin}</span>
                        ) : (
                          <span className="text-[10px] text-tenue">Cerrado</span>
                        )}
                        <Button variant="outline" size="sm" onClick={() => abrirFestivo(festivo)}>Abrir en sedes</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-texto-principal">
                <CalendarRange className="h-4 w-4 text-acento" aria-hidden="true" /> Cómo usar
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-4 text-xs text-texto-secundario">
                <li>La plantilla fija se repite cada semana.</li>
                <li>Las excepciones por fecha mandan sobre la plantilla.</li>
                <li>El modo selección permite aplicar horarios o cerrar varios días a la vez.</li>
                <li>Los festivos de Colombia están cerrados por defecto.</li>
              </ul>
            </Card>
          </div>
        </>
      )}

      <Modal
        open={Boolean(seleccion)}
        onClose={() => setSeleccion(null)}
        title={seleccion ? `${seleccion.nombre} · ${etiquetaDia(seleccion.fecha)}` : 'Editar jornada'}
        size="wide"
      >
        {seleccion && (
          <div className="space-y-4">
            {seleccion.esFestivo && <p className="rounded-md border border-advertencia/30 bg-advertencia/10 p-2.5 text-[11px] text-advertencia">Este día es festivo. Puedes abrirlo como excepción.</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={!borrador.cerrado ? 'primario' : 'outline'} onClick={() => setBorrador((prev) => ({ ...prev, cerrado: false }))}>Abierto</Button>
              <Button size="sm" variant={borrador.cerrado ? 'primario' : 'outline'} onClick={() => setBorrador((prev) => ({ ...prev, cerrado: true }))}>Cerrado</Button>
            </div>
            {!borrador.cerrado && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Hora inicio" type="time" value={borrador.horaInicio} onChange={(e) => setBorrador((prev) => ({ ...prev, horaInicio: e.target.value }))} />
                <Input label="Hora fin" type="time" value={borrador.horaFin} onChange={(e) => setBorrador((prev) => ({ ...prev, horaFin: e.target.value }))} />
              </div>
            )}
            <p className="flex items-start gap-1.5 text-[11px] text-texto-secundario">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {seleccion.efectiva?.es_plantilla
                ? 'Este día usa la plantilla fija. Al guardar se creará una excepción.'
                : 'Este día tiene una excepción propia.'}
            </p>
            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-borde bg-superficie pt-3">
              <Button variant="secundario" onClick={() => setSeleccion(null)}>Cancelar</Button>
              {seleccion.efectiva?.es_plantilla && (
                <Button variant="outline" onClick={restablecerDia} disabled={guardando}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Quitar excepción
                </Button>
              )}
              <Button onClick={guardarDia} disabled={guardando}>{guardando ? <Spinner /> : 'Guardar día'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(festivoModal)}
        onClose={() => { setFestivoModal(null); setFestivoForm(null); }}
        title={festivoModal ? `Abrir ${festivoModal.nombre}` : 'Abrir festivo'}
        size="wide"
      >
        {festivoForm && festivoModal && (
          <div className="space-y-4">
            <p className="text-sm text-texto-secundario">Selecciona las sedes que abrirán ese festivo. Los empleados decidirán si quieren trabajar.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sedes.map((sede) => (
                <label key={sede.id} className="flex items-center gap-2 rounded-md border border-borde p-2 text-xs text-texto-principal">
                  <input
                    type="checkbox"
                    checked={festivoForm.sedes.includes(Number(sede.id))}
                    onChange={(e) => setFestivoForm((prev) => ({
                      ...prev,
                      sedes: e.target.checked
                        ? [...prev.sedes, Number(sede.id)]
                        : prev.sedes.filter((id) => id !== Number(sede.id)),
                    }))}
                  />
                  {sede.nombre}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Hora inicio" type="time" value={festivoForm.hora_inicio} onChange={(e) => setFestivoForm((prev) => ({ ...prev, hora_inicio: e.target.value }))} />
              <Input label="Hora fin" type="time" value={festivoForm.hora_fin} onChange={(e) => setFestivoForm((prev) => ({ ...prev, hora_fin: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 border-t border-borde pt-3">
              <Button variant="secundario" onClick={() => { setFestivoModal(null); setFestivoForm(null); }}>Cancelar</Button>
              <Button onClick={guardarFestivo} disabled={guardando}>{guardando ? <Spinner /> : 'Abrir festivo'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
