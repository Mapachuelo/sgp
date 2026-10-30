import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Coffee, MapPin, Plus, Trash2 } from 'lucide-react';
import api from '../../api/cliente';
import { useAuth } from '../../hooks/use-auth.js';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Textarea,
  Toast,
} from '../../componentes/ui/index.jsx';
import CambiosTemporales from '../../componentes/disponibilidad/cambios-temporales.jsx';

const DIAS = [
  { nombre: 'Lunes', corto: 'Lun' },
  { nombre: 'Martes', corto: 'Mar' },
  { nombre: 'Miércoles', corto: 'Mié' },
  { nombre: 'Jueves', corto: 'Jue' },
  { nombre: 'Viernes', corto: 'Vie' },
  { nombre: 'Sábado', corto: 'Sáb' },
  { nombre: 'Domingo', corto: 'Dom' },
];

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'disponible', label: 'Con horario' },
  { value: 'descanso', label: 'Descanso' },
  { value: 'sin_sede', label: 'Sin sede' },
  { value: 'cerrada', label: 'Sede cerrada' },
  { value: 'temporal', label: 'Cambio temporal' },
  { value: 'festivo', label: 'Festivo' },
  { value: 'bloqueado', label: 'Bloqueado' },
];

function minutos(hora) {
  const [h, m] = String(hora).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function horaValida(hora) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora || '').slice(0, 5));
}

function fechaLocal(fecha) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

function sumarDias(fecha, dias) {
  return new Date(fecha.getTime() + dias * 86400000);
}

function lunesDeSemana(fecha) {
  const dia = new Date(fecha);
  const actual = dia.getDay() || 7;
  dia.setDate(dia.getDate() - (actual - 1));
  dia.setHours(0, 0, 0, 0);
  return dia;
}

function fechaHoyBogota() {
  return new Date(`${fechaLocal(new Date())}T00:00:00`);
}

