import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ImageOff, Scissors, Search } from 'lucide-react';
import api from '../../api/cliente';
import { Badge, Button, Card, Input, PageHeader, Select, Spinner, Toast } from '../../componentes/ui/index.jsx';
import DetalleServicioModal from '../../componentes/servicios/detalle-servicio-modal.jsx';

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function MisServicios() {
  const [servicios, setServicios] = useState([]);
  const [asignados, setAsignados] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [catalogo, propios] = await Promise.all([
        api.reservas.servicios(),
        api.reservas.empleadoTiempos.get(''),
      ]);
      setServicios(Array.isArray(catalogo) ? catalogo.filter((servicio) => servicio.activo !== false) : []);
      const mapa = {};
      (Array.isArray(propios) ? propios : []).forEach((item) => {
        mapa[item.servicio_id] = Number(item.duracion_minutos) || 30;
      });
      setAsignados(mapa);
    } catch (error) {
      mostrarToast(error.message || 'Error al cargar los servicios', 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const categorias = useMemo(() => {
    const mapa = new Map();
    servicios.forEach((servicio) => {
      if (servicio.categoria_id && !mapa.has(servicio.categoria_id)) {
        mapa.set(servicio.categoria_id, servicio.categoria_nombre || 'Sin categoría');
      }
    });
    return [...mapa.entries()].map(([id, nombre]) => ({ value: String(id), label: nombre }));
  }, [servicios]);

  const filtrados = useMemo(() => {
    const termino = normalizar(busqueda);
    return servicios.filter((servicio) => {
      if (categoria && String(servicio.categoria_id) !== categoria) return false;
      if (!termino) return true;
      return normalizar(`${servicio.nombre} ${servicio.categoria_nombre || ''} ${servicio.descripcion || ''}`).includes(termino);
    });
  }, [servicios, busqueda, categoria]);

  const guardar = async (siguiente = asignados) => {
    const items = Object.entries(siguiente).map(([servicioId, duracion]) => ({
      servicio_id: Number(servicioId),
      duracion_minutos: Number(duracion),
    }));
    setGuardando(true);
    try {
      await api.reservas.empleadoServiciosUpdate(items);
    } catch (error) {
      mostrarToast(error.message || 'No se pudo guardar', 'error');
      throw error;
    } finally {
      setGuardando(false);
    }
  };

  const alternar = async (servicio) => {
    const activo = Object.prototype.hasOwnProperty.call(asignados, servicio.id);
    const siguiente = { ...asignados };
    if (activo) {
      delete siguiente[servicio.id];
    } else {
      siguiente[servicio.id] = Number(servicio.duracion_base_minutos) || 30;
    }
    setAsignados(siguiente);
    try {
      await guardar(siguiente);
      mostrarToast(activo ? 'Servicio retirado de tu perfil' : 'Servicio agregado a tu perfil');
    } catch {
      setAsignados(asignados);
    }
  };

  const cambiarDuracion = (servicioId, valor) => {
    const anterior = asignados[servicioId];
    const duracion = Number(valor);
    if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
      mostrarToast('La duración debe estar entre 5 y 480 minutos', 'warning');
      return;
    }
    setAsignados((prev) => ({ ...prev, [servicioId]: duracion }));
    guardar({ ...asignados, [servicioId]: duracion })
      .then(() => mostrarToast('Duración actualizada'))
      .catch(() => setAsignados((prev) => ({ ...prev, [servicioId]: anterior })));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Toast open={toast.open} message={toast.message} type={toast.type} />
      <PageHeader
        title="Mis servicios"
        subtitle="Elige los servicios que realizas. El precio lo define la administración; tú ajustas la duración."
      />

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" aria-hidden="true" />
            <Input
              placeholder="Buscar servicio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar servicio"
              className="pl-9"
            />
          </div>
          <Select
            label="Categoría"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            options={[{ value: '', label: 'Todas las categorías' }, ...categorias]}
          />
        </div>
        <p className="mt-3 text-[11px] leading-5 text-tenue">
          {Object.keys(asignados).length} servicio(s) activos. El precio no se puede modificar desde aquí.
        </p>
      </Card>

      {cargando ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtrados.length === 0 ? (
        <Card className="py-12 text-center text-sm text-texto-secundario">No hay servicios para los filtros seleccionados.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((servicio) => {
            const activo = Object.prototype.hasOwnProperty.call(asignados, servicio.id);
            return (
              <Card key={servicio.id} className={`flex flex-col gap-3 ${activo ? 'border-acento/40' : ''}`}>
                <button
                  type="button"
                  onClick={() => setDetalle(servicio)}
                  aria-label={`Ver detalle de ${servicio.nombre}`}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className="relative block shrink-0">
                    {servicio.imagen_url ? (
                      <img
                        src={servicio.imagen_url}
                        alt={servicio.nombre}
                        className="h-16 w-16 rounded-md border border-borde object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-md border border-borde bg-panel text-tenue">
                        <ImageOff className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                    {Number(servicio.total_imagenes) > 1 && (
                      <Badge variant="accent" className="absolute -bottom-1 -right-1">{servicio.total_imagenes} fotos</Badge>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-tenue">{servicio.categoria_nombre || 'Sin categoría'}</span>
                    <span className="mt-0.5 block text-sm font-medium leading-5 text-texto-principal">{servicio.nombre}</span>
                    <span className="num mt-1 block text-xs font-semibold text-texto-principal">{dinero(servicio.precio_base)}</span>
                    <span className="mt-0.5 block text-[10px] text-texto-secundario">Base: {servicio.duracion_base_minutos || 30} min</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-acento">
                      Ver detalle <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </span>
                </button>

                <div className="mt-auto flex items-end gap-2 border-t border-borde pt-3">
                  {activo && (
                    <div className="w-28">
                      <Input
                        label="Duración"
                        type="number"
                        min="5"
                        max="480"
                        step="5"
                        value={asignados[servicio.id]}
                        onChange={(e) => setAsignados((prev) => ({ ...prev, [servicio.id]: e.target.value }))}
                        onBlur={(e) => cambiarDuracion(servicio.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant={activo ? 'secundario' : 'primario'}
                    className="flex-1"
                    onClick={() => alternar(servicio)}
                    disabled={guardando}
                  >
                    <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                    {activo ? 'Quitar de mis servicios' : 'Agregar a mis servicios'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <DetalleServicioModal
        abierto={Boolean(detalle)}
        servicio={detalle}
        onClose={() => setDetalle(null)}
        duracionAsignada={detalle ? asignados[detalle.id] : null}
        nota="El precio lo define la administración. Tú solo puedes ajustar la duración desde la tarjeta del servicio."
      />
    </div>
  );
}
