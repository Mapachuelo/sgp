import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Modal, Toast, Input, Spinner, Select } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import useWebSocket from '../../hooks/use-websocket.js';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const customMarkerIcon = new L.DivIcon({
  html: `<div style="display: flex; justify-content: center; align-items: center; width: 30px; height: 30px;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B84C3D" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#F5E6E3"/>
      <circle cx="12" cy="10" r="3" fill="#B84C3D"/>
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

const PASOS = [
  { num: 1, label: 'Ubicacion' },
  { num: 2, label: 'Empleado' },
  { num: 3, label: 'Calendario' },
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
  return nombre.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
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
  const [formPago, setFormPago] = useState({ titular: '', numero: '', expiracion: '', cvv: '' });
  const [pagoCompletado, setPagoCompletado] = useState(false);

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
        cargarCalendario(base || new Date()).catch(() => {});
      }
    }
    if (ultimoEvento.tipo === 'reserva.actualizada' && pasoRef.current === 3) {
      const base = fechaBaseRef.current;
      cargarCalendario(base || new Date()).catch(() => {});
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
      const hoy = formatearFechaLocal(new Date());
      setEmpleados(await api.reservas.empleadosDisponibles({ ubicacion_id: ubicacionSeleccionada.id, fecha: hoy }) || []);
    } catch (err) { mostrarToast(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const cargarCalendario = async (baseDate) => {
    if (!empleadoSeleccionado) return;
    setCargando(true);
    try {
      const [empServs, prefs] = await Promise.all([
        api.reservas.empleadoTiempos.get(empleadoSeleccionado.id),
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
        api.reservas.disponibilidad({ empleado_id: empleadoSeleccionado.id, ubicacion_id: ubicacionSeleccionada.id, fecha: d.fecha })
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

  const irAPaso3 = async () => {
    if (!empleadoSeleccionado) return;
    setPaso(3);
    await cargarCalendario(new Date());
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
      const duracion = serv.duracion_base_minutos || 30;
      const [h, m] = slotSeleccionado.split(':');
      const totalMin = parseInt(h) * 60 + parseInt(m) + duracion;
      const hFin = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
      const mFin = String(totalMin % 60).padStart(2, '0');
      const localInicio = new Date(`${diaSeleccionado.fecha}T${slotSeleccionado}:00`);
      const localFin = new Date(`${diaSeleccionado.fecha}T${hFin}:${mFin}:00`);
      const fechaInicio = localInicio.toISOString();
      const fechaFin = localFin.toISOString();

      const data = await api.reservas.create({
        empleado_id: empleadoSeleccionado.id,
        servicio_id: parseInt(servicioSeleccionado),
        ubicacion_id: ubicacionSeleccionada.id,
        inicia_en: fechaInicio,
        termina_en: fechaFin,
        cantidad_personas: cantidad,
      });
      setReservaCreada(data);
      setPaso(5);
      mostrarToast('Reserva pre-registrada con exito', 'success');
    } catch (err) { mostrarToast(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const handleExpiracionChange = (e) => {
    const input = e.target.value;
    const previousValue = formPago.expiracion;
    
    // If user is deleting, just let them delete
    if (input.length < previousValue.length) {
      setFormPago({ ...formPago, expiracion: input });
      return;
    }
    
    let clean = input.replace(/\D/g, '');
    if (clean.length > 4) {
      clean = clean.slice(0, 4);
    }
    
    let formatted = clean;
    if (clean.length > 2) {
      formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
    } else if (clean.length === 2) {
      formatted = `${clean}/`;
    }
    
    setFormPago({ ...formPago, expiracion: formatted });
  };

  const handlePagoSubmit = (e) => {
    if (e) e.preventDefault();
    if (metodoPago === 'online') {
      if (!formPago.titular.trim() || !formPago.numero.trim() || !formPago.expiracion.trim() || !formPago.cvv.trim()) {
        mostrarToast('Completa todos los campos de pago', 'warning');
        return;
      }
    }
    setPagoCompletado(true);
    mostrarToast('Reserva activada correctamente');
  };

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
    const slotMin = slotDate.getUTCHours() * 60 + slotDate.getUTCMinutes();
    return slotsDia.some((s) => {
      const ini = new Date(s.inicia_en);
      const fin = new Date(s.termina_en);
      const iniMin = ini.getUTCHours() * 60 + ini.getUTCMinutes();
      const finMin = fin.getUTCHours() * 60 + fin.getUTCMinutes();
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
    if (!reservaCreada?.qr_data_url) return;
    const a = document.createElement('a');
    a.href = reservaCreada.qr_data_url;
    a.download = `reserva-${reservaCreada.id || 'qr'}.png`;
    a.click();
  };

  const selectedServ = servicios.find((s) => String(s.id) === String(servicioSeleccionado));
  const totalPrecio = selectedServ ? parseFloat(selectedServ.precio_base || selectedServ.precio || 0) * cantidad : 0;

  if (pagoCompletado) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Toast open={toast.open} message={toast.message} type={toast.type} />
        <Card className="p-10 shadow-elevated">
          <div className="text-exito mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-texto-principal mb-2">¡Tu Cita ha sido Confirmada!</h2>
          <p className="text-texto-secundario mb-6">Tu reserva se encuentra activa. Muestra el código QR al ingresar.</p>
          {reservaCreada?.qr_data_url && (
            <div className="border border-borde p-4 rounded-3xl bg-white shadow-sm inline-block mb-6 max-w-full w-48">
              <img src={reservaCreada.qr_data_url} alt="QR" className="w-40 h-40 mx-auto" />
              {reservaCreada.qr_token && (
                <span className="font-mono text-[10px] sm:text-xs text-texto-principal font-bold mt-2 block break-all">{reservaCreada.qr_token}</span>
              )}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button variant="secundario" onClick={descargarQR}>Descargar QR</Button>
            <Button onClick={() => navigate('/cliente')}>Ir al inicio</Button>
          </div>
        </Card>
      </div>
    );
  }

  const diasSem = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Toast open={toast.open} message={toast.message} type={toast.type} />
      <div className="text-center space-y-2 max-w-xl mx-auto mb-6">
        <h1 className="font-display text-3xl font-bold text-texto-principal">Agendar Cita</h1>
        <p className="text-sm text-texto-secundario">Sigue los pasos interactivos para completar la reserva en la sede de tu elección.</p>
      </div>

      <div className="flex justify-between items-center max-w-2xl mx-auto relative mb-10 px-4">
        {PASOS.map((p, i) => (
          <div key={p.num} className={`flex items-center ${i < PASOS.length - 1 ? 'flex-grow' : ''}`}>
            <div className="flex items-center gap-1.5 select-none shrink-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                p.num === paso ? 'bg-primario text-white' : p.num < paso ? 'bg-exito text-white' : 'bg-borde text-texto-secundario'
              }`}>
                {p.num}
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold hidden sm:inline-block ${p.num <= paso ? 'text-texto-principal' : 'text-texto-secundario'}`}>{p.label}</span>
            </div>
            {i < PASOS.length - 1 && <div className={`flex-grow h-px mx-2 sm:mx-3 ${p.num < paso ? 'bg-exito' : 'bg-borde'}`} />}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {paso === 1 && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-bold text-texto-principal text-center">Paso 1: Selecciona la sede del servicio</h2>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-1/2 flex flex-col gap-3">
              {/* Buscador y filtro de ciudad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <Input
                  label="Buscar sede"
                  placeholder="Nombre o dirección..."
                  value={filtroNombre}
                  onChange={(e) => setFiltroNombre(e.target.value)}
                />
                <Select
                  label="Filtrar por ciudad"
                  value={filtroCiudad}
                  onChange={(e) => setFiltroCiudad(e.target.value)}
                  options={ciudades.map((c) => ({ value: c, label: c }))}
                />
              </div>

              {cargando && ubicaciones.length === 0 ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : ubicacionesFiltradas.length === 0 ? (
                <Card>
                  <p className="text-texto-secundario text-center py-8">
                    No se encontraron sedes con los filtros seleccionados.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {ubicacionesFiltradas.map((ubic) => {
                    const isSel = ubicacionSeleccionada?.id === ubic.id;
                    return (
                      <div
                        key={ubic.id}
                        onClick={() => setUbicacionSeleccionada(ubic)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 bg-superficie ${
                          isSel ? 'border-primario bg-primario/5 ring-2 ring-primario/10' : 'border-borde hover:border-primario'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-primario/10 flex items-center justify-center shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5E3C" strokeWidth="1.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-texto-principal">{ubic.nombre}</h3>
                          {ubic.direccion && <p className="text-xs text-texto-secundario mt-0.5">{ubic.direccion}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:w-1/2 bg-superficie rounded-2xl border border-borde p-4 shadow-premium space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-texto-secundario">Mapa de Sedes</p>
              <div className="h-64 rounded-xl border border-borde overflow-hidden relative z-10 bg-fondo">
                <MapContainer
                  center={ubicacionSeleccionada ? [parseFloat(ubicacionSeleccionada.latitud), parseFloat(ubicacionSeleccionada.longitud)] : [4.60971, -74.08175]}
                  zoom={13}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {ubicacionesFiltradas.map((u) => (
                    <Marker
                      key={u.id}
                      position={[parseFloat(u.latitud), parseFloat(u.longitud)]}
                      icon={customMarkerIcon}
                      eventHandlers={{
                        click: () => setUbicacionSeleccionada(u)
                      }}
                    />
                  ))}
                  {ubicacionSeleccionada && (
                    <MapRecenter
                      lat={parseFloat(ubicacionSeleccionada.latitud)}
                      lng={parseFloat(ubicacionSeleccionada.longitud)}
                    />
                  )}
                </MapContainer>
              </div>
              <Button
                onClick={irAPaso2}
                disabled={!ubicacionSeleccionada}
                className="w-full py-3"
              >
                {cargando ? <Spinner /> : 'Siguiente: Elegir Estilista'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {paso === 2 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <button onClick={volverAtras} className="text-xs text-primario hover:underline flex items-center gap-1">← Volver</button>
            <span className="text-xs text-texto-secundario">Sede: <strong className="text-texto-principal">{ubicacionSeleccionada?.nombre}</strong></span>
          </div>
          <h2 className="font-display text-lg font-bold text-texto-principal text-center">Paso 2: Selecciona un Estilista</h2>
          {cargando ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : empleados.length === 0 ? (
            <Card><p className="text-texto-secundario text-center py-8">No hay estilistas registrados en esta sede en este momento.</p></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {empleados.map((emp) => {
                const isSel = empleadoSeleccionado?.id === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      setEmpleadoSeleccionado(emp);
                      setTimeout(() => {
                        irAPaso3();
                      }, 300);
                    }}
                    className={`p-5 rounded-2xl border-2 cursor-pointer text-center transition flex flex-col items-center gap-3 bg-superficie ${
                      isSel ? 'border-primario bg-primario/5' : 'border-borde hover:border-primario'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-primario/10 text-primario font-display text-xl font-bold flex items-center justify-center">
                      {obtenerIniciales(emp.nombre)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-texto-principal">{emp.nombre} {emp.apellido}</h4>
                      {emp.especialidad && <p className="text-xs text-texto-secundario mt-0.5">{emp.especialidad}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-8">
            <Button variant="secundario" onClick={volverAtras}>Atrás</Button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {paso === 3 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <button onClick={volverAtras} className="text-xs text-primario hover:underline flex items-center gap-1">← Volver</button>
            <span className="text-xs text-texto-secundario">Estilista: <strong className="text-texto-principal">{empleadoSeleccionado?.nombre} {empleadoSeleccionado?.apellido}</strong></span>
          </div>
          <div className="flex justify-between items-center flex-wrap gap-2 border-b border-borde pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-texto-principal">Paso 3: Escoge el día y la hora</h2>
              <p className="text-xs text-texto-secundario">Haga clic en una ranura libre para agendar. Debe tener al menos 60m de antelación.</p>
            </div>
            <div className="flex gap-2 items-center">
              {fechaBase && (
                <div className="flex gap-1.5 items-center mr-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nueva = new Date(fechaBase);
                      nueva.setDate(nueva.getDate() - 6);
                      const hoy = new Date();
                      hoy.setHours(0, 0, 0, 0);
                      if (nueva < hoy) {
                        cargarCalendario(hoy);
                      } else {
                        cargarCalendario(nueva);
                      }
                    }}
                    disabled={fechaBase.getTime() <= new Date().setHours(0, 0, 0, 0)}
                    className="px-2.5 py-1.5 border border-borde rounded bg-superficie hover:bg-fondo text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
                    title="Ver 6 días anteriores"
                  >
                    ←
                  </button>
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
                        const nueva = new Date(partes[0], partes[1] - 1, partes[2]);
                        cargarCalendario(nueva);
                      }
                    }}
                    className="text-xs px-2.5 py-1.5 border border-borde rounded bg-superficie text-texto-principal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nueva = new Date(fechaBase);
                      nueva.setDate(nueva.getDate() + 6);
                      cargarCalendario(nueva);
                    }}
                    className="px-2.5 py-1.5 border border-borde rounded bg-superficie hover:bg-fondo text-xs font-semibold transition cursor-pointer"
                    title="Ver siguientes 6 días"
                  >
                    →
                  </button>
                </div>
              )}
              <select
                value={granularidad}
                onChange={(e) => setGranularidad(Number(e.target.value))}
                className="text-xs px-2 py-1.5 border border-borde rounded bg-superficie text-texto-principal"
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
            const diasVisibles = isMobile ? semana.slice(0, 2) : semana;
            
            return (
              <>
                <Card padding={false} className="max-w-4xl mx-auto overflow-hidden border border-borde/70 shadow-premium">
                  <div className="overflow-y-auto overflow-x-auto max-h-[42vh]">
                    <table className={`w-full border-collapse text-xs ${isMobile ? '' : 'min-w-[700px]'}`}>
                      <thead className="sticky top-0 z-20">
                        <tr className="border-b border-borde bg-superficie/95 backdrop-blur">
                          <th className="sticky left-0 bg-superficie z-30 border-b border-borde py-4 px-4 text-left font-bold text-texto-secundario uppercase tracking-wider w-24">Hora</th>
                          {diasVisibles.map((dia) => (
                            <th key={dia.fecha} className="border-b border-borde py-3 px-2 text-center font-bold text-texto-principal">
                              <span className="text-[10px] font-bold text-texto-secundario uppercase block">{diasSem[dia.objetoFecha.getDay()]}</span>
                              <span className="font-display text-base font-bold text-texto-principal">{dia.objetoFecha.getDate()}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {generarSlotsDelDia().map((hora) => (
                          <tr key={hora} className="hover:bg-fondo/20 transition-colors">
                            <td className="sticky left-0 bg-superficie z-10 border-b border-borde/40 py-2.5 px-4 text-xs font-semibold text-texto-secundario whitespace-nowrap">{hora}</td>
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
                                <td key={dia.fecha} className="border-b border-r border-borde/20 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => libre && handleSlotClick(dia, hora)}
                                    disabled={!libre}
                                    className={`w-full text-center py-2 text-[10px] font-bold rounded-lg border transition hover:ring-2 hover:ring-primario/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm relative ${clase}`}
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
              </>
            );
          })()}

          <div className="flex flex-wrap justify-center gap-6 text-xs font-medium border-t border-borde/50 pt-4 max-w-4xl mx-auto">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border bg-[#DCE8E0] border-[#A3C9A8]" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border bg-[#F5E6E3] border-[#E8C5C0]" /> Ocupado</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border bg-[#EBEBEB] border-[#D1D1D1]" /> Pasado</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border bg-[#E2E8F0] border-[#CBD5E1]" /> No disponible</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border bg-[#FFF3E6] border-[#F0C78E]" /> Anticipación &lt;60m</span>
          </div>

          <div className="flex justify-center mt-6">
            <Button variant="secundario" onClick={volverAtras}>Atrás</Button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {paso === 4 && diaSeleccionado && slotSeleccionado && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-bold text-texto-principal text-center">Paso 4: Confirma los detalles de tu cita</h2>
          <div className="bg-superficie border border-borde rounded-2xl shadow-premium max-w-xl mx-auto p-6 space-y-6">
            <div className="space-y-3">
              <h3 className="font-display text-xl font-bold text-texto-principal border-b border-borde/50 pb-2">Resumen</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-texto-secundario">Sede</span>
                <span className="font-semibold text-right">{ubicacionSeleccionada?.nombre}</span>
                <span className="text-texto-secundario">Estilista</span>
                <span className="font-semibold text-right">{empleadoSeleccionado?.nombre} {empleadoSeleccionado?.apellido}</span>
                <span className="text-texto-secundario">Fecha y Hora</span>
                <span className="font-semibold text-right text-primario">{diaSeleccionado.fecha} · {slotSeleccionado}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-texto-principal uppercase mb-1.5">Selecciona el Servicio</label>
                <select
                  value={servicioSeleccionado}
                  onChange={(e) => setServicioSeleccionado(e.target.value)}
                  className="w-full px-3 py-2.5 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
                >
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({s.duracion_base_minutos || s.duracion || 30} min · ${parseFloat(s.precio_base || s.precio || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-texto-principal uppercase mb-1.5">Personas</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCantidad(c => Math.max(1, c - 1))}
                      className="w-8 h-8 rounded border border-borde flex items-center justify-center font-bold hover:bg-fondo transition"
                    >
                      -
                    </button>
                    <span className="font-semibold w-8 text-center text-sm">{cantidad}</span>
                    <button
                      onClick={() => setCantidad(c => Math.min(5, c + 1))}
                      className="w-8 h-8 rounded border border-borde flex items-center justify-center font-bold hover:bg-fondo transition"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-end">
                  <span className="text-xs text-texto-secundario">Total a pagar:</span>
                  <span className="text-2xl font-bold text-primario">${totalPrecio.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-borde/50">
              <Button variant="secundario" className="flex-1" onClick={volverAtras}>Atrás</Button>
              <Button className="flex-grow flex-1" onClick={handleCrearReserva} disabled={cargando}>
                {cargando ? <Spinner /> : 'Confirmar Reserva'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5 */}
      {paso === 5 && reservaCreada && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-bold text-texto-principal text-center">Paso 5: Proceso de Pago y Código QR</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* QR e Instrucciones */}
            <div className="bg-superficie border border-borde rounded-2xl p-6 shadow-premium flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-exito/10 flex items-center justify-center text-exito">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-texto-principal">¡Tu Reserva ha sido Registrada!</h3>
                <p className="text-xs text-texto-secundario mt-1">Hemos generado un token de acceso QR. Elige el método de pago para activarla.</p>
              </div>

              {reservaCreada.qr_data_url && (
                <div className="border border-borde p-3 rounded-2xl bg-white shadow-sm inline-block max-w-full w-40">
                  <div className="flex flex-col items-center">
                    <img src={reservaCreada.qr_data_url} alt="QR" className="w-32 h-32" />
                    {reservaCreada.qr_token && (
                      <span className="font-mono text-[9px] sm:text-[10px] text-texto-principal font-bold mt-2 break-all text-center">{reservaCreada.qr_token}</span>
                    )}
                  </div>
                </div>
              )}
              <Button variant="secundario" size="sm" onClick={descargarQR}>Descargar QR</Button>
            </div>

            {/* Formularios de Pago */}
            <div className="bg-superficie border border-borde rounded-2xl p-6 shadow-premium space-y-4">
              <h3 className="font-semibold text-sm text-texto-principal uppercase tracking-wider">Selecciona la forma de pago</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMetodoPago('efectivo')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition ${
                    metodoPago === 'efectivo' ? 'border-primario bg-primario/5' : 'border-borde hover:border-primario'
                  }`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={metodoPago === 'efectivo' ? '#8B5E3C' : '#8C7B70'} strokeWidth="1.5">
                    <rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span className={`text-xs font-bold ${metodoPago === 'efectivo' ? 'text-primario' : 'text-texto-secundario'}`}>Efectivo en Local</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoPago('online')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition ${
                    metodoPago === 'online' ? 'border-primario bg-primario/5' : 'border-borde hover:border-primario'
                  }`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={metodoPago === 'online' ? '#8B5E3C' : '#8C7B70'} strokeWidth="1.5">
                    <rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>
                  </svg>
                  <span className={`text-xs font-bold ${metodoPago === 'online' ? 'text-primario' : 'text-texto-secundario'}`}>Pago con Tarjeta</span>
                </button>
              </div>

              {metodoPago === 'online' && (
                <div className="space-y-3 animate-fade-in">
                  <div>
                    <label className="block text-[10px] font-semibold text-texto-principal uppercase mb-1">Nombre del Tarjetahabiente</label>
                    <input
                      type="text"
                      placeholder="Juan Pérez"
                      value={formPago.titular}
                      onChange={(e) => setFormPago({ ...formPago, titular: e.target.value })}
                      className="w-full px-3 py-2 border border-borde rounded-lg text-xs bg-fondo/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-texto-principal uppercase mb-1">Número de Tarjeta</label>
                    <input
                      type="text"
                      placeholder="4242 4242 4242 4242"
                      value={formPago.numero}
                      onChange={(e) => setFormPago({ ...formPago, numero: e.target.value })}
                      className="w-full px-3 py-2 border border-borde rounded-lg text-xs bg-fondo/20 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-texto-principal uppercase mb-1">Expiración</label>
                      <input
                        type="text"
                        placeholder="MM/AA"
                        value={formPago.expiracion}
                        onChange={handleExpiracionChange}
                        maxLength="5"
                        className="w-full px-3 py-2 border border-borde rounded-lg text-xs bg-fondo/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-texto-principal uppercase mb-1">CVV</label>
                      <input
                        type="password"
                        placeholder="***"
                        value={formPago.cvv}
                        onChange={(e) => setFormPago({ ...formPago, cvv: e.target.value })}
                        className="w-full px-3 py-2 border border-borde rounded-lg text-xs bg-fondo/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handlePagoSubmit}
                className="w-full py-3 bg-exito hover:bg-green-700 text-white rounded-xl font-semibold transition shadow-md"
              >
                Confirmar y Activar Reserva
              </Button>
            </div>
          </div>
          <div className="flex justify-center mt-4">
            <Button variant="secundario" onClick={volverAtras}>Atrás</Button>
          </div>
        </div>
      )}
    </div>
  );
}
