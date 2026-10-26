import { useEffect, useRef, useState } from 'react';
import { Button, Modal, Spinner } from '../ui/index.jsx';
import api from '../../api/cliente.js';
import { abrirWidgetWompi, cargarScriptWompi } from '../../lib/wompi.js';

function TarjetaMedio({ children }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-borde bg-superficie px-2 py-1.5 text-[10px] font-semibold text-texto-principal">
      {children}
    </span>
  );
}

export default function PagoReservaModal({
  open,
  onClose,
  reservaId,
  modo = 'cliente',
  onPagado,
  onToast,
}) {
  const [intencion, setIntencion] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState('inicial');
  const [mensaje, setMensaje] = useState('');
  const [transaccionManual, setTransaccionManual] = useState('');
  const pollRef = useRef(null);
  const pagadoRef = useRef(false);

  const mostrarToast = (texto, tipo = 'success') => onToast?.(texto, tipo);

  const limpiarPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const aplicarPago = (pago) => {
    if (!pago) return;
    if (pago.estado === 'aprobado') {
      limpiarPoll();
      setEstado('aprobado');
      setMensaje('Pago aprobado. Ya puedes continuar.');
      if (!pagadoRef.current) {
        pagadoRef.current = true;
        mostrarToast('Pago aprobado correctamente');
        onPagado?.(pago);
      }
    } else if (pago.estado === 'declinado' || pago.estado === 'error') {
      setEstado(pago.estado);
      setMensaje(
        pago.estado === 'declinado'
          ? 'El pago fue rechazado. Puedes intentar con otro medio.'
          : 'Ocurrio un error procesando el pago.'
      );
    } else {
      setEstado('pendiente');
      setMensaje('Esperando confirmacion de Wompi...');
    }
  };

  const consultarEstado = async () => {
    if (!intencion?.pago_id) return;
    try {
      const pago = await api.pagos.estado(intencion.pago_id);
      aplicarPago(pago);
    } catch (err) {
      setMensaje(err.message);
    }
  };

  const verificarPago = async (transactionId) => {
    if (!intencion?.pago_id || !transactionId) return;
    try {
      setCargando(true);
      const pago = await api.pagos.verificar(intencion.pago_id, transactionId.trim());
      aplicarPago(pago);
    } catch (err) {
      setEstado('error');
      setMensaje(err.message);
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const generarIntencion = async () => {
    if (!reservaId) return null;
    setCargando(true);
    setEstado('inicial');
    setMensaje('');
    pagadoRef.current = false;
    try {
      const datos = await api.pagos.intencion(reservaId);
      setIntencion(datos);
      setEstado(modo === 'qr' ? 'esperando' : 'lista');
      return datos;
    } catch (err) {
      setEstado('error');
      setMensaje(err.message);
      mostrarToast(err.message, 'error');
      return null;
    } finally {
      setCargando(false);
    }
  };

  const pagarConWidget = async () => {
    const datos = intencion || (await generarIntencion());
    if (!datos) return;
    try {
      setEstado('esperando');
      setMensaje('Completa el pago en la ventana segura de Wompi.');
      await cargarScriptWompi();
      abrirWidgetWompi({
        intencion: datos,
        onResultado: async (resultado) => {
          const transaccion = resultado?.transaction;
          if (transaccion?.id) {
            await verificarPago(transaccion.id);
          } else {
            await consultarEstado();
          }
        },
      });
    } catch (err) {
      setEstado('error');
      setMensaje(err.message);
      mostrarToast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (!open) {
      limpiarPoll();
      setIntencion(null);
      setEstado('inicial');
      setMensaje('');
      setTransaccionManual('');
      pagadoRef.current = false;
      return undefined;
    }
    if (modo === 'qr' && reservaId) {
      generarIntencion();
    }
    return () => limpiarPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservaId, modo]);

  useEffect(() => {
    if (!open || !intencion?.pago_id || estado !== 'esperando') return undefined;
    limpiarPoll();
    pollRef.current = setInterval(() => {
      api.pagos.estado(intencion.pago_id).then(aplicarPago).catch(() => {});
    }, 3000);
    return () => limpiarPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, intencion?.pago_id, estado]);

  const cerrar = () => {
    limpiarPoll();
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={modo === 'qr' ? 'Pago con QR' : 'Pagar en linea'}
    >
      <div className="space-y-4">
        {estado === 'aprobado' ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center text-exito">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-semibold text-exito text-lg">Pago aprobado</p>
            <p className="text-xs text-texto-secundario">
              {intencion?.monto ? `$${Number(intencion.monto).toLocaleString('es-CO')}` : ''}{' '}
              {intencion?.referencia ? `· ${intencion.referencia}` : ''}
            </p>
            <Button className="w-full" onClick={cerrar}>Continuar</Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-borde bg-fondo/40 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-texto-secundario mb-2">
                Medios de pago
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <TarjetaMedio>Tarjeta credito/debito</TarjetaMedio>
                <TarjetaMedio>PSE</TarjetaMedio>
                <TarjetaMedio>Nequi</TarjetaMedio>
                <TarjetaMedio>Boton Bancolombia</TarjetaMedio>
              </div>
            </div>

            {intencion && (
              <p className="text-xs text-texto-secundario">
                Total a pagar:{' '}
                <strong className="text-texto-principal">
                  ${Number(intencion.monto).toLocaleString('es-CO')}
                </strong>
                <span className="block mt-1 font-mono text-[10px]">{intencion.referencia}</span>
              </p>
            )}

            {modo === 'qr' && intencion?.qr_data_url && (
              <div className="text-center space-y-2">
                <div className="inline-block bg-white border border-borde rounded-2xl p-3">
                  <img src={intencion.qr_data_url} alt="QR de pago Wompi" className="w-52 h-52" />
                </div>
                <p className="text-xs text-texto-secundario">
                  Pide al cliente escanear este QR con la camara de su celular.
                </p>
              </div>
            )}

            {mensaje && (
              <p
                className={`text-xs font-medium ${
                  estado === 'declinado' || estado === 'error' ? 'text-error' : 'text-advertencia'
                }`}
              >
                {mensaje}
              </p>
            )}

            {modo !== 'qr' && (
              <Button
                className="w-full"
                onClick={pagarConWidget}
                disabled={cargando || estado === 'esperando'}
              >
                {cargando ? <Spinner /> : 'Abrir checkout de Wompi'}
              </Button>
            )}

            {(estado === 'esperando' || estado === 'pendiente' || estado === 'declinado' || estado === 'error') && (
              <div className="space-y-2 rounded-xl border border-borde bg-fondo/30 p-3">
                <label className="block text-[10px] font-semibold text-texto-principal uppercase">
                  Numero de transaccion (opcional)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={transaccionManual}
                    onChange={(e) => setTransaccionManual(e.target.value)}
                    placeholder="01-1531231271-19365"
                    className="w-full px-3 py-2 border border-borde rounded-lg text-xs bg-superficie focus:outline-none"
                  />
                  <Button
                    variant="outline"
                    onClick={() => verificarPago(transaccionManual)}
                    disabled={!transaccionManual.trim() || cargando}
                  >
                    Verificar
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={consultarEstado}
                  className="text-[11px] text-primario hover:underline cursor-pointer"
                >
                  Actualizar estado
                </button>
              </div>
            )}

            {modo === 'qr' && estado !== 'aprobado' && (
              <Button variant="outline" className="w-full" onClick={consultarEstado}>
                Ya pague, verificar estado
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
