import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Modal, Toast, Input, Spinner } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';

const PASOS = [
  { num: 1, label: 'Ubicacion' },
  { num: 2, label: 'Empleado' },
  { num: 3, label: 'Calendario' },
  { num: 4, label: 'Confirmar' },
  { num: 5, label: 'Pago' },
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function obtenerIniciales(nombre) {
  if (!nombre) return '??';
  return nombre.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function NuevaReserva() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);

  const [empleados, setEmpleados] = useState([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);

  const [semana, setSemana] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [slots, setSlots] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [modalServicio, setModalServicio] = useState(false);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [preferencias, setPreferencias] = useState(null);
  const [granularidad, setGranularidad] = useState(30);

  const [reservaCreada, setReservaCreada] = useState(null);
  const [formPago, setFormPago] = useState({ titular: '', numero: '', expiracion: '', cvv: '' });
  const [pagoCompletado, setPagoCompletado] = useState(false);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

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
      const hoy = new Date().toISOString().split('T')[0];
      setEmpleados(await api.reservas.empleadosDisponibles({ ubicacion_id: ubicacionSeleccionada.id, fecha: hoy }) || []);
    } catch (err) { mostrarToast(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const irAPaso3 = async () => {
    if (!empleadoSeleccionado) return;
    setPaso(3);
    setCargando(true);
    try {
      const [servs, prefs] = await Promise.all([api.reservas.servicios(), api.preferencias.get()]);
      setServicios(servs || []);
      setPreferencias(prefs);
      setGranularidad(prefs?.granularidad_calendario || 30);
      generarSemana();
    } catch (err) { mostrarToast(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const generarSemana = () => {
    const dias = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaActual = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (diaActual === 0 ? 6 : diaActual - 1));
    for (let i = 0; i < 6; i++) {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + i);
      dias.push({ fecha: fecha.toISOString().split('T')[0], diaSemana: DIAS_SEMANA[i], esHoy: fecha.getTime() === hoy.getTime(), esPasado: fecha < hoy });
    }
    setSemana(dias);
    setDiaSeleccionado(null);
    setSlots(null);
  };

  const cargarSlots = (fecha) => {
    if (!empleadoSeleccionado?.id || !ubicacionSeleccionada?.id) return;
    api.reservas.disponibilidad({ empleado_id: empleadoSeleccionado.id, ubicacion_id: ubicacionSeleccionada.id, fecha })
      .then(data => setSlots(data || { slots_ocupados: [] }))
      .catch(err => mostrarToast(err.message, 'error'));
  };

  const handleDiaClick = (dia) => { if (!dia.esPasado) { setDiaSeleccionado(dia); setSlots(null); cargarSlots(dia.fecha); } };

  const handleSlotClick = (hora) => {
    const ahora = new Date();
    const [h, m] = hora.split(':');
    const slotDate = new Date(diaSeleccionado.fecha + 'T00:00:00');
    slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
    const diffMin = (slotDate - ahora) / 60000;
    if (diffMin < 0 || diffMin < 60) return;
    setSlotSeleccionado(hora);
    setServicioSeleccionado(servicios.length > 0 ? String(servicios[0].id) : '');
    setCantidad(1);
    setModalServicio(true);
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
      setModalServicio(false);
      setPaso(4);
      mostrarToast('Reserva creada con exito', 'success');
    } catch (err) { mostrarToast(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const handlePagoSubmit = (e) => { e.preventDefault(); setPagoCompletado(true); mostrarToast('Pago procesado'); };

  const getPasoVariant = (num) => { if (num < paso) return 'success'; if (num === paso) return 'info'; return 'default'; };

  const volverAtras = () => {
    if (paso === 2) { setPaso(1); setEmpleadoSeleccionado(null); }
    else if (paso === 3) { setPaso(2); setDiaSeleccionado(null); setSlots(null); }
    else if (paso === 4) setPaso(3);
    else if (paso === 5) setPaso(4);
  };

  const generarSlotsDelDia = () => {
    if (!diaSeleccionado) return [];
    const horaDesde = preferencias?.rango_hora_desde || '06:00:00';
    const horaHasta = preferencias?.rango_hora_hasta || '22:00:00';
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

  const esSlotOcupado = (hora) => {
    if (!slots?.slots_ocupados) return false;
    const slotDate = new Date(diaSeleccionado.fecha + 'T' + hora + ':00');
    const slotMin = slotDate.getUTCHours() * 60 + slotDate.getUTCMinutes();
    return slots.slots_ocupados.some((s) => {
      const ini = new Date(s.inicia_en);
      const fin = new Date(s.termina_en);
      const iniMin = ini.getUTCHours() * 60 + ini.getUTCMinutes();
      const finMin = fin.getUTCHours() * 60 + fin.getUTCMinutes();
      return slotMin >= iniMin && slotMin < finMin;
    });
  };

  const esSlotAntelacion = (hora) => {
    if (!diaSeleccionado) return false;
    const ahora = new Date();
    const [h, m] = hora.split(':');
    const slotDate = new Date(diaSeleccionado.fecha + 'T00:00:00');
    slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
    const diffMin = (slotDate - ahora) / 60000;
    return diffMin > 0 && diffMin < 60;
  };

  const esSlotPasado = (hora) => {
    if (!diaSeleccionado) return false;
    const ahora = new Date();
    const [h, m] = hora.split(':');
    const slotDate = new Date(diaSeleccionado.fecha + 'T00:00:00');
    slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
    return slotDate <= ahora;
  };

  const descargarQR = () => {
    if (!reservaCreada?.qr_data_url) return;
    const a = document.createElement('a');
    a.href = reservaCreada.qr_data_url;
    a.download = `reserva-${reservaCreada.id || 'qr'}.png`;
    a.click();
  };

  if (pagoCompletado) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Toast open={toast.open} message={toast.message} type={toast.type} />
        <Card className="p-10">
          <div className="text-exito mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-texto-principal mb-2">Reserva confirmada</h2>
          <p className="text-texto-secundario mb-6">Tu cita ha sido agendada correctamente.</p>
          {reservaCreada?.qr_data_url && <img src={reservaCreada.qr_data_url} alt="QR" className="w-40 h-40 mx-auto mb-6" />}
          <Button onClick={() => navigate('/cliente')}>Ir al dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />
      <h1 className="font-display text-3xl font-bold text-texto-principal mb-8">Nueva Reserva</h1>

      <div className="flex items-center justify-between mb-10 flex-wrap gap-y-2">
        {PASOS.map((p, i) => (
          <div key={p.num} className="flex items-center">
            <div className="flex items-center gap-2">
              <Badge variant={getPasoVariant(p.num)}>{p.num}</Badge>
              <span className={`text-sm font-medium ${p.num <= paso ? 'text-texto-principal' : 'text-texto-secundario'}`}>{p.label}</span>
            </div>
            {i < PASOS.length - 1 && <div className={`w-8 h-px mx-2 ${p.num < paso ? 'bg-exito' : 'bg-borde'}`} />}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {paso === 1 && (
        <div>
          <h2 className="font-display text-xl font-semibold text-texto-principal mb-6">Selecciona una sede</h2>
          {cargando && ubicaciones.length === 0 ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : ubicaciones.length === 0 ? (
            <Card><p className="text-texto-secundario text-center py-8">No hay ubicaciones disponibles.</p></Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {ubicaciones.map((ubic) => (
                <Card
                  key={ubic.id}
                  onClick={() => setUbicacionSeleccionada(ubic)}
                  className={`cursor-pointer transition border-2 ${ubicacionSeleccionada?.id === ubic.id ? 'border-primario ring-2 ring-primario/20' : 'border-borde hover:border-primario'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primario/10 flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5E3C" strokeWidth="1.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div><h3 className="font-semibold text-texto-principal">{ubic.nombre}</h3>{ubic.direccion && <p className="text-xs text-texto-secundario mt-0.5">{ubic.direccion}</p>}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {ubicaciones.length > 0 && (
            <div className="mt-8">
              <Button onClick={irAPaso2} disabled={!ubicacionSeleccionada}>{cargando ? <Spinner /> : 'Siguiente: Elegir empleado'}</Button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2 */}
      {paso === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-display text-xl font-semibold text-texto-principal">Selecciona un empleado</h2>
            {ubicacionSeleccionada && <Badge variant="info">{ubicacionSeleccionada.nombre}</Badge>}
          </div>
          {cargando ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : empleados.length === 0 ? (
            <Card><p className="text-texto-secundario text-center py-8">No hay empleados disponibles para esta sede.</p></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {empleados.map((emp) => (
                <Card
                  key={emp.id}
                  onClick={() => setEmpleadoSeleccionado(emp)}
                  className={`cursor-pointer transition border-2 text-center ${empleadoSeleccionado?.id === emp.id ? 'border-primario ring-2 ring-primario/20' : 'border-borde hover:border-primario'}`}
                >
                  <div className="w-12 h-12 rounded-full bg-primario/10 text-primario flex items-center justify-center mx-auto mb-2 font-semibold text-lg">{obtenerIniciales(emp.nombre)}</div>
                  <p className="text-sm font-medium text-texto-principal">{emp.nombre} {emp.apellido}</p>
                </Card>
              ))}
            </div>
          )}
          <div className="mt-8 flex gap-3">
            <Button variant="secundario" onClick={volverAtras}>Atras</Button>
            <Button onClick={irAPaso3} disabled={!empleadoSeleccionado}>{cargando ? <Spinner /> : 'Siguiente: Elegir horario'}</Button>
          </div>
        </div>
      )}

      {/* STEP 3: Calendario */}
      {paso === 3 && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-texto-principal">Selecciona el horario</h2>
              {empleadoSeleccionado && <Badge variant="info">{empleadoSeleccionado.nombre}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-texto-secundario">Granularidad:</span>
              <select value={granularidad} onChange={(e) => setGranularidad(Number(e.target.value))} className="px-3 py-1.5 border border-borde rounded-lg text-xs text-texto-principal bg-fondo">
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>
          {cargando && semana.length === 0 ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
                {semana.map((dia) => (
                  <button key={dia.fecha} onClick={() => handleDiaClick(dia)} disabled={dia.esPasado}
                    className={`p-3 rounded-xl text-center transition border-2 ${dia.esPasado ? 'opacity-30 cursor-not-allowed border-borde' : diaSeleccionado?.fecha === dia.fecha ? 'border-primario bg-primario/10' : dia.esHoy ? 'border-secundario bg-secundario/5' : 'border-borde hover:border-primario'}`}>
                    <p className="text-xs text-texto-secundario">{dia.diaSemana}</p>
                    <p className="text-lg font-bold text-texto-principal">{dia.fecha.split('-')[2]}</p>
                  </button>
                ))}
              </div>
              {diaSeleccionado && (
                <div>
                  <p className="text-sm text-texto-secundario mb-3">{diaSeleccionado.diaSemana} {diaSeleccionado.fecha} — slots de {granularidad} min</p>
                  {slots === null ? (
                    <div className="flex justify-center py-6"><Spinner /></div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {generarSlotsDelDia().map((hora) => {
                        const ocupado = esSlotOcupado(hora);
                        const pasado = esSlotPasado(hora);
                        const antelacion = !pasado && !ocupado && esSlotAntelacion(hora);
                        const libre = !pasado && !ocupado && !antelacion;
                        return (
                          <button key={hora} onClick={() => libre && handleSlotClick(hora)} disabled={!libre}
                            className={`p-2 rounded-lg text-xs text-center font-medium transition ${pasado ? 'opacity-20 cursor-not-allowed bg-fondo' : ocupado ? 'slot-ocupado rounded-lg' : antelacion ? 'slot-antelacion rounded-lg' : 'slot-libre rounded-lg'}`}>
                            {hora}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-4 mt-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-exito/30 border border-exito/50" /> Disponible</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-error/20 border border-error/40" /> Ocupado</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-advertencia/20 border border-advertencia/40" /> Anticipacion &lt;60min</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="mt-8"><Button variant="secundario" onClick={volverAtras}>Atras</Button></div>
        </div>
      )}

      {/* Modal servicio */}
      <Modal open={modalServicio} onClose={() => setModalServicio(false)} title="Confirmar reserva">
        <div className="space-y-4">
          <div className="bg-fondo rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-texto-secundario">Dia</span><span className="font-semibold">{diaSeleccionado?.fecha}</span></div>
            <div className="flex justify-between"><span className="text-texto-secundario">Horario</span><span className="font-semibold">{slotSeleccionado}</span></div>
            <div className="flex justify-between"><span className="text-texto-secundario">Empleado</span><span className="font-semibold">{empleadoSeleccionado?.nombre}</span></div>
            <div className="flex justify-between"><span className="text-texto-secundario">Sede</span><span className="font-semibold">{ubicacionSeleccionada?.nombre}</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-principal mb-2">Servicio</label>
            <div className="grid grid-cols-2 gap-2">
              {servicios.map((s) => (
                <label key={s.id} className={`flex items-center gap-2 bg-fondo rounded-lg p-3 border cursor-pointer transition ${String(servicioSeleccionado) === String(s.id) ? 'border-primario bg-primario/5' : 'border-borde hover:border-primario'}`}>
                  <input type="radio" name="servicio" value={s.id} checked={String(servicioSeleccionado) === String(s.id)} onChange={(e) => setServicioSeleccionado(e.target.value)} className="accent-primario" />
                  <div><p className="text-sm font-medium">{s.nombre}</p><p className="text-xs text-texto-secundario">{s.duracion_base_minutos} min · ${parseFloat(s.precio_base).toLocaleString()}</p></div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-principal mb-1">Personas (1-5)</label>
            <Input type="number" min="1" max="5" value={cantidad} onChange={(e) => setCantidad(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))} />
          </div>
          <Button className="w-full" onClick={handleCrearReserva} disabled={cargando}>{cargando ? <Spinner /> : 'Confirmar reserva'}</Button>
        </div>
      </Modal>

      {/* STEP 4: Confirmar */}
      {paso === 4 && reservaCreada && (
        <div className="text-center max-w-xl mx-auto">
          <Card className="p-8">
            <div className="w-20 h-20 rounded-full bg-exito/10 mx-auto mb-4 flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <h2 className="font-display text-2xl font-bold text-texto-principal mb-2">Reserva confirmada</h2>
            <p className="text-texto-secundario mb-4">{diaSeleccionado?.fecha} — {slotSeleccionado} — {ubicacionSeleccionada?.nombre}</p>
            {reservaCreada.qr_data_url && (
              <div className="mb-4">
                <img src={reservaCreada.qr_data_url} alt="QR" className="w-48 h-48 mx-auto mb-3 border-2 border-borde rounded-xl p-2 bg-white" />
                <Button variant="secundario" size="sm" onClick={descargarQR}>Descargar QR</Button>
              </div>
            )}
            <p className="text-sm font-semibold text-texto-principal mb-4">Como deseas pagar?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPaso(5)} className="bg-exito/5 border-2 border-exito/20 rounded-xl p-4 cursor-pointer hover:border-exito hover:bg-exito/10 transition">
                <p className="text-sm font-semibold text-exito">Online</p><p className="text-xs text-texto-secundario">Tarjeta / Nequi</p>
              </button>
              <button onClick={() => { handlePagoSubmit({ preventDefault: () => {} }); }} className="bg-secundario/5 border-2 border-secundario/20 rounded-xl p-4 cursor-pointer hover:border-secundario hover:bg-secundario/10 transition">
                <p className="text-sm font-semibold text-secundario">Efectivo</p><p className="text-xs text-texto-secundario">Pagar en local</p>
              </button>
            </div>
          </Card>
          <div className="mt-4"><Button variant="secundario" onClick={volverAtras}>Atras</Button></div>
        </div>
      )}

      {/* STEP 5 */}
      {paso === 5 && (
        <div className="max-w-md mx-auto">
          <h2 className="font-display text-xl font-bold text-texto-principal mb-6">Pago online</h2>
          <Card>
            <form onSubmit={handlePagoSubmit} className="space-y-4">
              <Input label="Titular" value={formPago.titular} onChange={(e) => setFormPago({ ...formPago, titular: e.target.value })} placeholder="Juan Perez" />
              <Input label="Numero de tarjeta" value={formPago.numero} onChange={(e) => setFormPago({ ...formPago, numero: e.target.value })} placeholder="4242 4242 4242 4242" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Vencimiento" value={formPago.expiracion} onChange={(e) => setFormPago({ ...formPago, expiracion: e.target.value })} placeholder="MM/AA" />
                <Input label="CVV" value={formPago.cvv} onChange={(e) => setFormPago({ ...formPago, cvv: e.target.value })} placeholder="123" />
              </div>
              <Button type="submit" className="w-full">Pagar</Button>
            </form>
          </Card>
          <div className="mt-4"><Button variant="secundario" onClick={volverAtras}>Atras</Button></div>
        </div>
      )}
    </div>
  );
}
