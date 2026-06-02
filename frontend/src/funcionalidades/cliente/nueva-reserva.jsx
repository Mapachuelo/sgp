import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Modal, Toast, Input, Select, Spinner } from '../../componentes/ui/index.jsx';
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
  return nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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
  const [slots, setSlots] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [modalServicio, setModalServicio] = useState(false);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [preferencias, setPreferencias] = useState(null);

  const [reservaCreada, setReservaCreada] = useState(null);
  const [tipoPago, setTipoPago] = useState('');

  const [formPago, setFormPago] = useState({ titular: '', numero: '', expiracion: '', cvv: '' });
  const [pagoCompletado, setPagoCompletado] = useState(false);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    if (paso === 1) {
      (async () => {
        try {
          setCargando(true);
          const data = await api.ubicaciones.list();
          setUbicaciones(data || []);
        } catch (err) {
          mostrarToast(err.message, 'error');
        } finally {
          setCargando(false);
        }
      })();
    }
  }, [paso]);

  useEffect(() => {
    if (paso === 2 && ubicacionSeleccionada) {
      (async () => {
        try {
          setCargando(true);
          const data = await api.auth.empleados.list();
          setEmpleados(data || []);
        } catch (err) {
          mostrarToast(err.message, 'error');
        } finally {
          setCargando(false);
        }
      })();
    }
  }, [paso, ubicacionSeleccionada]);

  useEffect(() => {
    if (paso === 3 && empleadoSeleccionado) {
      (async () => {
        try {
          setCargando(true);
          const [servs, prefs] = await Promise.all([
            api.reservas.servicios(),
            api.preferencias.get(),
          ]);
          setServicios(servs || []);
          setPreferencias(prefs);
          generarSemana(prefs);
        } catch (err) {
          mostrarToast(err.message, 'error');
        } finally {
          setCargando(false);
        }
      })();
    }
  }, [paso, empleadoSeleccionado]);

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
      const fechaStr = fecha.toISOString().split('T')[0];
      dias.push({
        fecha: fechaStr,
        diaSemana: DIAS_SEMANA[i],
        esHoy: fecha.getTime() === hoy.getTime(),
        esPasado: fecha < hoy,
      });
    }
    setSemana(dias);
    setDiaSeleccionado(null);
    setSlots([]);
  };

  const cargarSlots = async (fecha) => {
    try {
      setCargando(true);
      const data = await api.reservas.disponibilidad({
        empleado_id: empleadoSeleccionado.id,
        ubicacion_id: ubicacionSeleccionada.id,
        fecha,
      });
      setSlots(data || []);
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const handleDiaClick = (dia) => {
    if (dia.esPasado) return;
    setDiaSeleccionado(dia);
    cargarSlots(dia.fecha);
  };

  const handleSlotClick = (slot) => {
    const hora = typeof slot === 'string' ? slot : slot.hora;
    const ahora = new Date();
    const [h, m] = hora.split(':');
    const slotDate = new Date(diaSeleccionado.fecha + 'T00:00:00');
    slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
    const diffMin = (slotDate - ahora) / 60000;
    if (diffMin < 0) return;
    if (diffMin < 60) return;

    setSlotSeleccionado(slot);
    setModalServicio(true);
  };

  const handleCrearReserva = async () => {
    try {
      setCargando(true);
      const hora = slotSeleccionado.hora || slotSeleccionado;
      const data = await api.reservas.create({
        ubicacion_id: ubicacionSeleccionada.id,
        empleado_id: empleadoSeleccionado.id,
        servicio_id: parseInt(servicioSeleccionado),
        fecha: diaSeleccionado.fecha,
        hora: typeof hora === 'string' ? hora : hora?.hora,
        cantidad,
      });
      setReservaCreada(data);
      setModalServicio(false);
      setPaso(4);
      mostrarToast('Reserva creada con exito', 'success');
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const handlePagoSubmit = (e) => {
    e.preventDefault();
    setPagoCompletado(true);
    mostrarToast('Pago procesado con exito', 'success');
  };

  const handleConfirmarEfectivo = () => {
    setPagoCompletado(true);
  };

  const renderPasoBadge = (num) => {
    if (num < paso) return 'success';
    if (num === paso) return 'info';
    return 'default';
  };

  if (pagoCompletado) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Toast open={toast.open} message={toast.message} type={toast.type} />
        <Card className="p-10">
          <div className="text-exito mb-6">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-texto-principal mb-2">
            Reserva confirmada!
          </h2>
          <p className="text-texto-secundario mb-6">
            Tu cita ha sido agendada correctamente.
          </p>
          {reservaCreada?.qr_data_url && (
            <img
              src={reservaCreada.qr_data_url}
              alt="QR"
              className="w-40 h-40 mx-auto mb-6"
            />
          )}
          <Button onClick={() => navigate('/cliente')}>Ir al dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <h1 className="font-display text-3xl font-bold text-texto-principal mb-8">
        Nueva Reserva
      </h1>

      <div className="flex items-center justify-between mb-10 flex-wrap gap-y-2">
        {PASOS.map((p, i) => (
          <div key={p.num} className="flex items-center">
            <div className="flex items-center gap-2">
              <Badge variant={renderPasoBadge(p.num)}>{p.num}</Badge>
              <span
                className={`text-sm font-medium ${
                  p.num <= paso ? 'text-texto-principal' : 'text-texto-secundario'
                }`}
              >
                {p.label}
              </span>
            </div>
            {i < PASOS.length - 1 && (
              <div
                className={`w-8 h-px mx-2 transition-colors ${
                  p.num < paso ? 'bg-exito' : 'bg-borde'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {cargando && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!cargando && paso === 1 && (
        <div>
          <h2 className="font-display text-xl font-semibold text-texto-principal mb-6">
            Selecciona una ubicacion
          </h2>
          {ubicaciones.length === 0 ? (
            <p className="text-texto-secundario">
              No hay ubicaciones disponibles.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {ubicaciones.map((ubic) => (
                <Card
                  key={ubic.id}
                  className={`cursor-pointer transition hover:border-primario p-5 ${
                    ubicacionSeleccionada?.id === ubic.id
                      ? 'border-primario ring-2 ring-primario/20'
                      : ''
                  }`}
                  onClick={() => setUbicacionSeleccionada(ubic)}
                >
                  <h3 className="font-semibold text-texto-principal">{ubic.nombre}</h3>
                  {ubic.direccion && (
                    <p className="text-sm text-texto-secundario mt-1">{ubic.direccion}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
          <div className="mt-8">
            <Button onClick={() => setPaso(2)} disabled={!ubicacionSeleccionada}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {!cargando && paso === 2 && (
        <div>
          <h2 className="font-display text-xl font-semibold text-texto-principal mb-6">
            Selecciona un empleado
          </h2>
          {empleados.length === 0 ? (
            <p className="text-texto-secundario">
              No hay empleados disponibles para esta ubicacion.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {empleados.map((emp) => (
                <Card
                  key={emp.id}
                  className={`cursor-pointer transition hover:border-primario text-center p-5 ${
                    empleadoSeleccionado?.id === emp.id
                      ? 'border-primario ring-2 ring-primario/20'
                      : ''
                  }`}
                  onClick={() => setEmpleadoSeleccionado(emp)}
                >
                  <div className="w-12 h-12 rounded-full bg-primario/10 text-primario flex items-center justify-center mx-auto mb-2 font-semibold text-lg">
                    {obtenerIniciales(emp.nombre)}
                  </div>
                  <p className="text-sm font-medium text-texto-principal">{emp.nombre}</p>
                  {emp.apellido && (
                    <p className="text-xs text-texto-secundario mt-0.5">{emp.apellido}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
          <div className="mt-8 flex gap-3">
            <Button
              variant="secundario"
              onClick={() => {
                setPaso(1);
                setEmpleadoSeleccionado(null);
              }}
            >
              Atras
            </Button>
            <Button onClick={() => setPaso(3)} disabled={!empleadoSeleccionado}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {!cargando && paso === 3 && (
        <div>
          <h2 className="font-display text-xl font-semibold text-texto-principal mb-6">
            Selecciona fecha y hora
          </h2>

          <div className="grid grid-cols-6 gap-2 mb-8">
            {semana.map((dia) => (
              <button
                key={dia.fecha}
                onClick={() => handleDiaClick(dia)}
                disabled={dia.esPasado}
                className={`p-3 rounded-xl text-center text-sm transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border ${
                  diaSeleccionado?.fecha === dia.fecha
                    ? 'bg-primario text-white border-primario'
                    : dia.esHoy
                      ? 'bg-primario/10 text-primario border-primario/30'
                      : 'bg-fondo text-texto-principal border-borde hover:border-primario/40'
                }`}
              >
                <div className="text-xs mb-1">{dia.diaSemana}</div>
                <div className="font-semibold text-lg">{dia.fecha.split('-')[2]}</div>
                <div className="text-xs opacity-70">
                  {['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][
                    parseInt(dia.fecha.split('-')[1])
                  ]}
                </div>
              </button>
            ))}
          </div>

          {diaSeleccionado && (
            <div>
              <h3 className="font-medium text-texto-principal mb-4">
                Horarios disponibles — {diaSeleccionado.fecha}
              </h3>
              {slots.length === 0 ? (
                <p className="text-texto-secundario text-sm">
                  No hay horarios disponibles para esta fecha.
                </p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {slots.map((slot, idx) => {
                    const hora = typeof slot === 'string' ? slot : slot.hora;
                    if (!hora) return null;
                    const ahora = new Date();
                    const [h, m] = hora.split(':');
                    const slotDate = new Date(diaSeleccionado.fecha + 'T00:00:00');
                    slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
                    const diffMin = (slotDate - ahora) / 60000;
                    const esPasado = diffMin < 0;
                    const esAnticipacion = diffMin >= 0 && diffMin < 60;

                    if (esPasado) return null;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSlotClick(slot)}
                        disabled={esAnticipacion}
                        className={`p-2.5 rounded-lg text-sm font-medium transition text-center cursor-pointer border ${
                          esAnticipacion
                            ? 'bg-amber-50 text-advertencia border-amber-200 cursor-not-allowed opacity-70'
                            : 'bg-fondo text-texto-principal border-borde hover:border-primario hover:bg-primario/5'
                        }`}
                      >
                        <span>{hora}</span>
                        {esAnticipacion && (
                          <div className="text-[10px] leading-tight opacity-70 mt-0.5">
                            Muy pronto
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <Button
              variant="secundario"
              onClick={() => {
                setPaso(2);
                setDiaSeleccionado(null);
                setSlots([]);
              }}
            >
              Atras
            </Button>
          </div>

          <Modal
            open={modalServicio}
            onClose={() => setModalServicio(false)}
            title="Seleccionar servicio"
          >
            <div className="space-y-4">
              <Select
                label="Servicio"
                options={servicios.map((s) => ({ value: String(s.id), label: s.nombre }))}
                value={servicioSeleccionado}
                onChange={(e) => setServicioSeleccionado(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-texto-principal mb-1">
                  Cantidad
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                    className="w-9 h-9 rounded-lg border border-borde flex items-center justify-center hover:bg-fondo transition font-medium text-texto-principal cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-semibold text-texto-principal">
                    {cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCantidad(Math.min(5, cantidad + 1))}
                    className="w-9 h-9 rounded-lg border border-borde flex items-center justify-center hover:bg-fondo transition font-medium text-texto-principal cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <Button
                onClick={handleCrearReserva}
                disabled={!servicioSeleccionado || cargando}
                className="w-full"
              >
                {cargando ? 'Creando...' : 'Confirmar reserva'}
              </Button>
            </div>
          </Modal>
        </div>
      )}

      {paso === 4 && reservaCreada && (
        <div>
          <h2 className="font-display text-xl font-semibold text-texto-principal mb-6">
            Confirmar reserva
          </h2>

          <Card className="mb-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-texto-secundario text-sm">Ubicacion</span>
                <span className="text-texto-principal font-medium">
                  {ubicacionSeleccionada?.nombre}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-texto-secundario text-sm">Empleado</span>
                <span className="text-texto-principal font-medium">
                  {empleadoSeleccionado?.nombre}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-texto-secundario text-sm">Servicio</span>
                <span className="text-texto-principal font-medium">
                  {servicios.find((s) => s.id === parseInt(servicioSeleccionado))?.nombre ||
                    'Seleccionado'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-texto-secundario text-sm">Fecha</span>
                <span className="text-texto-principal font-medium">{diaSeleccionado?.fecha}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-texto-secundario text-sm">Hora</span>
                <span className="text-texto-principal font-medium">
                  {typeof slotSeleccionado === 'string'
                    ? slotSeleccionado
                    : slotSeleccionado?.hora || slotSeleccionado}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-texto-secundario text-sm">Cantidad</span>
                <span className="text-texto-principal font-medium">{cantidad}</span>
              </div>
            </div>
          </Card>

          {reservaCreada?.qr_data_url && (
            <div className="text-center mb-6">
              <p className="text-xs text-texto-secundario mb-2">Codigo QR de tu reserva</p>
              <img
                src={reservaCreada.qr_data_url}
                alt="QR"
                className="w-36 h-36 mx-auto rounded-lg border border-borde"
              />
            </div>
          )}

          <h3 className="font-semibold text-texto-principal mb-3">Metodo de pago</h3>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card
              className={`cursor-pointer text-center p-4 transition ${
                tipoPago === 'online'
                  ? 'border-primario ring-2 ring-primario/20'
                  : 'hover:border-primario/40'
              }`}
              onClick={() => setTipoPago('online')}
            >
              <svg
                className="w-8 h-8 mx-auto mb-2 text-texto-secundario"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <p className="font-medium text-texto-principal text-sm">Pago en linea</p>
            </Card>
            <Card
              className={`cursor-pointer text-center p-4 transition ${
                tipoPago === 'efectivo'
                  ? 'border-primario ring-2 ring-primario/20'
                  : 'hover:border-primario/40'
              }`}
              onClick={() => setTipoPago('efectivo')}
            >
              <svg
                className="w-8 h-8 mx-auto mb-2 text-texto-secundario"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="9" />
                <text
                  x="12"
                  y="16"
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  stroke="none"
                  fontWeight="bold"
                >
                  $
                </text>
              </svg>
              <p className="font-medium text-texto-principal text-sm">Pago en efectivo</p>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button variant="secundario" onClick={() => setPaso(3)}>
              Atras
            </Button>
            {tipoPago === 'online' && (
              <Button onClick={() => setPaso(5)}>Continuar al pago</Button>
            )}
            {tipoPago === 'efectivo' && (
              <Button variant="exito" onClick={handleConfirmarEfectivo}>
                Confirmar reserva
              </Button>
            )}
          </div>
        </div>
      )}

      {paso === 5 && (
        <div>
          <h2 className="font-display text-xl font-semibold text-texto-principal mb-6">
            Pago en linea
          </h2>
          <Card>
            <form onSubmit={handlePagoSubmit} className="space-y-4">
              <Input
                label="Titular de la tarjeta"
                value={formPago.titular}
                onChange={(e) => setFormPago({ ...formPago, titular: e.target.value })}
                required
                placeholder="Nombre como aparece en la tarjeta"
              />
              <Input
                label="Numero de tarjeta"
                value={formPago.numero}
                onChange={(e) => setFormPago({ ...formPago, numero: e.target.value })}
                required
                placeholder="0000 0000 0000 0000"
                maxLength={19}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Expiracion (MM/AA)"
                  value={formPago.expiracion}
                  onChange={(e) => setFormPago({ ...formPago, expiracion: e.target.value })}
                  required
                  placeholder="MM/AA"
                  maxLength={5}
                />
                <Input
                  label="CVV"
                  value={formPago.cvv}
                  onChange={(e) => setFormPago({ ...formPago, cvv: e.target.value })}
                  required
                  placeholder="123"
                  maxLength={3}
                  type="password"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secundario" onClick={() => setPaso(4)}>
                  Atras
                </Button>
                <Button type="submit">Pagar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
