import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, MapPin } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Toast,
} from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import useWebSocket from '../../hooks/use-websocket.js';
import { descargarQrReserva } from '../../lib/descargas.js';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const customMarkerIcon = new L.DivIcon({
  html: `<div style="display:flex;justify-content:center;align-items:center;width:30px;height:30px;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6C80" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#E6F1F3"/>
      <circle cx="12" cy="10" r="3" fill="#1B6C80"/>
    </svg>
  </div>`,
  className: 'custom-leaflet-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 15);
    }
  }, [lat, lng, map]);
  return null;
}

function AjustarMapa({ puntos }) {
  const map = useMap();
  const clave = puntos.map((p) => p.join(',')).join(';');
  useEffect(() => {
    const validos = puntos.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (validos.length > 1) {
      map.fitBounds(L.latLngBounds(validos), { padding: [28, 28], maxZoom: 14 });
    } else if (validos.length === 1) {
      map.setView(validos[0], 14);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map]);
  return null;
}

const PASOS = [
  { num: 1, label: 'Sede' },
  { num: 2, label: 'Estilista' },
  { num: 3, label: 'Horario' },
  { num: 4, label: 'Confirmar' },
  { num: 5, label: 'Pago' },
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function formatearFechaLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function obtenerIniciales(nombre) {
  if (!nombre) return '??';
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

function fechaBonita(valor) {
  if (!valor) return '';
  const [anio, mes, dia] = valor.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(anio, mes - 1, dia));
}

export default function NuevaReserva() {
  const navigate = useNavigate();
  const { ultimoEvento } = useWebSocket();
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [isMobile, setIsMobile] = useState(false);
  const [diaInicioMovil, setDiaInicioMovil] = useState(0);
  const [fechaBase, setFechaBase] = useState(null);
  const fechaBaseRef = useRef(fechaBase);
  const empleadoSeleccionadoRef = useRef(null);
  const ubicacionSeleccionadaRef = useRef(null);
  const pasoRef = useRef(paso);

  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('Todas');

  const obtenerCiudad = (direccion) => {
    if (!direccion) return 'Otras';
    const partes = direccion.split(',');
    if (partes.length > 1) {
      return partes[partes.length - 1].trim();
    }
    return 'Otras';
  };

  const ciudades = ['Todas', ...new Set(ubicaciones.map((u) => obtenerCiudad(u.direccion)))];

  const ubicacionesFiltradas = ubicaciones.filter((u) => {
    const coincideNombre = u.nombre.toLowerCase().includes(filtroNombre.toLowerCase()) ||
                          (u.direccion && u.direccion.toLowerCase().includes(filtroNombre.toLowerCase()));
    const ciudad = obtenerCiudad(u.direccion);
    const coincideCiudad = filtroCiudad === 'Todas' || ciudad.toLowerCase() === filtroCiudad.toLowerCase();
    return coincideNombre && coincideCiudad;
  });


  const [empleados, setEmpleados] = useState([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);

  const [semana, setSemana] = useState([]);
  const [slots, setSlots] = useState({});
  const [servicios, setServicios] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [preferencias, setPreferencias] = useState(null);
  const [granularidad, setGranularidad] = useState(30);

  const [reservaCreada, setReservaCreada] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [pagoEstado, setPagoEstado] = useState('inicial');
  const [pagoMensaje, setPagoMensaje] = useState('');
  const [intencionPago, setIntencionPago] = useState(null);
  const [pagoCompletado, setPagoCompletado] = useState(false);
  const [transaccionManual, setTransaccionManual] = useState('');
  const intentosPagoRef = useRef(0);

  useEffect(() => { fechaBaseRef.current = fechaBase; }, [fechaBase]);
  useEffect(() => { empleadoSeleccionadoRef.current = empleadoSeleccionado; }, [empleadoSeleccionado]);
  useEffect(() => { ubicacionSeleccionadaRef.current = ubicacionSeleccionada; }, [ubicacionSeleccionada]);
  useEffect(() => { pasoRef.current = paso; }, [paso]);

  useEffect(() => {
    if (!ultimoEvento) return;
    if (ultimoEvento.tipo === 'disponibilidad.actualizada' && pasoRef.current === 3) {
      const emp = empleadoSeleccionadoRef.current;
      const base = fechaBaseRef.current;
      if (emp) {
        cargarCalendario(base || new Date(), emp).catch(() => {});
      }
    }
    if (ultimoEvento.tipo === 'reserva.actualizada' && pasoRef.current === 3) {
      const base = fechaBaseRef.current;
      cargarCalendario(base || new Date(), empleadoSeleccionadoRef.current).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoEvento]);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { cargarUbicaciones(); }, []);

  const cargarUbicaciones = async () => {
    setCargando(true);
    try { setUbicaciones(await api.ubicaciones.list() || []); } catch (err) { mostrarToast(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const irAPaso2 = async () => {
    if (!ubicacionSeleccionada) return;
    setPaso(2);
    setCargando(true);
    try {
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      const fechas = [];
      for (let i = 0; i < 6; i++) {
        const f = new Date(base);
        f.setDate(base.getDate() + i);
        fechas.push(formatearFechaLocal(f));
      }
      const listas = await Promise.all(
        fechas.map((fecha) =>
          api.reservas
            .empleadosDisponibles({ ubicacion_id: ubicacionSeleccionada.id, fecha })
            .catch(() => [])
        )
      );
      const porId = new Map();
      listas.flat().forEach((emp) => {
        if (emp?.id != null) porId.set(emp.id, emp);
      });
      const ordenados = [...porId.values()].sort((a, b) =>
        `${a.nombre} ${a.apellido || ''}`.localeCompare(`${b.nombre} ${b.apellido || ''}`)
      );
      setEmpleados(ordenados);
    } catch (err) { mostrarToast(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const cargarCalendario = async (baseDate, empleadoParam) => {
    const emp = empleadoParam || empleadoSeleccionado;
    if (!emp) return;
    setCargando(true);
    try {
      const [empServs, prefs] = await Promise.all([
        api.reservas.empleadoTiempos.get(emp.id),
        api.preferencias.get()
      ]);
      const mappedServs = (empServs || []).map(s => ({
        id: s.servicio_id,
        nombre: s.servicio_nombre,
        duracion_base_minutos: s.duracion_minutos || 30,
        precio_base: s.precio_base
      }));
      setServicios(mappedServs);
      setPreferencias(prefs);
      const g = prefs?.granularidad_calendario || 30;
      setGranularidad(g);

      // Generar los 6 días a partir de baseDate
      const dias = [];
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const base = new Date(baseDate);
      base.setHours(0, 0, 0, 0);

      for (let i = 0; i < 6; i++) {
        const fecha = new Date(base);
        fecha.setDate(base.getDate() + i);
        dias.push({
          fecha: formatearFechaLocal(fecha),
          diaSemana: DIAS_SEMANA[fecha.getDay() === 0 ? 6 : fecha.getDay() - 1] || 'Lun',
          esHoy: fecha.getTime() === hoy.getTime(),
          esPasado: fecha < hoy,
          objetoFecha: fecha
        });
      }
      setSemana(dias);
      setFechaBase(base);
      setDiaInicioMovil(0);

      // Cargar disponibilidad en paralelo para los 6 días
      const promesas = dias.map(d =>
        api.reservas.disponibilidad({ empleado_id: emp.id, ubicacion_id: ubicacionSeleccionada.id, fecha: d.fecha })
          .then(res => ({ fecha: d.fecha, data: res || { slots_ocupados: [] } }))
          .catch(() => ({ fecha: d.fecha, data: { slots_ocupados: [] } }))
      );
      const resultados = await Promise.all(promesas);
      const mapaSlots = {};
      resultados.forEach(r => {
        mapaSlots[r.fecha] = r.data;
      });
      setSlots(mapaSlots);
    } catch (err) { mostrarToast(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const irAPaso3 = async (empleadoParam) => {
    const emp = empleadoParam || empleadoSeleccionado;
    if (!emp) return;
    setPaso(3);
    await cargarCalendario(new Date(), emp);
  };

  const handleSlotClick = (dia, hora) => {
    const ahora = new Date();
    const [h, m] = hora.split(':');
    const slotDate = new Date(dia.fecha + 'T00:00:00');
    slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
    const diffMin = (slotDate - ahora) / 60000;
    if (diffMin < 0 || diffMin < 60) return;
    setSlotSeleccionado(hora);
    setDiaSeleccionado(dia);
    setServicioSeleccionado(servicios.length > 0 ? String(servicios[0].id) : '');
    setCantidad(1);
    setPaso(4);
  };

  const handleCrearReserva = async () => {
    if (!servicioSeleccionado || !slotSeleccionado || !diaSeleccionado || !empleadoSeleccionado || !ubicacionSeleccionada) return;
    setCargando(true);
    try {
      const serv = servicios.find((s) => String(s.id) === String(servicioSeleccionado));
      if (!serv) { mostrarToast('Selecciona un servicio', 'error'); setCargando(false); return; }
      const localInicio = new Date(`${diaSeleccionado.fecha}T${slotSeleccionado}:00`);

      const data = await api.reservas.create({
        empleado_id: empleadoSeleccionado.id,
        servicio_id: parseInt(servicioSeleccionado),
        ubicacion_id: ubicacionSeleccionada.id,
        inicia_en: localInicio.toISOString(),
        cantidad_personas: cantidad,
      });
      setReservaCreada(data);
      setPagoEstado('inicial');
      setPagoMensaje('');
      setIntencionPago(null);
      setTransaccionManual('');
      setMetodoPago('efectivo');
      setPaso(5);
      mostrarToast('Reserva creada con exito', 'success');
    } catch (err) {
      if (/superpone|fuera de la disponibilidad/i.test(err.message)) {
        mostrarToast(`${err.message}. Te sugerimos elegir otro horario.`, 'error');
        setSlotSeleccionado(null);
        setPaso(3);
        cargarCalendario(fechaBase || new Date());
      } else {
        mostrarToast(err.message, 'error');
      }
    }
    finally { setCargando(false); }
  };

  const cargarScriptWompi = () =>
    new Promise((resolve, reject) => {
      if (window.WidgetCheckout) {
        resolve();
        return;
      }
      const existente = document.querySelector('script[data-wompi-widget]');
      if (existente) {
        existente.addEventListener('load', () => resolve());
        existente.addEventListener('error', () => reject(new Error('No se pudo cargar el checkout de Wompi')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;
      script.dataset.wompiWidget = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el checkout de Wompi'));
      document.head.appendChild(script);
    });

  const aplicarEstadoPago = (pago) => {
    if (!pago) return;
    if (pago.estado === 'aprobado') {
      setPagoEstado('aprobado');
      setPagoMensaje('Pago aprobado. Tu reserva quedo confirmada.');
      setPagoCompletado(true);
      mostrarToast('Pago aprobado correctamente');
    } else if (pago.estado === 'declinado' || pago.estado === 'error') {
      setPagoEstado(pago.estado);
      setPagoMensaje(
        pago.estado === 'declinado'
          ? 'El pago fue rechazado. Puedes intentar con otro medio o pagar en el local.'
          : 'Ocurrio un error procesando el pago. Intenta de nuevo.'
      );
    } else {
      setPagoEstado('pendiente');
      setPagoMensaje('El pago aun no aparece aprobado. Si ya pagaste, verifica el estado.');
    }
  };

  const consultarEstadoPago = async () => {
    if (!intencionPago) return;
    try {
      const pago = await api.pagos.estado(intencionPago.pago_id);
      aplicarEstadoPago(pago);
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  };

  const verificarPago = async (transactionId) => {
    if (!intencionPago) return;
    try {
      const pago = await api.pagos.verificar(intencionPago.pago_id, transactionId);
      aplicarEstadoPago(pago);
    } catch (err) {
      setPagoEstado('error');
      setPagoMensaje(err.message);
      mostrarToast(err.message, 'error');
    }
  };

  const pagarConWompi = async () => {
    if (!reservaCreada) return;
    setPagoEstado('procesando');
    setPagoMensaje('');
    try {
      const intencion = await api.pagos.intencion(reservaCreada.id);
      setIntencionPago(intencion);
      setTransaccionManual('');
      await cargarScriptWompi();
      const checkout = new window.WidgetCheckout({
        currency: intencion.moneda,
        amountInCents: intencion.monto_en_centavos,
        reference: intencion.referencia,
        publicKey: intencion.llave_publica,
        signature: { integrity: intencion.firma_integridad },
        customerData: {
          email: intencion.customer_data?.email,
          fullName: intencion.customer_data?.full_name,
        },
      });
      checkout.open(async (resultado) => {
        const transaccion = resultado?.transaction;
        if (transaccion?.id) {
          await verificarPago(transaccion.id);
        } else {
          await consultarEstadoPago();
        }
      });
      setPagoEstado('esperando');
      setPagoMensaje('Completa el pago en la ventana segura de Wompi.');
    } catch (err) {
      setPagoEstado('error');
      setPagoMensaje(err.message);
      mostrarToast(err.message, 'error');
    }
  };

  const confirmarPagoEfectivo = () => {
    setPagoCompletado(true);
    mostrarToast('Reserva activada. Paga en el local al llegar.');
  };

  useEffect(() => {
    if (!intencionPago || pagoEstado !== 'esperando') return undefined;
    intentosPagoRef.current = 0;
    const intervalo = setInterval(async () => {
      intentosPagoRef.current += 1;
      if (intentosPagoRef.current > 6) {
        clearInterval(intervalo);
        setPagoEstado('pendiente');
        setPagoMensaje('No detectamos el pago aun. Usa "Verificar estado" si ya pagaste.');
        return;
      }
      try {
        const pago = await api.pagos.estado(intencionPago.pago_id);
        if (pago.estado !== 'pendiente') aplicarEstadoPago(pago);
      } catch {
        /* reintenta en el siguiente ciclo */
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [intencionPago, pagoEstado]);

  const getPasoVariant = (num) => { if (num < paso) return 'success'; if (num === paso) return 'info'; return 'default'; };

  const volverAtras = () => {
    if (paso === 2) { setPaso(1); setEmpleadoSeleccionado(null); }
    else if (paso === 3) { setPaso(2); setSlots({}); }
    else if (paso === 4) setPaso(3);
    else if (paso === 5) setPaso(4);
  };

  const generarSlotsDelDia = () => {
    const horaDesde = preferencias?.rango_hora_desde || '09:00:00';
    const horaHasta = preferencias?.rango_hora_hasta || '17:00:00';
    const g = granularidad || 30;
    const slotsArr = [];
    const [hI, mI] = horaDesde.split(':').map(Number);
    const [hF, mF] = horaHasta.split(':').map(Number);
    let actual = hI * 60 + mI;
    const fin = hF * 60 + mF;
    while (actual < fin) {
      const hh = Math.floor(actual / 60);
      const mm = actual % 60;
      slotsArr.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      actual += g;
    }
    return slotsArr;
  };

  const esSlotOcupado = (fecha, hora) => {
    const slotsDia = slots?.[fecha]?.slots_ocupados;
    if (!slotsDia) return false;
    const slotDate = new Date(fecha + 'T' + hora + ':00');
    const slotMin = slotDate.getHours() * 60 + slotDate.getMinutes();
    return slotsDia.some((s) => {
      const ini = new Date(s.inicia_en);
      const fin = new Date(s.termina_en);
      const iniMin = ini.getHours() * 60 + ini.getMinutes();
      const finMin = fin.getHours() * 60 + fin.getMinutes();
      return slotMin >= iniMin && slotMin < finMin;
    });
  };

  const esSlotAntelacion = (fecha, hora) => {
    const ahora = new Date();
    const [h, m] = hora.split(':');
    const slotDate = new Date(fecha + 'T00:00:00');
    slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
    const diffMin = (slotDate - ahora) / 60000;
    return diffMin > 0 && diffMin < 60;
  };

  const esSlotPasado = (fecha, hora) => {
    const ahora = new Date();
    const [h, m] = hora.split(':');
    const slotDate = new Date(fecha + 'T00:00:00');
    slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
    return slotDate <= ahora;
  };

  const esSlotFueraDeDisponibilidad = (fecha, hora) => {
    const disp = slots?.[fecha]?.disponibilidad_empleado;
    if (!disp) return true;
    const [h, m] = hora.split(':').map(Number);
    const slotMin = h * 60 + m;
    const [hIni, mIni] = disp.hora_inicio.split(':').map(Number);
    const iniMin = hIni * 60 + mIni;
    const [hFin, mFin] = disp.hora_fin.split(':').map(Number);
    const finMin = hFin * 60 + mFin;
    return slotMin < iniMin || slotMin >= finMin;
  };

  const descargarQR = () => {
    descargarQrReserva(reservaCreada);
  };

  const selectedServ = servicios.find((s) => String(s.id) === String(servicioSeleccionado));
  const totalPrecio = selectedServ ? parseFloat(selectedServ.precio_base || selectedServ.precio || 0) * cantidad : 0;
  const duracionSeleccionada = selectedServ?.duracion_base_minutos || selectedServ?.duracion || 30;
  const calcularHoraFin = () => {
    if (!slotSeleccionado) return '';
    const [hh, mm] = slotSeleccionado.split(':').map(Number);
    const totalMin = hh * 60 + mm + duracionSeleccionada;
    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  };

  if (pagoCompletado) {
    return (
      <div className="mx-auto max-w-2xl py-8 text-center sm:py-14">
        <Toast open={toast.open} message={toast.message} type={toast.type} />
        <Card className="p-7 sm:p-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-exito/10 text-exito">
            <Check className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-texto-principal">
            {pagoEstado === 'aprobado' ? 'Cita confirmada' : 'Reserva registrada'}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-texto-secundario">
            {pagoEstado === 'aprobado'
              ? 'El pago fue aprobado. Muestra el código QR al llegar al salón.'
              : 'Tu cita quedó activa. Muestra el código QR al llegar y paga en el local.'}
          </p>
          {reservaCreada?.qr_data_url && (
            <div className="mx-auto mt-6 inline-block max-w-full rounded-lg border border-borde bg-white p-4">
              <img src={reservaCreada.qr_data_url} alt="Código QR de la cita" className="mx-auto h-40 w-40" />
              {reservaCreada.qr_token && (
                <span className="mono mt-2 block break-all text-[10px] text-tenue">{reservaCreada.qr_token}</span>
              )}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="secundario" onClick={descargarQR}>Descargar QR</Button>
            <Button onClick={() => navigate('/cliente')}>Ir a mis citas</Button>
          </div>
        </Card>
      </div>
    );
  }

  const diasSem = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 pb-20 md:pb-0">
      <Toast open={toast.open} message={toast.message} type={toast.type} />
      <PageHeader
        title="Reservar cita"
        subtitle="Elige sede, estilista y horario. El total se confirma al finalizar."
        actions={
          <Button variant="ghost" onClick={() => navigate('/cliente')}>
            Cancelar
          </Button>
        }
      />

      <div className="rounded-lg border border-borde bg-superficie px-3 py-2.5">
        <div className="flex items-center gap-3 sm:hidden">
          <span className="mono shrink-0 text-[11px] font-medium text-texto-principal">
            {paso}/{PASOS.length}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel">
            <div className="h-full rounded-full bg-acento" style={{ width: `${(paso / PASOS.length) * 100}%` }} />
          </div>
          <span className="shrink-0 text-[11px] font-medium text-texto-principal">{PASOS[paso - 1]?.label}</span>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          {PASOS.map((p, i) => {
            const activo = p.num === paso;
            const completado = p.num < paso;
            return (
              <div key={p.num} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                    activo
                      ? 'bg-primario text-primario-texto'
                      : completado
                        ? 'bg-acento-suave text-acento-tinta'
                        : 'bg-panel text-tenue'
                  }`}
                >
                  {completado ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : p.num}
                </span>
                <span className={`text-[11px] ${activo || completado ? 'font-medium text-texto-principal' : 'text-tenue'}`}>
                  {p.label}
                </span>
                {i < PASOS.length - 1 && <span className={`h-px flex-1 ${completado ? 'bg-acento/40' : 'bg-borde'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1 */}
      {paso === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-texto-principal">Elige la sede</h2>
            <p className="mt-0.5 text-xs text-texto-secundario">Busca por nombre o ciudad, o selecciona un punto en el mapa.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Buscar sede"
                  placeholder="Nombre o dirección..."
                  value={filtroNombre}
                  onChange={(e) => setFiltroNombre(e.target.value)}
                />
                <Select
                  label="Ciudad"
                  value={filtroCiudad}
                  onChange={(e) => setFiltroCiudad(e.target.value)}
                  options={ciudades.map((c) => ({ value: c, label: c }))}
                />
              </div>

              {cargando && ubicaciones.length === 0 ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : ubicacionesFiltradas.length === 0 ? (
                <EmptyState title="No encontramos sedes" description="Prueba con otro nombre o quita el filtro de ciudad." />
              ) : (
                <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1 scroll-thin">
                  {ubicacionesFiltradas.map((ubic) => {
                    const isSel = ubicacionSeleccionada?.id === ubic.id;
                    return (
                      <button
                        key={ubic.id}
                        type="button"
                        onClick={() => setUbicacionSeleccionada(ubic)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                          isSel ? 'border-acento bg-acento-suave/40 ring-1 ring-acento/20' : 'border-borde bg-superficie hover:bg-panel/60'
                        }`}
                      >
                        <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${isSel ? 'text-acento' : 'text-texto-secundario'}`} strokeWidth={1.7} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-texto-principal">{ubic.nombre}</span>
                          {ubic.direccion && <span className="mt-0.5 block text-xs leading-5 text-texto-secundario">{ubic.direccion}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-borde bg-superficie p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-texto-secundario">Mapa de sedes</p>
                {ubicacionSeleccionada && <Badge variant="accent">{ubicacionSeleccionada.nombre}</Badge>}
              </div>
              <div className="relative z-0 h-64 overflow-hidden rounded-md border border-borde bg-panel">
                <MapContainer
                  center={ubicacionSeleccionada ? [parseFloat(ubicacionSeleccionada.latitud), parseFloat(ubicacionSeleccionada.longitud)] : [4.60971, -74.08175]}
                  zoom={13}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {ubicacionesFiltradas.map((u) => (
                    <Marker
                      key={u.id}
                      position={[parseFloat(u.latitud), parseFloat(u.longitud)]}
                      icon={customMarkerIcon}
                      eventHandlers={{ click: () => setUbicacionSeleccionada(u) }}
                    />
                  ))}
                  <AjustarMapa
                    puntos={ubicacionesFiltradas.map((u) => [parseFloat(u.latitud), parseFloat(u.longitud)])}
                  />
                  {ubicacionSeleccionada && (
                    <MapRecenter lat={parseFloat(ubicacionSeleccionada.latitud)} lng={parseFloat(ubicacionSeleccionada.longitud)} />
                  )}
                </MapContainer>
              </div>
              <Button onClick={irAPaso2} disabled={!ubicacionSeleccionada} className="hidden w-full md:inline-flex">
                {cargando ? <Spinner /> : 'Continuar con estilista'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {paso === 2 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button type="button" onClick={volverAtras} className="inline-flex items-center gap-1 text-xs font-medium text-acento hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Volver
              </button>
              <h2 className="mt-1 text-base font-semibold text-texto-principal">Elige estilista</h2>
              <p className="mt-0.5 text-xs text-texto-secundario">Sede: {ubicacionSeleccionada?.nombre}</p>
            </div>
          </div>

          {cargando ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : empleados.length === 0 ? (
            <EmptyState title="No hay estilistas disponibles" description="Prueba con otra sede o revisa los próximos días." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {empleados.map((emp) => {
                const isSel = empleadoSeleccionado?.id === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setEmpleadoSeleccionado(emp);
                      setTimeout(() => irAPaso3(emp), 180);
                    }}
                    className={`flex items-center gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                      isSel ? 'border-acento bg-acento-suave/40 ring-1 ring-acento/20' : 'border-borde bg-superficie hover:bg-panel/60'
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-activo text-sm font-semibold text-texto-secundario">
                      {obtenerIniciales(`${emp.nombre || ''} ${emp.apellido || ''}`)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-texto-principal">
                        {emp.nombre} {emp.apellido}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-texto-secundario">
                        {emp.especialidad || 'Elegir estilista'}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-tenue" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-start border-t border-borde pt-4">
            <Button variant="secundario" onClick={volverAtras}>Atrás</Button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {paso === 3 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <button type="button" onClick={volverAtras} className="inline-flex items-center gap-1 text-xs font-medium text-acento hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Volver
              </button>
              <h2 className="mt-1 text-base font-semibold text-texto-principal">Elige día y hora</h2>
              <p className="mt-0.5 text-xs text-texto-secundario">
                Estilista: {empleadoSeleccionado?.nombre} {empleadoSeleccionado?.apellido} · mínimo 60 min de anticipación.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {fechaBase && (
                <div className="flex items-center gap-1 rounded-md border border-borde bg-superficie p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nueva = new Date(fechaBase);
                      nueva.setDate(nueva.getDate() - 6);
                      const hoy = new Date();
                      hoy.setHours(0, 0, 0, 0);
                      cargarCalendario(nueva < hoy ? hoy : nueva);
                    }}
                    disabled={fechaBase.getTime() <= new Date().setHours(0, 0, 0, 0)}
                    aria-label="Ver 6 días anteriores"
                  >
                    ←
                  </Button>
                  <input
                    type="date"
                    value={fechaBase ? `${fechaBase.getFullYear()}-${String(fechaBase.getMonth() + 1).padStart(2, '0')}-${String(fechaBase.getDate()).padStart(2, '0')}` : ''}
                    min={(() => {
                      const hoy = new Date();
                      return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
                    })()}
                    onChange={(e) => {
                      if (e.target.value) {
                        const partes = e.target.value.split('-').map(Number);
                        cargarCalendario(new Date(partes[0], partes[1] - 1, partes[2]));
                      }
                    }}
                    className="h-8 rounded border-0 bg-transparent px-1 text-xs text-texto-principal focus:outline-none"
                    aria-label="Fecha de inicio"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nueva = new Date(fechaBase);
                      nueva.setDate(nueva.getDate() + 6);
                      cargarCalendario(nueva);
                    }}
                    aria-label="Ver siguientes 6 días"
                  >
                    →
                  </Button>
                </div>
              )}
              <select
                value={granularidad}
                onChange={(e) => setGranularidad(Number(e.target.value))}
                className="h-9 rounded-md border border-control bg-superficie px-2 text-xs text-texto-principal focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
                aria-label="Intervalo de horarios"
              >
                <option value="15">Intervalo 15m</option>
                <option value="30">Intervalo 30m</option>
                <option value="60">Intervalo 60m</option>
              </select>
            </div>
          </div>

          {cargando ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (() => {
            const maxInicio = Math.max(0, semana.length - 2);
            const inicio = Math.min(diaInicioMovil, maxInicio);
            const diasVisibles = isMobile ? semana.slice(inicio, inicio + 2) : semana;
            
            return (
              <>
                <Card padding={false} className="max-w-4xl mx-auto overflow-hidden">
                  <div className="max-h-[42vh] overflow-x-auto overflow-y-auto scroll-thin">
                    <table className={`w-full border-collapse text-xs ${isMobile ? '' : 'min-w-[700px]'}`}>
                      <thead className="sticky top-0 z-20">
                        <tr className="border-b border-borde bg-superficie">
                          <th className="sticky left-0 z-30 w-24 border-b border-borde bg-superficie px-3 py-3 text-left text-[11px] font-medium text-texto-secundario">Hora</th>
                          {diasVisibles.map((dia) => (
                            <th key={dia.fecha} className="border-b border-borde px-2 py-2.5 text-center">
                              <span className="block text-[10px] font-medium text-texto-secundario">{diasSem[dia.objetoFecha.getDay()]}</span>
                              <span className="num block text-sm font-medium text-texto-principal">{dia.objetoFecha.getDate()}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {generarSlotsDelDia().map((hora) => (
                          <tr key={hora} className="transition-colors hover:bg-panel/50">
                            <td className="sticky left-0 z-10 whitespace-nowrap border-b border-regla bg-superficie px-3 py-2 text-[11px] font-medium text-texto-secundario">{hora}</td>
                            {diasVisibles.map((dia) => {
                              const fueraDeDisponibilidad = esSlotFueraDeDisponibilidad(dia.fecha, hora);
                              const ocupado = !fueraDeDisponibilidad && esSlotOcupado(dia.fecha, hora);
                              const pasado = esSlotPasado(dia.fecha, hora);
                              const antelacion = !pasado && !fueraDeDisponibilidad && !ocupado && esSlotAntelacion(dia.fecha, hora);
                              const libre = !pasado && !fueraDeDisponibilidad && !ocupado && !antelacion;

                              let clase = 'slot-libre';
                              let label = 'Disponible';
                              if (pasado) {
                                clase = 'slot-pasado';
                                label = 'Pasado';
                              } else if (fueraDeDisponibilidad) {
                                clase = 'slot-no-disponible';
                                label = 'No disponible';
                              } else if (ocupado) {
                                clase = 'slot-ocupado';
                                label = 'Ocupado';
                              } else if (antelacion) {
                                clase = 'slot-antelacion';
                                label = '< 60 min';
                              }

                              return (
                                <td key={dia.fecha} className="border-b border-r border-regla p-0.5 last:border-r-0">
                                  <button
                                    type="button"
                                    onClick={() => libre && handleSlotClick(dia, hora)}
                                    disabled={!libre}
                                    className={`relative w-full rounded px-1 py-1.5 text-[10px] font-medium transition-colors ${clase}`}
                                  >
                                    {label}
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
                {isMobile && (
                  <div className="flex items-center justify-center gap-3 max-w-4xl mx-auto">
                    <button
                      type="button"
                      onClick={() => setDiaInicioMovil(Math.max(0, inicio - 1))}
                      disabled={inicio <= 0}
                      aria-label="Ver días anteriores"
                      className="px-3 py-1.5 border border-borde rounded bg-superficie hover:bg-fondo text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
                    >
                      ←
                    </button>
                    <span className="text-xs text-texto-secundario font-semibold">
                      Días {inicio + 1}–{inicio + diasVisibles.length} de {semana.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDiaInicioMovil(Math.min(maxInicio, inicio + 1))}
                      disabled={inicio >= maxInicio}
                      aria-label="Ver días siguientes"
                      className="px-3 py-1.5 border border-borde rounded bg-superficie hover:bg-fondo text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
                    >
                      →
                    </button>
                  </div>
                )}
              </>
            );
          })()}

          <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-2 border-t border-borde pt-4 text-[11px] text-texto-secundario">
            <span className="flex items-center gap-1.5"><span className="slot-libre h-3.5 w-3.5 rounded-sm border" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="slot-ocupado h-3.5 w-3.5 rounded-sm border" /> Ocupado</span>
            <span className="flex items-center gap-1.5"><span className="slot-pasado h-3.5 w-3.5 rounded-sm border" /> Pasado</span>
            <span className="flex items-center gap-1.5"><span className="slot-no-disponible h-3.5 w-3.5 rounded-sm border" /> No disponible</span>
            <span className="flex items-center gap-1.5"><span className="slot-antelacion h-3.5 w-3.5 rounded-sm border" /> Anticipación &lt;60m</span>
          </div>

          <div className="mt-2 flex justify-center">
            <Button variant="secundario" onClick={volverAtras}>Atrás</Button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      <Modal
        open={paso === 4 && !!diaSeleccionado && !!slotSeleccionado}
        onClose={volverAtras}
        title="Confirma tu cita"
      >
        {diaSeleccionado && slotSeleccionado && (
          <div className="space-y-5">
            <div className="rounded-md border border-borde bg-panel/50 p-3.5">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-texto-secundario">Sede</span>
                <span className="text-right font-medium text-texto-principal">{ubicacionSeleccionada?.nombre}</span>
                <span className="text-texto-secundario">Estilista</span>
                <span className="text-right font-medium text-texto-principal">{empleadoSeleccionado?.nombre} {empleadoSeleccionado?.apellido}</span>
                <span className="text-texto-secundario">Fecha</span>
                <span className="text-right font-medium capitalize text-texto-principal">{fechaBonita(diaSeleccionado.fecha)}</span>
                <span className="text-texto-secundario">Horario</span>
                <span className="num text-right font-medium text-texto-principal">
                  {slotSeleccionado} → {calcularHoraFin()} ({duracionSeleccionada} min)
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="servicio-reserva" className="mb-1.5 block text-xs font-medium text-texto-principal">
                  Servicio
                </label>
                <select
                  id="servicio-reserva"
                  value={servicioSeleccionado}
                  onChange={(e) => setServicioSeleccionado(e.target.value)}
                  className="h-10 w-full rounded-md border border-control bg-superficie px-3 text-sm text-texto-principal focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
                >
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({s.duracion_base_minutos || s.duracion || 30} min · ${parseFloat(s.precio_base || s.precio || 0).toLocaleString('es-CO')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 items-end gap-4">
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-texto-principal">Personas</span>
                  <div className="flex items-center gap-2" role="group" aria-label="Cantidad de personas">
                    <button
                      type="button"
                      aria-label="Quitar una persona"
                      onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-control text-base transition-colors hover:bg-panel"
                    >
                      −
                    </button>
                    <span className="num w-8 text-center text-sm font-medium" aria-live="polite">{cantidad}</span>
                    <button
                      type="button"
                      aria-label="Agregar una persona"
                      onClick={() => setCantidad((c) => Math.min(5, c + 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-control text-base transition-colors hover:bg-panel"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-texto-secundario">Total estimado</span>
                  <p className="num text-2xl font-medium text-texto-principal">${totalPrecio.toLocaleString('es-CO')}</p>
                </div>
              </div>
            </div>

            <p className="text-[11px] leading-5 text-tenue">
              El monto final se calcula en el servidor al confirmar la reserva. La disponibilidad puede cambiar mientras completas el pago.
            </p>

            <div className="flex gap-2 border-t border-borde pt-4">
              <Button variant="secundario" className="flex-1" onClick={volverAtras}>Atrás</Button>
              <Button className="flex-1" onClick={handleCrearReserva} disabled={cargando}>
                {cargando ? <Spinner /> : 'Confirmar reserva'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {paso === 5 && reservaCreada && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-texto-principal">Elige cómo pagar</h2>
            <p className="mt-0.5 text-xs text-texto-secundario">Tu cita ya está registrada. El pago en línea o en efectivo la deja lista.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col items-center rounded-lg border border-borde bg-superficie p-5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-exito/10 text-exito">
                <Check className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-texto-principal">Reserva registrada</h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-texto-secundario">
                Muestra el QR al llegar. Si eliges efectivo, el pago se registra en recepción.
              </p>
              {reservaCreada.qr_data_url && (
                <div className="mt-4 inline-block rounded-md border border-borde bg-white p-3">
                  <img src={reservaCreada.qr_data_url} alt="Código QR de la cita" className="h-32 w-32" />
                  {reservaCreada.qr_token && (
                    <span className="mono mt-2 block break-all text-[9px] text-tenue">{reservaCreada.qr_token}</span>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button variant="secundario" size="sm" onClick={descargarQR}>
                  Descargar QR
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/cliente')}>
                  Ir a mis citas
                </Button>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-borde bg-superficie p-5">
              <div>
                <p className="text-xs font-medium text-texto-principal">Forma de pago</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago('efectivo')}
                    className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors ${
                      metodoPago === 'efectivo' ? 'border-acento bg-acento-suave/50' : 'border-borde hover:bg-panel'
                    }`}
                  >
                    <span className={`text-xs font-medium ${metodoPago === 'efectivo' ? 'text-acento-tinta' : 'text-texto-secundario'}`}>
                      Efectivo en local
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('online')}
                    className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors ${
                      metodoPago === 'online' ? 'border-acento bg-acento-suave/50' : 'border-borde hover:bg-panel'
                    }`}
                  >
                    <span className={`text-xs font-medium ${metodoPago === 'online' ? 'text-acento-tinta' : 'text-texto-secundario'}`}>
                      Pago en línea
                    </span>
                  </button>
                </div>
              </div>

              {metodoPago === 'efectivo' ? (
                <div className="space-y-3">
                  <p className="text-xs leading-5 text-texto-secundario">
                    Reserva ahora y paga en el local al presentar tu código QR.
                  </p>
                  <Button onClick={confirmarPagoEfectivo} className="w-full">
                    Confirmar y pagar en local
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-borde bg-panel/60 p-3">
                    <p className="text-[11px] font-medium text-texto-secundario">Medios disponibles en Wompi</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-texto-principal">
                      <span className="rounded border border-borde bg-superficie px-2 py-1.5">Tarjeta</span>
                      <span className="rounded border border-borde bg-superficie px-2 py-1.5">PSE</span>
                      <span className="rounded border border-borde bg-superficie px-2 py-1.5">Nequi</span>
                      <span className="rounded border border-borde bg-superficie px-2 py-1.5">Bancolombia</span>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-texto-secundario">
                    Total: <strong className="num text-texto-principal">${totalPrecio.toLocaleString('es-CO')}</strong>. El cobro lo procesa Wompi; el SGP no almacena datos de tarjeta.
                  </p>
                  {pagoMensaje && (
                    <p
                      className={`text-xs font-medium ${
                        pagoEstado === 'aprobado'
                          ? 'text-exito'
                          : pagoEstado === 'declinado' || pagoEstado === 'error'
                            ? 'text-error'
                            : 'text-advertencia'
                      }`}
                    >
                      {pagoMensaje}
                    </p>
                  )}
                  <Button
                    onClick={pagarConWompi}
                    disabled={pagoEstado === 'procesando' || pagoEstado === 'aprobado'}
                    className="w-full"
                  >
                    {pagoEstado === 'procesando' ? (
                      <Spinner />
                    ) : pagoEstado === 'declinado' || pagoEstado === 'error' ? (
                      'Reintentar pago en línea'
                    ) : (
                      'Pagar con Wompi'
                    )}
                  </Button>
                  {(pagoEstado === 'esperando' || pagoEstado === 'pendiente') && (
                    <div className="space-y-2 rounded-md border border-borde bg-panel/50 p-3">
                      <label className="block text-[11px] font-medium text-texto-principal">
                        Número de transacción (comprobante de Wompi)
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={transaccionManual}
                          onChange={(e) => setTransaccionManual(e.target.value)}
                          placeholder="01-1531231271-19365"
                          className="h-9 w-full rounded-md border border-control bg-superficie px-3 text-xs text-texto-principal focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
                        />
                        <Button
                          variant="secundario"
                          size="sm"
                          onClick={() => verificarPago(transaccionManual.trim())}
                          disabled={!transaccionManual.trim()}
                        >
                          Verificar
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={consultarEstadoPago}
                        className="text-[11px] font-medium text-acento underline-offset-2 hover:underline"
                      >
                        Ya pagué, actualizar estado
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {paso === 1 && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-30 border-t border-borde bg-superficie p-3 md:hidden">
          <Button onClick={irAPaso2} disabled={!ubicacionSeleccionada || cargando} className="w-full">
            {cargando ? <Spinner /> : 'Continuar con estilista'}
          </Button>
        </div>
      )}
    </div>
  );
}
