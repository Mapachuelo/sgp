import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Search, UserCog } from 'lucide-react';
import { Button, Card, Input, Select, Spinner } from '../../../componentes/ui/index.jsx';
import api from '../../../api/cliente.js';
import {
  DIAS_SEMANA,
  COLOR_ESTADO_CITA,
  estiloSede,
  fechaBogotaDeIso,
  fechaHoyBogota,
  formatearFechaLocal,
  horaBogotaDeIso,
  lunesDeSemana,
  sumarDias,
} from '../utils.js';

function EditorHorario({ empleado, dia, fecha, filaActual, sedes, onGuardar, onCerrar, guardando }) {
  const [sedeId, setSedeId] = useState(filaActual ? String(filaActual.ubicacion_id) : '');
  const [descanso, setDescanso] = useState(!filaActual);
  const [horaInicio, setHoraInicio] = useState(filaActual?.hora_inicio?.slice(0, 5) || '09:00');
  const [horaFin, setHoraFin] = useState(filaActual?.hora_fin?.slice(0, 5) || '18:00');

  const opciones = [
    { value: '', label: 'Descanso (sin horario)' },
    ...sedes.map((u) => ({ value: String(u.id), label: u.nombre })),
  ];

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="p-4 border-b border-borde bg-fondo/40">
        <p className="text-xs font-bold uppercase tracking-wider text-texto-secundario">Editar horario</p>
        <p className="font-display text-lg font-bold text-texto-principal mt-1">
          {empleado.nombre} {empleado.apellido}
        </p>
        <p className="text-xs text-texto-secundario">{dia.nombre} · {fecha}</p>
      </div>
      <div className="p-4 space-y-4">
        <Select
          label="Sede del dia"
          options={opciones}
          value={descanso ? '' : sedeId}
          onChange={(e) => {
            const valor = e.target.value;
            setSedeId(valor);
            setDescanso(!valor);
          }}
        />
        {!descanso && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Hora inicio" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            <Input label="Hora fin" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </div>
        )}
        <p className="text-[11px] text-texto-secundario bg-fondo/60 border border-borde rounded-lg p-2.5">
          Un empleado solo puede tener una sede por dia. Si cambia la sede de un dia con reservas futuras, se cancelaran
          automaticamente con el motivo <strong>&quot;El empleado cambió de sede&quot;</strong> y se notificara a los clientes.
        </p>
        <div className="flex gap-2">
          <Button
            variant="primario"
            className="flex-1"
            disabled={guardando}
            onClick={() =>
              onGuardar({
                descanso,
                sedeId,
                horaInicio,
                horaFin,
              })
            }
          >
            {guardando ? <Spinner /> : 'Guardar dia'}
          </Button>
          <Button variant="secundario" onClick={onCerrar}>Cancelar</Button>
        </div>
      </div>
    </Card>
  );
}