function horaTexto(iso) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function etiquetaFecha(texto) {
  return new Date(`${String(texto).slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

function nombreSedeCorto(nombre) {
  return String(nombre || '').replace(/^(Pruebas|Demo) Sede /, '');
}

function normalizarDescansos(descansos) {
  return (Array.isArray(descansos) ? descansos : [])
    .map((item) => ({
      inicio: String(item.inicio || item.hora_inicio || '').slice(0, 5),
      fin: String(item.fin || item.hora_fin || '').slice(0, 5),
    }))
    .filter((item) => item.inicio && item.fin)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function tramos(dia) {
  if (!dia?.sedeId || dia.descanso) return [];
  const inicio = minutos(dia.horaInicio);
  const fin = minutos(dia.horaFin);
  if (!horaValida(dia.horaInicio) || !horaValida(dia.horaFin) || inicio >= fin) return [];
  const intervalos = [];
  let cursor = inicio;
  normalizarDescansos(dia.descansos).forEach((descanso) => {
    const desde = minutos(descanso.inicio);
    const hasta = minutos(descanso.fin);
    if (desde > cursor) intervalos.push([cursor, desde]);
    cursor = Math.max(cursor, hasta);
  });
  if (cursor < fin) intervalos.push([cursor, fin]);
  return intervalos.map(([desde, hasta]) => `${String(Math.floor(desde / 60)).padStart(2, '0')}:${String(desde % 60).padStart(2, '0')}–${String(Math.floor(hasta / 60)).padStart(2, '0')}:${String(hasta % 60).padStart(2, '0')}`);
}

export default function EmpleadoDisponibilidad() {
  const { usuario } = useAuth();
  const [vista, setVista] = useState('semana');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [dias, setDias] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [festivos, setFestivos] = useState([]);
  const [jornadasPorSede, setJornadasPorSede] = useState({});
  const [festivosEmpleado, setFestivosEmpleado] = useState([]);
  const [misServicios, setMisServicios] = useState([]);
  const [semanaBase, setSemanaBase] = useState(() => lunesDeSemana(new Date()));
  const [temporales, setTemporales] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [modoDescanso, setModoDescanso] = useState('todo');
  const [descansosRango, setDescansosRango] = useState([{ inicio: '12:00', fin: '14:00' }]);
  const [guardandoDescanso, setGuardandoDescanso] = useState(false);
  const [conflictoDescanso, setConflictoDescanso] = useState(null);
  const [filtroSede, setFiltroSede] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(null);
  const [festivoEditor, setFestivoEditor] = useState(null);
  const [festivoForm, setFestivoForm] = useState(null);
  const [cancelarDia, setCancelarDia] = useState(null);
  const [motivoImprevisto, setMotivoImprevisto] = useState('');
  const [resumenDia, setResumenDia] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3200);
  };

  const sedeDe = useCallback((id) => sedes.find((sede) => String(sede.id) === String(id)), [sedes]);
  const plantillaDe = useCallback(
    (sedeId, diaSemana) => plantillas.find(
      (fila) => String(fila.ubicacion_id) === String(sedeId) && Number(fila.dia_semana) === Number(diaSemana)
    ),
    [plantillas]
  );
  const sedeCerrada = useCallback(
    (sedeId, diaSemana) => {
      if (!sedeId) return false;
      const plantilla = plantillaDe(sedeId, diaSemana);
      return Boolean(plantilla && !plantilla.abierto);
    },
    [plantillaDe]
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const hoy = fechaLocal(new Date());
      const hasta = fechaLocal(sumarDias(new Date(), 60));
      const [dispData, ubiData, prefData, misTiempos, plantillaData, festivosData, festivosEmpleadoData, temporalesData] = await Promise.all([
        api.disponibilidad.get(),
        api.ubicaciones.list().catch(() => []),
        api.preferencias.get().catch(() => null),
        api.reservas.empleadoTiempos.get('').catch(() => []),
        api.reservas.jornada.getPlantilla().catch(() => []),
        api.reservas.festivos(hoy, hasta).catch(() => []),
        api.disponibilidad.festivos({ desde: hoy, hasta }).catch(() => []),
        api.disponibilidad.temporales().catch(() => []),
      ]);

      const ubicaciones = Array.isArray(ubiData) ? ubiData : [];
      setSedes(ubicaciones);
      setPlantillas(Array.isArray(plantillaData) ? plantillaData : []);
      setFestivos(Array.isArray(festivosData) ? festivosData : []);
      setFestivosEmpleado(Array.isArray(festivosEmpleadoData) ? festivosEmpleadoData : []);
      setMisServicios(Array.isArray(misTiempos) ? misTiempos : []);
      setTemporales(Array.isArray(temporalesData) ? temporalesData : []);

      const jornadas = await Promise.all(
        ubicaciones.map((sede) => api.reservas.jornada.get(sede.id).catch(() => []))
      );
      const mapaJornadas = {};
      ubicaciones.forEach((sede, indice) => {
        mapaJornadas[sede.id] = Array.isArray(jornadas[indice]) ? jornadas[indice] : [];
      });
      setJornadasPorSede(mapaJornadas);

      const inicioPreferido = prefData?.rango_hora_desde?.slice(0, 5) || '09:00';
      const finPreferido = prefData?.rango_hora_hasta?.slice(0, 5) || '18:00';
      const filas = Array.isArray(dispData) ? dispData : [];
      const nuevosDias = DIAS.map((_, indice) => {
        const fila = filas.find((item) => Number(item.dia_semana) === indice + 1);
        if (!fila) {
          return {
            sedeId: '',
            horaInicio: inicioPreferido,
            horaFin: finPreferido,
            descansos: [],
            descanso: false,
          };
        }
        return {
          sedeId: String(fila.ubicacion_id),
          horaInicio: String(fila.hora_inicio || inicioPreferido).slice(0, 5),
          horaFin: String(fila.hora_fin || finPreferido).slice(0, 5),
          descansos: normalizarDescansos(fila.descansos),
          descanso: Boolean(fila.descanso),
        };
      });
      setDias(nuevosDias);
    } catch (error) {
      mostrarToast(error.message || 'No se pudo cargar la disponibilidad', 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarBloqueos = useCallback(async () => {
    const desde = fechaLocal(sumarDias(semanaBase, -7));
    const hasta = fechaLocal(sumarDias(semanaBase, 13));
    try {
      const data = await api.disponibilidad.bloqueos({ desde, hasta });
      setBloqueos(Array.isArray(data) ? data : []);
    } catch {
      setBloqueos([]);
    }
  }, [semanaBase]);

  useEffect(() => {
    cargarBloqueos();
  }, [cargarBloqueos]);

  const departamentos = useMemo(
    () => [...new Set(sedes.map((sede) => sede.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [sedes]
  );
  const ciudades = useMemo(
    () => [...new Set(
      sedes
        .filter((sede) => !filtroDepartamento || sede.departamento === filtroDepartamento)
        .map((sede) => sede.ciudad)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b)),
    [sedes, filtroDepartamento]
  );

  const diasSemana = useMemo(
    () => DIAS.map((dia, indice) => {
      const fecha = sumarDias(semanaBase, indice);
      const fechaTexto = fechaLocal(fecha);
      const base = dias[indice] || {
        sedeId: '',
        horaInicio: '09:00',
        horaFin: '18:00',
        descansos: [],
        descanso: false,
      };
      const bloqueo = bloqueos.find(
        (item) => String(item.fecha).slice(0, 10) === fechaTexto
      );
      const festivo = festivos.find((item) => String(item.fecha).slice(0, 10) === fechaTexto);
      const optIn = festivosEmpleado.find(
        (item) => String(item.fecha).slice(0, 10) === fechaTexto
      );
      const temporal = temporales.find((item) => {
        const desde = String(item.desde).slice(0, 10);
        const hasta = String(item.hasta).slice(0, 10);
        return fechaTexto >= desde && fechaTexto <= hasta
          && (item.dias_semana || []).map(Number).includes(indice + 1);
      });
      const sedeId = String(optIn?.ubicacion_id || temporal?.ubicacion_id || base.sedeId || '');
      const sede = sedeDe(sedeId);
      const plantilla = plantillaDe(sedeId, indice + 1);
      const vista = optIn
        ? {
          ...base,
          sedeId: String(optIn.ubicacion_id),
          horaInicio: String(optIn.hora_inicio).slice(0, 5),
          horaFin: String(optIn.hora_fin).slice(0, 5),
          descansos: normalizarDescansos(optIn.descansos),
          descanso: false,
        }
        : { ...base, sedeId };
      let estado = 'sin_sede';
      if (bloqueo) estado = 'bloqueado';
      else if (festivo) estado = optIn ? 'festivo' : 'festivo_cerrado';
      else if (!sedeId) estado = 'sin_sede';
      else if (plantilla && !plantilla.abierto) estado = 'cerrada';
      else if (base.descanso) estado = 'descanso';
      else if (temporal) estado = 'temporal';
      else if (tramos(vista).length > 0) estado = 'disponible';
      return {
        ...dia,
        indice,
        fecha,
        fechaTexto,
        base,
        vista,
        sedeId,
        sede,
        plantilla,
        bloqueo,
        festivo,
        optIn,
        temporal,
        estado,
      };
    }),
    [semanaBase, dias, bloqueos, festivos, festivosEmpleado, temporales, sedeDe, plantillaDe]
  );

  const diasVisibles = useMemo(
    () => diasSemana.filter((dia) => {
      if (filtroSede && String(dia.sedeId) !== filtroSede) return false;
      if (filtroEstado) {
        const estadoFiltro = dia.estado === 'festivo_cerrado' ? 'festivo' : dia.estado;
        if (estadoFiltro !== filtroEstado) return false;
      }
      if (filtroDepartamento && dia.sede?.departamento !== filtroDepartamento) return false;
      if (filtroCiudad && dia.sede?.ciudad !== filtroCiudad) return false;
      return true;
    }),
    [diasSemana, filtroSede, filtroEstado, filtroDepartamento, filtroCiudad]
  );

  const rangoSemana = `${etiquetaFecha(fechaLocal(semanaBase))} – ${etiquetaFecha(fechaLocal(sumarDias(semanaBase, 6)))}`;

  const sedesDelDia = (indice) => sedes.filter((sede) => {
    const plantilla = plantillaDe(sede.id, indice + 1);
    return !plantilla || plantilla.abierto;
  });

  const abrirEditor = (indice) => {
    const actual = dias[indice];
    const abiertas = sedesDelDia(indice);
    const sedeInicial = actual.sedeId || String(abiertas[0]?.id || '');
    setForm({
      sedeId: sedeInicial,
      horaInicio: actual.horaInicio || '09:00',
      horaFin: actual.horaFin || '18:00',
      descansos: normalizarDescansos(actual.descansos),
      descanso: actual.descanso,
    });
    setEditor(indice);
  };

  const cambiarDescanso = (posicion, campo, valor) => {
    setForm((prev) => ({
      ...prev,
      descansos: prev.descansos.map((descanso, indice) => (
        indice === posicion ? { ...descanso, [campo]: valor } : descanso
      )),
    }));
  };

  const agregarDescanso = () => {
    setForm((prev) => ({
      ...prev,
      descansos: [...prev.descansos, { inicio: '12:00', fin: '14:00' }],
    }));
  };

  const quitarDescanso = (posicion) => {
    setForm((prev) => ({
      ...prev,
      descansos: prev.descansos.filter((_, indice) => indice !== posicion),
    }));
  };

  const guardarDiaEditor = () => {
    if (!form.sedeId) {
      mostrarToast('Selecciona una sede', 'warning');
      return;
    }
    if (!form.descanso) {
      if (!horaValida(form.horaInicio) || !horaValida(form.horaFin) || minutos(form.horaInicio) >= minutos(form.horaFin)) {
        mostrarToast('La hora fin debe ser mayor a la hora inicio', 'warning');
        return;
      }
      let cursor = minutos(form.horaInicio);
      for (const descanso of normalizarDescansos(form.descansos)) {
        if (!horaValida(descanso.inicio) || !horaValida(descanso.fin)
          || minutos(descanso.inicio) < cursor || minutos(descanso.fin) <= minutos(descanso.inicio)
          || minutos(descanso.fin) > minutos(form.horaFin)) {
          mostrarToast('Revisa los descansos: deben estar dentro del horario y no superponerse', 'warning');
          return;
        }
        cursor = minutos(descanso.fin);
      }
    }
    setDias((prev) => prev.map((dia, indice) => (
      indice === editor
        ? {
          ...form,
          descansos: form.descanso ? [] : normalizarDescansos(form.descansos),
        }
        : dia
    )));
    setEditor(null);
    setForm(null);
  };

  const proximaFechaDia = (indice) => {
    const hoy = new Date(`${fechaLocal(new Date())}T00:00:00`);
    const actual = hoy.getDay() || 7;
    const objetivo = indice + 1;
    const delta = (objetivo - actual + 7) % 7;
    const fecha = new Date(hoy.getTime() + delta * 86400000);
    return fechaLocal(fecha);
  };

  const agregarRangoDescanso = () => {
    setDescansosRango((prev) => [...prev, { inicio: '12:00', fin: '14:00' }]);
  };

  const cambiarRangoDescanso = (indice, campo, valor) => {
    setDescansosRango((prev) => prev.map((rango, posicion) => (
      posicion === indice ? { ...rango, [campo]: valor } : rango
    )));
  };

  const quitarRangoDescanso = (indice) => {
    setDescansosRango((prev) => (
      prev.length <= 1 ? prev : prev.filter((_, posicion) => posicion !== indice)
    ));
  };

  const configuracionDescanso = (indice) => {
    if (modoDescanso === 'todo') return { descanso: true, descansos: [] };
    const dia = dias[indice];
    if (!dia) return null;
    const ordenados = [...descansosRango]
      .map((rango) => ({ inicio: rango.inicio, fin: rango.fin }))
      .sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
    if (ordenados.length === 0) return null;
    let cursor = minutos(dia.horaInicio);
    const finDia = minutos(dia.horaFin);
    const normalizados = [];
    for (const rango of ordenados) {
      if (!horaValida(rango.inicio) || !horaValida(rango.fin)
        || minutos(rango.inicio) < cursor
        || minutos(rango.fin) <= minutos(rango.inicio)
        || minutos(rango.fin) > finDia) {
        return null;
      }
      normalizados.push(rango);
      cursor = minutos(rango.fin);
    }
    return { descanso: false, descansos: normalizados };
  };

  const guardarDescansos = async (items, confirmar = false) => {
    if (items.length === 0) return;
    setGuardandoDescanso(true);
    try {
      const respuesta = await api.disponibilidad.descansos({
        items,
        confirmar_cancelaciones: confirmar,
      });
      const porDia = new Map(
        (respuesta?.descansos || []).map((item) => [Number(item.dia_semana), item])
      );
      setDias((prev) => prev.map((dia, indice) => {
        const actualizado = porDia.get(indice + 1);
        if (!actualizado) return dia;
        return {
          ...dia,
          descanso: Boolean(actualizado.descanso),
          descansos: normalizarDescansos(actualizado.descansos),
        };
      }));
      if (respuesta?.total_canceladas > 0) {
        mostrarToast(
          `${respuesta.total_canceladas} cita(s) cancelada(s) por el nuevo descanso`,
          'warning'
        );
      }
    } catch (error) {
      if (error.detalles?.codigo === 'CONFLICTOS_DESCANSO') {
        setConflictoDescanso({ items, conflictos: error.detalles.conflictos || [] });
        return;
      }
      mostrarToast(error.message || 'No se pudo guardar el descanso', 'error');
    } finally {
      setGuardandoDescanso(false);
    }
  };

  const alternarDescansoDia = (indice) => {
    const dia = dias[indice];
    if (!dia?.sedeId) {
      mostrarToast('Asigna una sede a ese día antes de marcar descanso', 'warning');
      return;
    }
    if (sedeCerrada(dia.sedeId, indice + 1)) {
      mostrarToast('La sede no abre ese día', 'warning');
      return;
    }
    const configuracion = configuracionDescanso(indice);
    if (!configuracion) {
      mostrarToast(`El rango debe estar dentro del horario del ${DIAS[indice].nombre}`, 'warning');
      return;
    }
    const actuales = normalizarDescansos(dia.descansos);
    const mismo = Boolean(dia.descanso) === configuracion.descanso
      && JSON.stringify(actuales) === JSON.stringify(configuracion.descansos);
    const nuevo = mismo ? { descanso: false, descansos: [] } : configuracion;
    guardarDescansos([{ dia_semana: indice + 1, ...nuevo }]);
  };

  const limpiarDescansos = () => {
    const items = dias
      .map((dia, indice) => (
        dia.sedeId
          ? { dia_semana: indice + 1, descanso: false, descansos: [] }
          : null
      ))
      .filter(Boolean);
    if (items.length === 0) {
      mostrarToast('No hay días con sede para limpiar', 'warning');
      return;
    }
    guardarDescansos(items);
  };

  const marcarTodosDescanso = () => {
    const items = [];
    for (let indice = 0; indice < dias.length; indice += 1) {
      const dia = dias[indice];
      if (!dia.sedeId || sedeCerrada(dia.sedeId, indice + 1)) continue;
      const configuracion = configuracionDescanso(indice);
      if (!configuracion) {
        mostrarToast(`El rango debe estar dentro del horario del ${DIAS[indice].nombre}`, 'warning');
        return;
      }
      items.push({ dia_semana: indice + 1, ...configuracion });
    }
    if (items.length === 0) {
      mostrarToast('Asigna al menos una sede primero', 'warning');
      return;
    }
    guardarDescansos(items);
  };

  const confirmarConflictoDescanso = async () => {
    if (!conflictoDescanso) return;
    const items = conflictoDescanso.items;
    setConflictoDescanso(null);
    await guardarDescansos(items, true);
  };

  const abrirCancelarDia = async (indice) => {
    const fecha = proximaFechaDia(indice);
    setCancelarDia({ indice, fecha, cargando: true, reservas: [] });
    setMotivoImprevisto('');
    setResumenDia(null);
    try {
      const data = await api.reservas.empleadoDia(fecha);
      const reservas = Array.isArray(data) ? data : [];
      setResumenDia(reservas);
      setCancelarDia({ indice, fecha, cargando: false, reservas });
    } catch (error) {
      mostrarToast(error.message || 'No se pudieron consultar las reservas', 'error');
      setCancelarDia({ indice, fecha, cargando: false, reservas: [] });
    }
  };

  const cambiarFechaCancelar = async (fecha) => {
    if (!cancelarDia) return;
    setCancelarDia({ ...cancelarDia, fecha, cargando: true, reservas: [] });
    setResumenDia(null);
    try {
      const data = await api.reservas.empleadoDia(fecha);
      const reservas = Array.isArray(data) ? data : [];
      setResumenDia(reservas);
      setCancelarDia({ ...cancelarDia, fecha, cargando: false, reservas });
    } catch (error) {
      mostrarToast(error.message || 'No se pudieron consultar las reservas', 'error');
      setCancelarDia({ ...cancelarDia, fecha, cargando: false, reservas: [] });
    }
  };

  const confirmarCancelarDia = async () => {
    if (!cancelarDia) return;
    if (motivoImprevisto.trim().length < 4) {
      mostrarToast('Escribe el motivo del imprevisto', 'warning');
      return;
    }
    setCancelando(true);
    try {
      const resultado = await api.reservas.cancelarDiaEmpleado({
        fecha: cancelarDia.fecha,
        motivo: motivoImprevisto.trim(),
      });
      const total = resultado?.total_canceladas ?? 0;
      const pendientes = resultado?.reembolsos_pendientes ?? 0;
      if (total === 0) {
        mostrarToast('No había reservas ese día; la fecha quedó bloqueada', 'warning');
      } else {
        mostrarToast(
          pendientes > 0
            ? `${total} reserva(s) cancelada(s). ${pendientes} reembolso(s) pendiente(s) de gestión.`
            : `${total} reserva(s) cancelada(s) y clientes notificados.`,
          pendientes > 0 ? 'warning' : 'success'
        );
      }
      setCancelarDia(null);
      setMotivoImprevisto('');
      setResumenDia(null);
      await Promise.all([cargar(), cargarBloqueos()]);
    } catch (error) {
      mostrarToast(error.message || 'No se pudo cancelar el día', 'error');
    } finally {
      setCancelando(false);
    }
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const items = [];
      dias.forEach((dia, indice) => {
        if (!dia.sedeId) return;
        if (sedeCerrada(dia.sedeId, indice + 1)) return;
        items.push({
          dia_semana: indice + 1,
          ubicacion_id: Number(dia.sedeId),
          hora_inicio: dia.horaInicio,
          hora_fin: dia.horaFin,
          descansos: dia.descanso ? [] : normalizarDescansos(dia.descansos),
          descanso: Boolean(dia.descanso),
        });
      });
      const respuesta = await api.disponibilidad.update(items);
      if (respuesta?.reservas_canceladas?.length > 0) {
        mostrarToast(`Disponibilidad guardada. ${respuesta.reservas_canceladas.length} reserva(s) cancelada(s) por cambio de sede.`, 'warning');
      } else {
        mostrarToast('Semana fija guardada');
      }
      await cargar();
    } catch (error) {
      mostrarToast(error.message || 'No se pudo guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const festivoAbierto = (festivo) => sedes
    .map((sede) => {
      const fila = (jornadasPorSede[sede.id] || []).find(
        (jornada) => String(jornada.fecha).slice(0, 10) === festivo.fecha && !jornada.cerrado
      );
      return fila ? { sede, fila } : null;
    })
    .filter(Boolean);

  const optInDe = (festivo) => festivosEmpleado.find(
    (item) => String(item.fecha).slice(0, 10) === festivo.fecha
  );

  const abrirFestivo = (festivo) => {
    const abiertas = festivoAbierto(festivo);
    if (!abiertas.length) return;
    const diaSemana = new Date(`${festivo.fecha}T00:00:00Z`).getUTCDay() || 7;
    const diaBase = dias[diaSemana - 1];
    const primera = abiertas[0];
    const abreSede = minutos(String(primera.fila.hora_inicio || '09:00').slice(0, 5));
    const cierraSede = minutos(String(primera.fila.hora_fin || '18:00').slice(0, 5));
    const inicioBase = diaBase?.horaInicio ? minutos(diaBase.horaInicio) : abreSede;
    const finBase = diaBase?.horaFin ? minutos(diaBase.horaFin) : cierraSede;
    const inicio = Math.max(abreSede, Math.min(inicioBase, cierraSede));
    const fin = Math.min(cierraSede, Math.max(finBase, abreSede));
    const hhmm = (valor) => `${String(Math.floor(valor / 60)).padStart(2, '0')}:${String(valor % 60).padStart(2, '0')}`;
    setFestivoEditor({ festivo, abiertas });
    setFestivoForm({
      ubicacion_id: String(primera.sede.id),
      hora_inicio: hhmm(inicio),
      hora_fin: hhmm(fin > inicio ? fin : cierraSede),
      descansos: normalizarDescansos(diaBase?.descansos),
    });
  };

  const guardarFestivo = async () => {
    if (!festivoEditor || !festivoForm) return;
    setGuardando(true);
    try {
      await api.disponibilidad.crearFestivo({
        fecha: festivoEditor.festivo.fecha,
        ubicacion_id: Number(festivoForm.ubicacion_id),
        hora_inicio: festivoForm.hora_inicio,
        hora_fin: festivoForm.hora_fin,
        descansos: normalizarDescansos(festivoForm.descansos),
      });
      mostrarToast('Turno de festivo guardado');
      setFestivoEditor(null);
      setFestivoForm(null);
      await cargar();
    } catch (error) {
      mostrarToast(error.message || 'No se pudo guardar el festivo', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const cancelarFestivo = async (festivo) => {
    setGuardando(true);
    try {
      await api.disponibilidad.eliminarFestivo(festivo.fecha);
      mostrarToast('Turno de festivo cancelado');
      await cargar();
    } catch (error) {
      mostrarToast(error.message || 'No se pudo cancelar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mi disponibilidad" subtitle="Cargando tu semana fija…" />
        <div className="flex justify-center py-20"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <PageHeader
        title="Mi disponibilidad"
        subtitle="Tu semana fija: sede por día, horario y descansos. Se repite hasta que la edites."
        actions={<Button onClick={guardarCambios} disabled={guardando}>{guardando ? <Spinner /> : 'Guardar semana'}</Button>}
      />

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Select
            label="Sede"
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
            options={[{ value: '', label: 'Todas las sedes' }, ...sedes.map((sede) => ({ value: String(sede.id), label: sede.nombre }))]}
          />
          <Select
            label="Estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            options={ESTADOS}
          />
          <Select
            label="Departamento"
            value={filtroDepartamento}
            onChange={(e) => {
              setFiltroDepartamento(e.target.value);
              setFiltroCiudad('');
            }}
            options={[{ value: '', label: 'Todos' }, ...departamentos.map((item) => ({ value: item, label: item }))]}
          />
          <Select
            label="Ciudad"
            value={filtroCiudad}
            onChange={(e) => setFiltroCiudad(e.target.value)}
            options={[{ value: '', label: 'Todas' }, ...ciudades.map((item) => ({ value: item, label: item }))]}
          />
          <div className="self-end">
            <Button
              variant="secundario"
              className="w-full"
              onClick={() => {
                setFiltroSede('');
                setFiltroEstado('');
                setFiltroDepartamento('');
                setFiltroCiudad('');
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </Card>

      <Tabs
        items={[
          { value: 'semana', label: 'Semana' },
          { value: 'temporales', label: 'Cambios temporales' },
          { value: 'festivos', label: 'Festivos' },
        ]}
        value={vista}
        onChange={setVista}
        label="Secciones de disponibilidad"
      />

      {vista === 'semana' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" aria-label="Semana anterior" onClick={() => setSemanaBase((prev) => sumarDias(prev, -7))}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-texto-principal">
                    <CalendarDays className="h-4 w-4 shrink-0 text-acento" aria-hidden="true" /> {rangoSemana}
                  </p>
                  <p className="mt-0.5 text-[11px] text-texto-secundario">Semana efectiva: horario base, cambios, festivos y bloqueos.</p>
                </div>
                <Button variant="outline" size="sm" aria-label="Semana siguiente" onClick={() => setSemanaBase((prev) => sumarDias(prev, 7))}>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="secundario" size="sm" onClick={() => setSemanaBase(lunesDeSemana(fechaHoyBogota()))}>Hoy</Button>
              </div>
              <span className="text-[11px] text-texto-secundario">{diasVisibles.length} día(s) visibles</span>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-texto-principal">
                  <Coffee className="h-4 w-4 text-acento" aria-hidden="true" /> Descanso semanal
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-texto-secundario">
                  Elige el tipo de descanso y toca un día para aplicarlo. Se guarda automáticamente y se repite cada semana.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={marcarTodosDescanso} disabled={guardandoDescanso}>Todos de descanso</Button>
                <Button variant="outline" size="sm" onClick={limpiarDescansos} disabled={guardandoDescanso}>Quitar descansos</Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start">
              <Select
                label="Tipo de descanso"
                value={modoDescanso}
                onChange={(e) => setModoDescanso(e.target.value)}
                options={[
                  { value: 'todo', label: 'Todo el día' },
                  { value: 'rango', label: 'Rango de horas' },
                ]}
              />
              {modoDescanso === 'rango' && (
                <div className="min-w-0 rounded-lg border border-borde bg-panel/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-texto-secundario">Rangos de descanso</span>
                    <Button type="button" variant="outline" size="sm" onClick={agregarRangoDescanso} disabled={guardandoDescanso}>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar otro
                    </Button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {descansosRango.map((rango, indice) => (
                      <div key={indice} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                        <Input
                          label={`Desde${descansosRango.length > 1 ? ` ${indice + 1}` : ''}`}
                          aria-label={`Desde descanso ${indice + 1}`}
                          type="time"
                          value={rango.inicio}
                          onChange={(e) => cambiarRangoDescanso(indice, 'inicio', e.target.value)}
                        />
                        <Input
                          label={`Hasta${descansosRango.length > 1 ? ` ${indice + 1}` : ''}`}
                          aria-label={`Hasta descanso ${indice + 1}`}
                          type="time"
                          value={rango.fin}
                          onChange={(e) => cambiarRangoDescanso(indice, 'fin', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Quitar descanso ${indice + 1}`}
                          onClick={() => quitarRangoDescanso(indice)}
                          disabled={descansosRango.length <= 1 || guardandoDescanso}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-texto-secundario" aria-live="polite">
              {guardandoDescanso ? 'Guardando descanso…' : 'Se guarda automáticamente'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DIAS.map((dia, indice) => {
                const diaActual = dias[indice];
                const descansosDia = normalizarDescansos(diaActual?.descansos);
                const marcado = Boolean(diaActual?.descanso) || descansosDia.length > 0;
                const etiqueta = diaActual?.descanso
                  ? 'Todo el día'
                  : descansosDia.map((item) => `${item.inicio}–${item.fin}`).join(', ');
                return (
                  <button
                    key={dia.nombre}
                    type="button"
                    onClick={() => alternarDescansoDia(indice)}
                    aria-pressed={marcado}
                    aria-label={`${dia.nombre}${marcado ? `: descanso ${etiqueta}` : ': sin descanso'}`}
                    disabled={guardandoDescanso}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      marcado
                        ? 'border-acento/40 bg-acento/10 text-acento'
                        : 'border-borde bg-superficie text-texto-secundario hover:border-control'
                    }`}
                  >
                    {marcado && <Coffee className="h-3 w-3" aria-hidden="true" />}
                    {dia.corto}
                  </button>
                );
              })}
            </div>
          </Card>

          {diasVisibles.length === 0 ? (
            <Card className="py-12 text-center text-sm text-texto-secundario">
              No hay días para los filtros seleccionados.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
              {diasVisibles.map((diaInfo) => {
                const { nombre, corto, fechaTexto, estado, vista, sede, bloqueo, festivo, optIn, temporal, plantilla, indice } = diaInfo;
                return (
                  <div key={nombre} className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-tenue">{corto} · {etiquetaFecha(fechaTexto)}</p>
                        <p className="truncate text-sm font-semibold text-texto-principal">{nombre}</p>
                      </div>
                      {estado === 'bloqueado' ? <Badge variant="danger">Bloqueado</Badge>
                        : estado === 'festivo_cerrado' || estado === 'festivo' ? <Badge variant="warning">Festivo</Badge>
                          : estado === 'temporal' ? <Badge variant="info">Temporal</Badge>
                            : estado === 'cerrada' ? <Badge variant="warning">Cerrada</Badge>
                              : estado === 'descanso' ? <Badge variant="default">Descanso</Badge>
                                : estado === 'disponible' ? <Badge variant="accent">Fijo</Badge>
                                  : <Badge variant="default">Sin sede</Badge>}
                    </div>

                    <button
                      type="button"
                      onClick={() => abrirEditor(indice)}
                      className={`flex min-h-[168px] flex-1 flex-col rounded-lg border p-3 text-left transition-colors ${
                        estado === 'bloqueado' || estado === 'festivo_cerrado' || estado === 'cerrada'
                          ? 'border-advertencia/40 bg-advertencia/5 hover:bg-advertencia/10'
                          : estado === 'disponible' || estado === 'temporal' || estado === 'festivo'
                            ? 'border-acento/40 bg-superficie hover:bg-panel/40'
                            : 'border-borde bg-superficie hover:bg-panel/40'
                      }`}
                    >
                      {estado === 'bloqueado' ? (
                        <>
                          <p className="text-[11px] font-medium text-error">Día bloqueado</p>
                          <p className="mt-1 line-clamp-3 text-[10px] leading-4 text-texto-secundario">{bloqueo?.motivo || 'Imprevisto del empleado'}</p>
                        </>
                      ) : estado === 'festivo_cerrado' ? (
                        <>
                          <p className="text-[11px] font-medium text-advertencia">Festivo cerrado</p>
                          <p className="mt-1 text-[10px] leading-4 text-texto-secundario">{festivo?.nombre || 'Festivo de Colombia'}. El admin no abrió este día.</p>
                        </>
                      ) : estado === 'cerrada' ? (
                        <>
                          <p className="text-[11px] font-medium text-advertencia">Sede cerrada</p>
                          <p className="mt-1 line-clamp-3 text-[10px] leading-4 text-texto-secundario">{plantilla?.motivo || 'La sede no abre este día por plantilla.'}</p>
                        </>
                      ) : (
                        <>
                          <p className="flex min-w-0 items-center gap-1.5 text-xs text-texto-secundario">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate" title={sede?.nombre || 'Sin sede'}>{sede ? nombreSedeCorto(sede.nombre) : 'Asignar sede'}</span>
                          </p>
                          {optIn && <p className="mt-1 text-[10px] font-medium text-exito">Festivo · opt-in</p>}
                          {temporal && !optIn && <p className="mt-1 text-[10px] font-medium text-acento">Cambio temporal de sede</p>}
                          {estado === 'descanso' ? (
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-texto-secundario"><Coffee className="h-3.5 w-3.5" aria-hidden="true" /> Día de descanso</p>
                          ) : (
                            <div className="mt-2 space-y-0.5">
                              {tramos(vista).map((tramo) => <p key={tramo} className="num text-[11px] font-medium text-texto-principal">{tramo}</p>)}
                              {vista.descansos?.length > 0 && <p className="text-[10px] text-tenue">{vista.descansos.length} descanso(s)</p>}
                            </div>
                          )}
                        </>
                      )}
                      <span className="mt-auto pt-3 text-[10px] font-medium text-acento">Editar día</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-texto-principal">
                <CalendarDays className="h-4 w-4 text-acento" aria-hidden="true" /> Semana fija
              </h2>
              <p className="mt-1 text-xs leading-5 text-texto-secundario">Se repite todas las semanas. Cambia la sede, el horario o los descansos solo cuando quieras.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="accent">{dias.filter((dia) => dia.sedeId && !dia.descanso).length} días con horario</Badge>
                <Badge variant="default">{misServicios.length} servicios</Badge>
              </div>
            </Card>
            <Card>
              <h2 className="text-sm font-semibold text-texto-principal">Servicios</h2>
              <p className="mt-1 text-xs leading-5 text-texto-secundario">El precio lo define la administración; tú ajustas la duración.</p>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => { window.location.href = '/empleado/servicios'; }}>Gestionar mis servicios</Button>
            </Card>
            <Card>
              <h2 className="text-sm font-semibold text-texto-principal">Leyenda</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <p className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-sm border border-acento/40 bg-acento/10" /> Con horario</p>
                <p className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-sm border border-borde bg-panel" /> Descanso</p>
                <p className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-sm border border-advertencia/40 bg-advertencia/10" /> Cerrado / festivo</p>
                <p className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-sm border border-error/30 bg-[var(--pill-negative-bg)]" /> Bloqueado</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {vista === 'temporales' && (
        <CambiosTemporales
          empleadoId={usuario?.id}
          sedes={sedes}
          onToast={mostrarToast}
          onChanged={cargar}
        />
      )}

      {vista === 'festivos' && (
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-texto-principal">Festivos próximos</h2>
            <p className="mt-1 text-xs leading-5 text-texto-secundario">
              El admin decide qué sedes abren. Si quieres trabajar, elige una sede y ajusta tu turno para ese día.
            </p>
          </Card>
          {festivos.length === 0 ? (
            <Card className="py-10 text-center text-sm text-texto-secundario">No hay festivos en los próximos 60 días.</Card>
          ) : festivos.map((festivo) => {
            const abiertas = festivoAbierto(festivo);
            const optIn = optInDe(festivo);
            return (
              <Card key={festivo.fecha}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-texto-principal">{festivo.nombre}</p>
                    <p className="mt-0.5 text-xs text-texto-secundario">{etiquetaFecha(festivo.fecha)}</p>
                    {abiertas.length > 0 ? (
                      <p className="mt-2 text-[11px] text-texto-secundario">
                        Abierto en: {abiertas.map((item) => item.sede.nombre).join(', ')}
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-tenue">Cerrado en todas las sedes.</p>
                    )}
                  </div>
                  {optIn ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success">Trabajarás en {optIn.ubicacion_nombre}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => cancelarFestivo(festivo)} disabled={guardando}>
                        Cancelar
                      </Button>
                    </div>
                  ) : abiertas.length > 0 ? (
                    <Button size="sm" onClick={() => abrirFestivo(festivo)}>Quiero trabajar</Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={editor !== null}
        onClose={() => { setEditor(null); setForm(null); }}
        title={editor !== null ? `${DIAS[editor].nombre} · ${form?.sedeId ? sedeDe(form.sedeId)?.nombre : 'Sin sede'}` : 'Editar día'}
        size="wide"
      >
        {form && (
          <div className="space-y-4">
            <Select
              label="Sede del día"
              value={form.sedeId}
              onChange={(e) => setForm((prev) => ({ ...prev, sedeId: e.target.value }))}
              options={[
                { value: '', label: 'Sin sede' },
                ...sedesDelDia(editor).map((sede) => ({ value: String(sede.id), label: sede.nombre })),
              ]}
            />
            {sedeCerrada(form.sedeId, editor + 1) && (
              <p className="flex items-start gap-2 rounded-md border border-advertencia/30 bg-advertencia/10 p-2.5 text-[11px] text-advertencia">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Esta sede no abre ese día. Elige otra sede o marca descanso.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={form.descanso ? 'primario' : 'outline'}
                onClick={() => setForm((prev) => ({ ...prev, descanso: !prev.descanso }))}
              >
                <Coffee className="h-3.5 w-3.5" aria-hidden="true" /> {form.descanso ? 'Día de descanso' : 'Marcar descanso'}
              </Button>
            </div>

            {!form.descanso && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Hora inicio" type="time" value={form.horaInicio} onChange={(e) => setForm((prev) => ({ ...prev, horaInicio: e.target.value }))} />
                  <Input label="Hora fin" type="time" value={form.horaFin} onChange={(e) => setForm((prev) => ({ ...prev, horaFin: e.target.value }))} />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-texto-principal">Descansos</p>
                    <Button variant="outline" size="sm" onClick={agregarDescanso}>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar
                    </Button>
                  </div>
                  {form.descansos.length === 0 ? (
                    <p className="mt-2 text-[11px] text-tenue">Sin descansos. El día será continuo.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {form.descansos.map((descanso, posicion) => (
                        <div key={`${posicion}-${descanso.inicio}`} className="flex items-end gap-2">
                          <Input
                            label="Desde"
                            type="time"
                            value={descanso.inicio}
                            onChange={(e) => cambiarDescanso(posicion, 'inicio', e.target.value)}
                            wrapperClassName="flex-1"
                          />
                          <Input
                            label="Hasta"
                            type="time"
                            value={descanso.fin}
                            onChange={(e) => cambiarDescanso(posicion, 'fin', e.target.value)}
                            wrapperClassName="flex-1"
                          />
                          <Button variant="ghost" size="sm" onClick={() => quitarDescanso(posicion)} aria-label="Quitar descanso">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-borde bg-superficie pt-3">
              <Button
                variant="dangerSuave"
                onClick={() => {
                  const indice = editor;
                  setEditor(null);
                  setForm(null);
                  abrirCancelarDia(indice);
                }}
              >
                <CalendarX2 className="h-3.5 w-3.5" aria-hidden="true" /> Imprevisto
              </Button>
              <Button variant="secundario" onClick={() => { setEditor(null); setForm(null); }}>Cancelar</Button>
              <Button onClick={guardarDiaEditor}>Aplicar día</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(festivoEditor)}
        onClose={() => { setFestivoEditor(null); setFestivoForm(null); }}
        title={festivoEditor ? `Trabajar en ${festivoEditor.festivo.nombre}` : 'Festivo'}
        size="wide"
      >
        {festivoForm && festivoEditor && (
          <div className="space-y-4">
            <Select
              label="Sede abierta"
              value={festivoForm.ubicacion_id}
              onChange={(e) => setFestivoForm((prev) => ({ ...prev, ubicacion_id: e.target.value }))}
              options={festivoEditor.abiertas.map(({ sede }) => ({ value: String(sede.id), label: sede.nombre }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Hora inicio" type="time" value={festivoForm.hora_inicio} onChange={(e) => setFestivoForm((prev) => ({ ...prev, hora_inicio: e.target.value }))} />
              <Input label="Hora fin" type="time" value={festivoForm.hora_fin} onChange={(e) => setFestivoForm((prev) => ({ ...prev, hora_fin: e.target.value }))} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-texto-principal">Descansos</p>
                <Button variant="outline" size="sm" onClick={() => setFestivoForm((prev) => ({ ...prev, descansos: [...prev.descansos, { inicio: '12:00', fin: '14:00' }] }))}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar
                </Button>
              </div>
              {festivoForm.descansos.map((descanso, posicion) => (
                <div key={`${posicion}-${descanso.inicio}`} className="mt-2 flex items-end gap-2">
                  <Input label="Desde" type="time" value={descanso.inicio} onChange={(e) => setFestivoForm((prev) => ({ ...prev, descansos: prev.descansos.map((item, idx) => idx === posicion ? { ...item, inicio: e.target.value } : item) }))} wrapperClassName="flex-1" />
                  <Input label="Hasta" type="time" value={descanso.fin} onChange={(e) => setFestivoForm((prev) => ({ ...prev, descansos: prev.descansos.map((item, idx) => idx === posicion ? { ...item, fin: e.target.value } : item) }))} wrapperClassName="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => setFestivoForm((prev) => ({ ...prev, descansos: prev.descansos.filter((_, idx) => idx !== posicion) }))} aria-label="Quitar descanso">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-borde pt-3">
              <Button variant="secundario" onClick={() => { setFestivoEditor(null); setFestivoForm(null); }}>Cancelar</Button>
              <Button onClick={guardarFestivo} disabled={guardando}>{guardando ? <Spinner /> : 'Guardar turno'}</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(cancelarDia)}
        onClose={() => { setCancelarDia(null); setMotivoImprevisto(''); setResumenDia(null); }}
        title={cancelarDia ? `Cancelar día · ${cancelarDia.fecha}` : 'Cancelar día por imprevisto'}
        size="wide"
      >
        {cancelarDia && (
          <div className="space-y-4">
            <Input
              label="Fecha a cancelar"
              type="date"
              value={cancelarDia.fecha}
              onChange={(e) => cambiarFechaCancelar(e.target.value)}
            />
            <div className="rounded-md border border-borde bg-panel/40 p-3">
              <p className="text-xs font-medium text-texto-principal">
                {cancelarDia.cargando
                  ? 'Consultando reservas…'
                  : `Reservas activas: ${resumenDia?.length || 0}`}
              </p>
              {!cancelarDia.cargando && (resumenDia?.length || 0) === 0 && (
                <p className="mt-1 text-[11px] leading-5 text-texto-secundario">
                  No hay reservas para esa fecha. El día quedará bloqueado para nuevas citas.
                </p>
              )}
              {!cancelarDia.cargando && (resumenDia?.length || 0) > 0 && (
                <div className="mt-2 divide-y divide-regla">
                  {resumenDia.map((reserva) => (
                    <div key={reserva.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-[11px]">
                      <span className="text-texto-principal">
                        {horaTexto(reserva.inicia_en)} · {reserva.cliente_nombre} {reserva.cliente_apellido || ''}
                      </span>
                      <span className="text-texto-secundario">
                        {reserva.pago_estado === 'aprobado'
                          ? `Pago online ${reserva.pago_metodo || ''}`
                          : reserva.cobro_metodo === 'fisico'
                            ? 'Pago local'
                            : 'Sin pago'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Textarea
              label="Motivo del imprevisto"
              rows={3}
              value={motivoImprevisto}
              onChange={(e) => setMotivoImprevisto(e.target.value)}
              placeholder="Ej. incapacidad médica, emergencia familiar..."
            />
            <p className="flex items-start gap-2 rounded-md border border-advertencia/30 bg-advertencia/10 p-2.5 text-[11px] leading-5 text-advertencia">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Se cancelará la cita completa de cada cliente. Los pagos con tarjeta se intentarán reembolsar automáticamente; los pagos por PSE, Nequi u otros medios quedarán pendientes de gestión.
            </p>
            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-borde bg-superficie pt-3">
              <Button variant="secundario" onClick={() => { setCancelarDia(null); setMotivoImprevisto(''); setResumenDia(null); }} disabled={cancelando}>
                Volver
              </Button>
              <Button variant="danger" onClick={confirmarCancelarDia} disabled={cancelando || cancelarDia.cargando || motivoImprevisto.trim().length < 4}>
                {cancelando ? <Spinner /> : (resumenDia?.length ? 'Cancelar reservas y bloquear' : 'Bloquear día')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(conflictoDescanso)}
        onClose={() => setConflictoDescanso(null)}
        title="Descanso con citas futuras"
        size="wide"
      >
        {conflictoDescanso && (
          <div className="space-y-4">
            <p className="text-xs leading-5 text-texto-secundario">
              El descanso se cruza con estas citas. Para guardarlo, se cancelará la cita completa de cada cliente y se intentará reembolsar el pago online cuando aplique.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border border-borde bg-panel/40 p-3 scroll-thin">
              <div className="divide-y divide-regla">
                {conflictoDescanso.conflictos.map((conflicto) => (
                  <div key={conflicto.reserva_id} className="py-2 text-[11px]">
                    <p className="font-medium text-texto-principal">
                      {conflicto.fecha} · {conflicto.hora_inicio}–{conflicto.hora_fin} · {conflicto.cliente}
                    </p>
                    <p className="mt-0.5 text-texto-secundario">{conflicto.servicios.join(' · ')}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-borde bg-superficie pt-3">
              <Button variant="secundario" onClick={() => setConflictoDescanso(null)} disabled={guardandoDescanso}>
                Volver
              </Button>
              <Button variant="danger" onClick={confirmarConflictoDescanso} disabled={guardandoDescanso}>
                {guardandoDescanso ? <Spinner /> : 'Cancelar citas y guardar descanso'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