export default function PlanificadorHorarios({ onToast, onValidarCita }) {
  const [empleados, setEmpleados] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [semanaInicio, setSemanaInicio] = useState(() => lunesDeSemana(fechaHoyBogota()));
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroSede, setFiltroSede] = useState('');
  const [soloConHorario, setSoloConHorario] = useState(false);
  const [seleccion, setSeleccion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const desde = formatearFechaLocal(semanaInicio);
      const hasta = formatearFechaLocal(sumarDias(semanaInicio, 6));
      const [emps, ubis, disp, ag] = await Promise.all([
        api.auth.empleados.list(),
        api.ubicaciones.list(),
        api.disponibilidad.todas(),
        api.reservas.agenda({ desde, hasta }),
      ]);
      setEmpleados(Array.isArray(emps) ? emps : []);
      setSedes(Array.isArray(ubis) ? ubis : []);
      setDisponibilidad(Array.isArray(disp) ? disp : []);
      setAgenda(Array.isArray(ag) ? ag : []);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [semanaInicio, onToast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const indiceSede = useCallback((ubicacionId) => sedes.findIndex((u) => u.id === ubicacionId), [sedes]);

  const mapaDisponibilidad = useMemo(() => {
    const mapa = new Map();
    disponibilidad.forEach((fila) => {
      mapa.set(`${fila.empleado_id}-${fila.dia_semana}`, fila);
    });
    return mapa;
  }, [disponibilidad]);

  const mapaAgenda = useMemo(() => {
    const mapa = new Map();
    agenda.forEach((cita) => {
      const clave = `${cita.empleado_id}-${fechaBogotaDeIso(cita.inicia_en)}`;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(cita);
    });
    mapa.forEach((lista) => lista.sort((a, b) => a.inicia_en.localeCompare(b.inicia_en)));
    return mapa;
  }, [agenda]);

  const dias = DIAS_SEMANA.map((dia, indice) => {
    const fecha = sumarDias(semanaInicio, indice);
    return { ...dia, fecha: formatearFechaLocal(fecha), fechaObj: fecha };
  });

  const empleadosFiltrados = useMemo(() => {
    const termino = filtroNombre.trim().toLowerCase();
    return empleados.filter((emp) => {
      const nombreCompleto = `${emp.nombre} ${emp.apellido}`.toLowerCase();
      if (termino && !nombreCompleto.includes(termino)) return false;
      const filas = disponibilidad.filter((d) => d.empleado_id === emp.id);
      if (soloConHorario && filas.length === 0) return false;
      if (filtroSede && !filas.some((d) => String(d.ubicacion_id) === String(filtroSede))) return false;
      return true;
    });
  }, [empleados, disponibilidad, filtroNombre, filtroSede, soloConHorario]);

  const totalCitasSemana = agenda.length;
  const rangoTexto = `${dias[0].fechaObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} – ${dias[6].fechaObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const guardarDia = async (empleado, dia, datos) => {
    const citasDelDia = mapaAgenda.get(`${empleado.id}-${dias.find((d) => d.numero === dia.numero)?.fecha}`) || [];
    const filaActual = mapaDisponibilidad.get(`${empleado.id}-${dia.numero}`);
    if (!datos.descanso && filaActual && Number(datos.sedeId) !== filaActual.ubicacion_id) {
      const futuras = citasDelDia.filter((c) => ['pendiente', 'confirmada'].includes(c.estado));
      if (futuras.length > 0) {
        const continuar = window.confirm(
          `Cambiar la sede del ${dia.nombre} cancelara ${futuras.length} reserva(s) futura(s) de ese dia en la sede anterior. ¿Continuar?`
        );
        if (!continuar) return;
      }
    }

    const items = disponibilidad
      .filter((d) => d.empleado_id === empleado.id && d.dia_semana !== dia.numero)
      .map((d) => ({
        dia_semana: d.dia_semana,
        ubicacion_id: d.ubicacion_id,
        hora_inicio: d.hora_inicio,
        hora_fin: d.hora_fin,
      }));
    if (!datos.descanso) {
      items.push({
        dia_semana: dia.numero,
        ubicacion_id: Number(datos.sedeId),
        hora_inicio: datos.horaInicio,
        hora_fin: datos.horaFin,
      });
    }

    setGuardando(true);
    try {
      const respuesta = await api.disponibilidad.updateByAdmin(empleado.id, items);
      const canceladas = respuesta?.reservas_canceladas?.length || 0;
      if (canceladas > 0) {
        onToast?.(`Horario actualizado. ${canceladas} reserva(s) cancelada(s) por cambio de sede.`, 'warning');
      } else {
        onToast?.('Horario actualizado');
      }
      setSeleccion(null);
      await cargar();
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        <Card padding={false} className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" aria-label="Semana anterior" onClick={() => setSemanaInicio((s) => sumarDias(s, -7))}>
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </Button>
              <div className="text-center px-2">
                <p className="text-sm font-bold text-texto-principal flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-primario" aria-hidden="true" /> {rangoTexto}
                </p>
                <p className="text-[11px] text-texto-secundario">{empleadosFiltrados.length} empleado(s) · {totalCitasSemana} cita(s)</p>
              </div>
              <Button variant="outline" size="sm" aria-label="Semana siguiente" onClick={() => setSemanaInicio((s) => sumarDias(s, 7))}>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button variant="secundario" size="sm" onClick={() => setSemanaInicio(lunesDeSemana(fechaHoyBogota()))}>
                Hoy
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-secundario" aria-hidden="true" />
                <input
                  type="text"
                  value={filtroNombre}
                  onChange={(e) => setFiltroNombre(e.target.value)}
                  placeholder="Buscar empleado..."
                  aria-label="Buscar empleado"
                  className="pl-8 pr-3 py-2 border border-borde rounded-lg text-xs bg-superficie focus:outline-none focus:ring-2 focus:ring-primario/30"
                />
              </div>
              <select
                value={filtroSede}
                onChange={(e) => setFiltroSede(e.target.value)}
                aria-label="Filtrar por sede"
                className="px-3 py-2 border border-borde rounded-lg text-xs bg-superficie focus:outline-none"
              >
                <option value="">Todas las sedes</option>
                {sedes.map((u) => (
                  <option key={u.id} value={String(u.id)}>{u.nombre}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-texto-secundario select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={soloConHorario}
                  onChange={(e) => setSoloConHorario(e.target.checked)}
                  className="rounded border-borde text-primario w-4 h-4 cursor-pointer"
                />
                Solo con horario
              </label>
            </div>
          </div>
        </Card>

        {cargando ? (
          <Card className="flex justify-center py-16"><Spinner /></Card>
        ) : empleadosFiltrados.length === 0 ? (
          <Card className="text-center py-12 text-texto-secundario text-sm">No hay empleados para los filtros seleccionados.</Card>
        ) : (
          <Card padding={false} className="overflow-hidden">
            <div className="overflow-x-auto max-h-[62vh] overflow-y-auto">
              <table className="w-full text-xs border-collapse min-w-[1080px]">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-fondo/95 backdrop-blur border-b border-borde">
                    <th className="sticky left-0 z-30 bg-fondo/95 text-left px-4 py-3 font-bold text-texto-secundario uppercase tracking-wider w-56">
                      Empleado
                    </th>
                    {dias.map((dia) => {
                      const esHoy = dia.fecha === formatearFechaLocal(fechaHoyBogota());
                      return (
                        <th key={dia.numero} className={`px-2 py-3 text-center font-bold ${esHoy ? 'text-primario' : 'text-texto-principal'}`}>
                          <span className="block text-[10px] uppercase tracking-wider text-texto-secundario">{dia.corto}</span>
                          <span className="font-display text-sm">{dia.fechaObj.getDate()}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {empleadosFiltrados.map((emp) => (
                    <tr key={emp.id} className="border-b border-borde/40 align-top hover:bg-fondo/20 transition-colors">
                      <th scope="row" className="sticky left-0 z-10 bg-superficie text-left px-4 py-3 font-semibold text-texto-principal">
                        <span className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-primario/10 text-primario text-[10px] font-bold flex items-center justify-center">
                            {(emp.nombre?.[0] || '') + (emp.apellido?.[0] || '')}
                          </span>
                          <span>
                            <span className="block">{emp.nombre} {emp.apellido}</span>
                            <span className="block text-[10px] font-normal text-texto-secundario">{emp.email}</span>
                          </span>
                        </span>
                      </th>
                      {dias.map((dia) => {
                        const fila = mapaDisponibilidad.get(`${emp.id}-${dia.numero}`);
                        const citas = mapaAgenda.get(`${emp.id}-${dia.fecha}`) || [];
                        const activa = seleccion?.empleado?.id === emp.id && seleccion?.dia?.numero === dia.numero;
                        return (
                          <td key={dia.numero} className="p-1.5 border-l border-borde/30">
                            <button
                              type="button"
                              onClick={() => setSeleccion({ empleado: emp, dia })}
                              className={`w-full text-left rounded-lg border p-1.5 min-h-[62px] transition cursor-pointer ${
                                activa ? 'ring-2 ring-primario/50 border-primario' : 'border-borde hover:border-primario/60 hover:bg-fondo/40'
                              }`}
                              aria-label={`Editar horario de ${emp.nombre} el ${dia.nombre}`}
                            >
                              {fila ? (
                                <span
                                  className="inline-flex flex-col rounded-md border px-1.5 py-1 text-[10px] font-bold leading-tight"
                                  style={estiloSede(indiceSede(fila.ubicacion_id))}
                                >
                                  <span>{fila.ubicacion_nombre.replace('Demo Sede ', '')}</span>
                                  <span className="font-normal">{fila.hora_inicio.slice(0, 5)}-{fila.hora_fin.slice(0, 5)}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-texto-secundario/70 border border-dashed border-borde rounded-md px-1.5 py-1 inline-block">
                                  Sin horario
                                </span>
                              )}
                              {citas.length > 0 && (
                                <span className="flex flex-wrap gap-1 mt-1">
                                  {citas.slice(0, 2).map((cita) => {
                                    const color = COLOR_ESTADO_CITA[cita.estado] || COLOR_ESTADO_CITA.pendiente;
                                    const clickeable = ['pendiente', 'confirmada'].includes(cita.estado);
                                    return (
                                      <span
                                        key={cita.id}
                                        role={clickeable ? 'button' : undefined}
                                        tabIndex={clickeable ? 0 : undefined}
                                        title={`${horaBogotaDeIso(cita.inicia_en)} ${cita.cliente_nombre || ''} · ${cita.servicio_nombre || ''} (${cita.estado})`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (clickeable) onValidarCita?.(cita);
                                        }}
                                        onKeyDown={(e) => {
                                          if (clickeable && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onValidarCita?.(cita);
                                          }
                                        }}
                                        className={`text-[9px] font-bold rounded px-1 py-0.5 border ${clickeable ? 'cursor-pointer hover:brightness-95' : ''}`}
                                        style={{ backgroundColor: color.bg, color: color.texto, borderColor: color.borde }}
                                      >
                                        {horaBogotaDeIso(cita.inicia_en)} {cita.cliente_nombre || 'Cita'}
                                      </span>
                                    );
                                  })}
                                  {citas.length > 2 && (
                                    <span className="text-[9px] text-texto-secundario font-bold">+{citas.length - 2}</span>
                                  )}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-borde/60 flex flex-wrap gap-4 text-[10px] text-texto-secundario">
              {sedes.map((sede) => (
                <span key={sede.id} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded border" style={estiloSede(indiceSede(sede.id))} /> {sede.nombre}
                </span>
              ))}
              <span className="flex items-center gap-1.5 border-l border-borde pl-4">
                <UserCog className="w-3 h-3" aria-hidden="true" /> Clic en una celda para editar; clic en una cita pendiente abre el modal de validacion.
              </span>
            </div>
          </Card>
        )}
      </div>

      <aside className="xl:sticky xl:top-4 space-y-4">
        {seleccion ? (
          <EditorHorario
            key={`${seleccion.empleado.id}-${seleccion.dia.numero}`}
            empleado={seleccion.empleado}
            dia={seleccion.dia}
            fecha={seleccion.dia.fecha}
            filaActual={mapaDisponibilidad.get(`${seleccion.empleado.id}-${seleccion.dia.numero}`)}
            sedes={sedes}
            guardando={guardando}
            onGuardar={(datos) => guardarDia(seleccion.empleado, seleccion.dia, datos)}
            onCerrar={() => setSeleccion(null)}
          />
        ) : (
          <Card>
            <p className="text-sm font-semibold text-texto-principal mb-1">Como funciona</p>
            <ul className="text-xs text-texto-secundario space-y-2 list-disc pl-4">
              <li>La matriz muestra la semana de cada empleado (una sola sede por dia).</li>
              <li>Las etiquetas sobre el horario son las citas reales de la semana.</li>
              <li>Al cambiar la sede de un dia se cancelan las reservas futuras de ese dia y se notifica al cliente (RF9).</li>
              <li>Los cambios se guardan con la semana completa del empleado.</li>
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}