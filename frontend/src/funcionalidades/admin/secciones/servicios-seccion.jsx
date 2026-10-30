import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock, ImageOff, Layers, Pencil, Plus, Scissors, Settings, Trash2, Upload, X } from 'lucide-react';
import {
  Badge,
  BuscadorSelect,
  Button,
  Card,
  ConfirmDialog,
  Input,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Textarea,
} from '../../../componentes/ui/index.jsx';
import { avisarAdmin } from './avisos.js';
import api from '../../../api/cliente.js';
import { comprimirImagen } from '../../../lib/imagen.js';

const MAX_IMAGENES = 6;

const FORM_INICIAL = {
  nombre: '',
  descripcion: '',
  precio: '',
  duracion: 30,
  categoria_id: '',
  imagenes: [],
  activo: true,
};

const CATEGORIA_INICIAL = {
  nombre: '',
  descripcion: '',
  orden: '',
};

function dinero(valor) {
  return `$${Number(valor || 0).toLocaleString('es-CO')}`;
}

function ImagenServicio({ src, nombre, tamano = 'sm' }) {
  const clase = tamano === 'lg' ? 'h-24 w-24' : 'h-10 w-10';
  if (!src) {
    return (
      <span className={`${clase} flex shrink-0 items-center justify-center rounded border border-borde bg-panel text-tenue`}>
        <ImageOff className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={nombre ? `Imagen de ${nombre}` : 'Imagen del servicio'}
      loading="lazy"
      className={`${clase} shrink-0 rounded border border-borde object-cover`}
    />
  );
}

export default function ServiciosSeccion() {
  const [servicios, setServicios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [configuracion, setConfiguracion] = useState({ max_servicios_reserva: 5 });
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('catalogo');

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [editId, setEditId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [cargandoImagenes, setCargandoImagenes] = useState(false);
  const [errorImagenes, setErrorImagenes] = useState(false);
  const inputImagenRef = useRef(null);
  const edicionRef = useRef(null);

  const [categoriaForm, setCategoriaForm] = useState(CATEGORIA_INICIAL);
  const [editCategoriaId, setEditCategoriaId] = useState(null);
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

  const [empleadoId, setEmpleadoId] = useState('');
  const [tiempos, setTiempos] = useState([]);
  const [cargandoTiempos, setCargandoTiempos] = useState(false);
  const [servicioAgregar, setServicioAgregar] = useState('');
  const [duracionAgregar, setDuracionAgregar] = useState(30);
  const [guardandoTiempos, setGuardandoTiempos] = useState(false);

  const [maxServicios, setMaxServicios] = useState('5');
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const [eliminar, setEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [servs, cats, emps, cfg] = await Promise.all([
        api.reservas.servicios({ incluir_inactivos: 1 }),
        api.reservas.categorias(),
        api.auth.empleados.list({ rol: 'empleado' }),
        api.reservas.configuracion().catch(() => ({ max_servicios_reserva: 5 })),
      ]);
      setServicios(Array.isArray(servs) ? servs : []);
      setCategorias(Array.isArray(cats) ? cats : []);
      setEmpleados(Array.isArray(emps) ? emps : []);
      setConfiguracion(cfg || { max_servicios_reserva: 5 });
      setMaxServicios(String(cfg?.max_servicios_reserva || 5));
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const categoriasPorId = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria])),
    [categorias]
  );

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return servicios.filter((servicio) => {
      const coincideTexto =
        !termino ||
        `${servicio.nombre} ${servicio.descripcion || ''} ${servicio.categoria_nombre || ''}`
          .toLowerCase()
          .includes(termino);
      const coincideCategoria =
        !filtroCategoria || String(servicio.categoria_id) === String(filtroCategoria);
      return coincideTexto && coincideCategoria;
    });
  }, [servicios, busqueda, filtroCategoria]);

  const opcionesCategoria = useMemo(
    () => categorias.map((categoria) => ({
      value: String(categoria.id),
      label: categoria.nombre,
      description: `${categoria.total_servicios || 0} servicio(s) · orden ${categoria.orden}`,
    })),
    [categorias]
  );

  const opcionesEmpleado = useMemo(
    () => empleados.map((empleado) => ({
      value: String(empleado.id),
      label: `${empleado.nombre} ${empleado.apellido || ''}`,
      description: empleado.email,
      search: empleado.email,
    })),
    [empleados]
  );

  const serviciosDisponiblesTiempos = useMemo(
    () => servicios
      .filter((servicio) => servicio.activo)
      .filter((servicio) => !tiempos.some((tiempo) => tiempo.servicio_id === servicio.id))
      .map((servicio) => ({
        value: String(servicio.id),
        label: servicio.nombre,
        description: servicio.categoria_nombre || 'Sin categoría',
      })),
    [servicios, tiempos]
  );

  const resetForm = () => {
    edicionRef.current = null;
    setForm(FORM_INICIAL);
    setEditId(null);
    setMostrarForm(false);
    setCargandoImagenes(false);
    setErrorImagenes(false);
    if (inputImagenRef.current) inputImagenRef.current.value = '';
  };

  const abrirNuevo = () => {
    edicionRef.current = null;
    setErrorImagenes(false);
    setEditId(null);
    setForm({
      ...FORM_INICIAL,
      categoria_id: filtroCategoria || (categorias[0] ? String(categorias[0].id) : ''),
    });
    setMostrarForm(true);
  };

  const abrirEditar = async (servicio) => {
    edicionRef.current = servicio.id;
    setErrorImagenes(false);
    setEditId(servicio.id);
    setMostrarForm(true);
    setForm({
      nombre: servicio.nombre || '',
      descripcion: servicio.descripcion || '',
      precio: servicio.precio_base ?? '',
      duracion: servicio.duracion_base_minutos || 30,
      categoria_id: servicio.categoria_id ? String(servicio.categoria_id) : '',
      imagenes: servicio.imagen_url ? [servicio.imagen_url] : [],
      activo: servicio.activo !== false,
    });
    setCargandoImagenes(true);
    try {
      const galeria = await api.reservas.imagenesServicio(servicio.id);
      if (edicionRef.current !== servicio.id) return;
      const urls = (Array.isArray(galeria) ? galeria : [])
        .sort((a, b) => Number(a.orden) - Number(b.orden))
        .map((imagen) => imagen.imagen_url)
        .filter(Boolean);
      if (urls.length > 0) {
        setForm((prev) => ({ ...prev, imagenes: urls }));
      }
    } catch (error) {
      if (edicionRef.current === servicio.id) {
        setErrorImagenes(true);
        avisarAdmin(error.message, 'error');
      }
    } finally {
      if (edicionRef.current === servicio.id) setCargandoImagenes(false);
    }
  };

  const guardar = async () => {
    if (cargandoImagenes) return avisarAdmin('Espera a que carguen las imágenes del servicio', 'warning');
    if (errorImagenes) return avisarAdmin('No se pudieron cargar las imágenes; cierra y vuelve a editar', 'warning');
    if (!form.nombre.trim()) return avisarAdmin('El nombre es obligatorio', 'warning');
    if (!form.categoria_id) return avisarAdmin('Elige una categoría', 'warning');
    if (!form.precio || Number(form.precio) < 0) return avisarAdmin('El precio es obligatorio', 'warning');
    if (!form.duracion || Number(form.duracion) < 5) return avisarAdmin('La duración mínima es 5 minutos', 'warning');
    setGuardando(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion,
        precio_base: Number(form.precio),
        duracion_base_minutos: Number(form.duracion),
        categoria_id: Number(form.categoria_id),
        imagenes: form.imagenes,
        activo: Boolean(form.activo),
      };
      if (editId) await api.reservas.updateServicio(editId, body);
      else await api.reservas.createServicio(body);
      avisarAdmin(editId ? 'Servicio actualizado' : 'Servicio creado');
      resetForm();
      await cargar();
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const subirImagenes = async (evento) => {
    const archivos = [...(evento.target.files || [])];
    if (archivos.length === 0) return;
    const disponibles = MAX_IMAGENES - form.imagenes.length;
    if (disponibles <= 0) {
      avisarAdmin(`Puedes subir hasta ${MAX_IMAGENES} imágenes por servicio`, 'warning');
      evento.target.value = '';
      return;
    }
    if (archivos.length > disponibles) {
      avisarAdmin(`Solo caben ${disponibles} imagen(es) más`, 'warning');
    }
    setSubiendoImagen(true);
    try {
      const nuevas = [];
      for (const archivo of archivos.slice(0, disponibles)) {
        nuevas.push(await comprimirImagen(archivo));
      }
      setForm((prev) => ({ ...prev, imagenes: [...prev.imagenes, ...nuevas].slice(0, MAX_IMAGENES) }));
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      if (inputImagenRef.current) inputImagenRef.current.value = '';
      setSubiendoImagen(false);
    }
  };

  const quitarImagen = (indice) => {
    setForm((prev) => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, posicion) => posicion !== indice),
    }));
  };

  const moverImagen = (indice, direccion) => {
    setForm((prev) => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= prev.imagenes.length) return prev;
      const imagenes = [...prev.imagenes];
      [imagenes[indice], imagenes[destino]] = [imagenes[destino], imagenes[indice]];
      return { ...prev, imagenes };
    });
  };

  const hacerPortada = (indice) => {
    setForm((prev) => {
      if (indice <= 0 || indice >= prev.imagenes.length) return prev;
      const imagenes = [...prev.imagenes];
      const [portada] = imagenes.splice(indice, 1);
      return { ...prev, imagenes: [portada, ...imagenes] };
    });
  };

  const guardarCategoria = async () => {
    if (!categoriaForm.nombre.trim()) return avisarAdmin('El nombre de la categoría es obligatorio', 'warning');
    setGuardandoCategoria(true);
    try {
      const body = {
        nombre: categoriaForm.nombre.trim(),
        descripcion: categoriaForm.descripcion,
        ...(categoriaForm.orden !== '' ? { orden: Number(categoriaForm.orden) } : {}),
      };
      if (editCategoriaId) await api.reservas.updateCategoria(editCategoriaId, body);
      else await api.reservas.createCategoria(body);
      avisarAdmin(editCategoriaId ? 'Categoría actualizada' : 'Categoría creada');
      setCategoriaForm(CATEGORIA_INICIAL);
      setEditCategoriaId(null);
      await cargar();
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setGuardandoCategoria(false);
    }
  };

  const editarCategoria = (categoria) => {
    setEditCategoriaId(categoria.id);
    setCategoriaForm({
      nombre: categoria.nombre || '',
      descripcion: categoria.descripcion || '',
      orden: categoria.orden ?? '',
    });
  };

  const cargarTiempos = async (id) => {
    setEmpleadoId(id);
    if (!id) {
      setTiempos([]);
      return;
    }
    setCargandoTiempos(true);
    try {
      const data = await api.reservas.empleadoTiempos.get(id);
      setTiempos(
        (data || []).map((tiempo) => ({
          servicio_id: tiempo.servicio_id,
          servicio_nombre: tiempo.servicio_nombre,
          duracion_minutos: tiempo.duracion_minutos || 30,
        }))
      );
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setCargandoTiempos(false);
    }
  };

  const guardarTiempos = async () => {
    if (!empleadoId) return;
    setGuardandoTiempos(true);
    try {
      const items = tiempos.map((tiempo) => ({
        servicio_id: tiempo.servicio_id,
        duracion_minutos: Number(tiempo.duracion_minutos) || 30,
      }));
      await api.reservas.empleadoTiempos.update({ empleado_id: Number(empleadoId), items });
      avisarAdmin('Tiempos de servicio actualizados');
      await cargarTiempos(empleadoId);
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setGuardandoTiempos(false);
    }
  };

  const guardarConfiguracion = async () => {
    setGuardandoConfig(true);
    try {
      const data = await api.reservas.updateConfiguracion({ max_servicios_reserva: Number(maxServicios) });
      setConfiguracion(data);
      setMaxServicios(String(data.max_servicios_reserva));
      avisarAdmin('Límite de servicios actualizado');
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setGuardandoConfig(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!eliminar) return;
    setEliminando(true);
    try {
      if (eliminar.tipo === 'servicio') {
        const resultado = await api.reservas.deleteServicio(eliminar.item.id);
        avisarAdmin(resultado?.desactivado ? 'El servicio tenía reservas: quedó desactivado' : 'Servicio eliminado');
      } else {
        await api.reservas.deleteCategoria(eliminar.item.id);
        avisarAdmin('Categoría eliminada');
      }
      setEliminar(null);
      await cargar();
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setEliminando(false);
    }
  };

  const tabs = [
    { value: 'catalogo', label: 'Catálogo', count: servicios.length },
    { value: 'categorias', label: 'Categorías', count: categorias.length },
    { value: 'duraciones', label: 'Duraciones' },
    { value: 'configuracion', label: 'Configuración' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Servicios"
        subtitle="Catálogo, categorías, duraciones y configuración de reservas."
      />
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs items={tabs} value={tab} onChange={setTab} label="Secciones de servicios" />
          {tab === 'catalogo' && (
            <Button variant="primario" onClick={abrirNuevo}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo servicio
            </Button>
          )}
        </div>

        {cargando ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : tab === 'catalogo' ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                label="Buscar servicio"
                placeholder="Nombre, descripción o categoría..."
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                wrapperClassName="flex-1"
              />
              <Select
                label="Categoría"
                value={filtroCategoria}
                onChange={(evento) => setFiltroCategoria(evento.target.value)}
                options={[
                  { value: '', label: 'Todas las categorías' },
                  ...categorias.map((categoria) => ({ value: String(categoria.id), label: categoria.nombre })),
                ]}
                wrapperClassName="sm:w-56"
              />
            </div>

            {mostrarForm && (
              <Card>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-texto-principal">
                      <Scissors className="h-4 w-4 text-acento" strokeWidth={1.7} aria-hidden="true" />
                      {editId ? 'Editar servicio' : 'Nuevo servicio'}
                    </h3>
                    <p className="mt-0.5 text-xs text-texto-secundario">
                      El precio y la duración se guardan como referencia para las próximas reservas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    aria-label="Cerrar formulario"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-tenue hover:bg-panel hover:text-texto-principal"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Nombre"
                    value={form.nombre}
                    onChange={(evento) => setForm((prev) => ({ ...prev, nombre: evento.target.value }))}
                    placeholder="Ej. Corte clásico"
                  />
                  <BuscadorSelect
                    label="Categoría"
                    value={form.categoria_id}
                    onChange={(valor) => setForm((prev) => ({ ...prev, categoria_id: valor }))}
                    options={opcionesCategoria}
                    placeholder="Elige una categoría"
                  />
                  <Input
                    label="Precio base (COP)"
                    type="number"
                    min="0"
                    value={form.precio}
                    onChange={(evento) => setForm((prev) => ({ ...prev, precio: evento.target.value }))}
                  />
                  <Input
                    label="Duración base (min)"
                    type="number"
                    min="5"
                    max="480"
                    value={form.duracion}
                    onChange={(evento) => setForm((prev) => ({ ...prev, duracion: evento.target.value }))}
                  />
                  <Textarea
                    label="Descripción"
                    value={form.descripcion}
                    onChange={(evento) => setForm((prev) => ({ ...prev, descripcion: evento.target.value }))}
                    wrapperClassName="sm:col-span-2"
                    placeholder="Describe el servicio para el cliente"
                  />

                  <div className="sm:col-span-2">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="block text-xs font-medium text-texto-principal">Imágenes de referencia</span>
                      <span className="num text-[11px] text-tenue">{form.imagenes.length}/{MAX_IMAGENES}</span>
                    </div>
                    <div className="rounded-md border border-borde bg-panel/40 p-3">
                      {cargandoImagenes ? (
                        <div className="flex justify-center py-6"><Spinner /></div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                          {form.imagenes.map((imagen, indice) => (
                            <div key={`${indice}-${imagen.slice(-18)}`} className="group relative overflow-hidden rounded-md border border-borde bg-superficie">
                              <img
                                src={imagen}
                                alt={`Imagen ${indice + 1} de ${form.nombre || 'servicio'}`}
                                className="aspect-[4/3] w-full object-cover"
                              />
                              {indice === 0 && (
                                <Badge variant="accent" className="absolute left-1.5 top-1.5">Portada</Badge>
                              )}
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-superficie p-1">
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moverImagen(indice, -1)}
                                    disabled={indice === 0}
                                    aria-label={`Mover imagen ${indice + 1} a la izquierda`}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-borde text-texto-secundario hover:bg-panel disabled:opacity-35"
                                  >
                                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moverImagen(indice, 1)}
                                    disabled={indice === form.imagenes.length - 1}
                                    aria-label={`Mover imagen ${indice + 1} a la derecha`}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-borde text-texto-secundario hover:bg-panel disabled:opacity-35"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                                <div className="flex gap-1">
                                  {indice > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => hacerPortada(indice)}
                                      className="h-7 rounded border border-borde px-1.5 text-[10px] font-medium text-texto-secundario hover:bg-panel"
                                    >
                                      Portada
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => quitarImagen(indice)}
                                    aria-label={`Quitar imagen ${indice + 1}`}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-error/30 text-error hover:bg-error/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {form.imagenes.length < MAX_IMAGENES && (
                            <button
                              type="button"
                              onClick={() => inputImagenRef.current?.click()}
                              disabled={subiendoImagen}
                              className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-control bg-superficie px-3 text-center text-[11px] font-medium text-texto-secundario transition-colors hover:border-acento hover:text-acento disabled:opacity-50"
                            >
                              {subiendoImagen ? <Spinner /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                              {subiendoImagen ? 'Comprimiendo...' : 'Agregar imágenes'}
                            </button>
                          )}
                        </div>
                      )}
                      <input
                        ref={inputImagenRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={subirImagenes}
                        className="sr-only"
                        id="imagenes-servicio"
                      />
                      {errorImagenes && (
                        <p className="mt-2 text-[11px] leading-4 text-error">
                          No se pudieron cargar las imágenes guardadas. Cierra el formulario y vuelve a intentarlo.
                        </p>
                      )}
                      <p className="mt-2 text-[11px] leading-4 text-tenue">
                        JPG, PNG o WebP. Máximo {MAX_IMAGENES} imágenes; la primera es la portada. Se comprimen automáticamente.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-texto-principal sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(evento) => setForm((prev) => ({ ...prev, activo: evento.target.checked }))}
                      className="h-4 w-4 rounded border-borde text-primario"
                    />
                    Servicio activo para nuevas reservas
                  </label>
                </div>

                <div className="sticky bottom-0 z-20 mt-5 flex gap-2 border-t border-borde bg-superficie pt-3">
                  <Button variant="primario" onClick={guardar} disabled={guardando || cargandoImagenes}>
                    {guardando ? <Spinner /> : editId ? 'Actualizar servicio' : 'Crear servicio'}
                  </Button>
                  <Button variant="secundario" onClick={resetForm}>Cancelar</Button>
                </div>
              </Card>
            )}

            <div className="overflow-x-auto rounded-lg border border-borde">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-panel/60">
                  <tr className="text-left text-[11px] font-medium text-texto-secundario">
                    <th className="px-3 py-3">Servicio</th>
                    <th className="px-3 py-3">Categoría</th>
                    <th className="px-3 py-3">Duración</th>
                    <th className="px-3 py-3 text-right">Precio</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((servicio) => (
                    <tr key={servicio.id} className="border-t border-regla hover:bg-panel/40">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <ImagenServicio src={servicio.imagen_url} nombre={servicio.nombre} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-texto-principal">{servicio.nombre}</p>
                              {Number(servicio.total_imagenes) > 1 && (
                                <Badge variant="default">{servicio.total_imagenes} fotos</Badge>
                              )}
                            </div>
                            <p className="mt-0.5 max-w-[280px] truncate text-[11px] text-texto-secundario">
                              {servicio.descripcion || 'Sin descripción'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="accent">{servicio.categoria_nombre || 'Sin categoría'}</Badge>
                      </td>
                      <td className="num px-3 py-3 text-texto-secundario">{servicio.duracion_base_minutos} min</td>
                      <td className="num px-3 py-3 text-right font-medium text-texto-principal">
                        {dinero(servicio.precio_base)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={servicio.activo ? 'success' : 'default'}>
                          {servicio.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Editar ${servicio.nombre}`}
                            onClick={() => abrirEditar(servicio)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="dangerSuave"
                            size="sm"
                            aria-label={`Eliminar ${servicio.nombre}`}
                            onClick={() => setEliminar({ tipo: 'servicio', item: servicio })}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-3 py-10 text-center text-sm text-texto-secundario">
                        No hay servicios para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'categorias' ? (
          <div className="space-y-5">
            <Card>
              <h3 className="flex items-center gap-2 text-base font-semibold text-texto-principal">
                <Layers className="h-4 w-4 text-acento" strokeWidth={1.7} aria-hidden="true" />
                {editCategoriaId ? 'Editar categoría' : 'Nueva categoría'}
              </h3>
              <p className="mt-1 text-xs text-texto-secundario">
                Las categorías son los títulos que ve el cliente: Peluqueada, Planchada, etc.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="Nombre"
                  value={categoriaForm.nombre}
                  onChange={(evento) => setCategoriaForm((prev) => ({ ...prev, nombre: evento.target.value }))}
                  placeholder="Ej. Peluqueada"
                />
                <Input
                  label="Descripción"
                  value={categoriaForm.descripcion}
                  onChange={(evento) => setCategoriaForm((prev) => ({ ...prev, descripcion: evento.target.value }))}
                  placeholder="Opcional"
                />
                <Input
                  label="Orden"
                  type="number"
                  min="0"
                  value={categoriaForm.orden}
                  onChange={(evento) => setCategoriaForm((prev) => ({ ...prev, orden: evento.target.value }))}
                  placeholder="Automático"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="primario" onClick={guardarCategoria} disabled={guardandoCategoria}>
                  {guardandoCategoria ? <Spinner /> : editCategoriaId ? 'Actualizar categoría' : 'Crear categoría'}
                </Button>
                {editCategoriaId && (
                  <Button
                    variant="secundario"
                    onClick={() => {
                      setEditCategoriaId(null);
                      setCategoriaForm(CATEGORIA_INICIAL);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </Card>

            <div className="overflow-x-auto rounded-lg border border-borde">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-panel/60">
                  <tr className="text-left text-[11px] font-medium text-texto-secundario">
                    <th className="px-3 py-3">Categoría</th>
                    <th className="px-3 py-3">Servicios</th>
                    <th className="px-3 py-3 text-right">Orden</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((categoria) => (
                    <tr key={categoria.id} className="border-t border-regla hover:bg-panel/40">
                      <td className="px-3 py-3">
                        <p className="font-medium text-texto-principal">{categoria.nombre}</p>
                        <p className="mt-0.5 text-[11px] text-texto-secundario">{categoria.descripcion || 'Sin descripción'}</p>
                      </td>
                      <td className="num px-3 py-3 text-texto-secundario">{categoria.total_servicios || 0}</td>
                      <td className="num px-3 py-3 text-right text-texto-secundario">{categoria.orden}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Editar ${categoria.nombre}`}
                            onClick={() => editarCategoria(categoria)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="dangerSuave"
                            size="sm"
                            aria-label={`Eliminar ${categoria.nombre}`}
                            onClick={() => setEliminar({ tipo: 'categoria', item: categoria })}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'duraciones' ? (
          <div className="space-y-5">
            <Card>
              <h3 className="flex items-center gap-2 text-base font-semibold text-texto-principal">
                <Clock className="h-4 w-4 text-acento" strokeWidth={1.7} aria-hidden="true" />
                Tiempos de servicio por empleado
              </h3>
              <p className="mt-1 text-xs text-texto-secundario">
                La duración puede variar por estilista. El cliente verá la suma de sus servicios.
              </p>
              <div className="mt-4 max-w-md">
                <BuscadorSelect
                  label="Empleado"
                  value={empleadoId}
                  onChange={cargarTiempos}
                  options={opcionesEmpleado}
                  placeholder="Buscar empleado..."
                />
              </div>

              {cargandoTiempos ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : empleadoId ? (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-borde bg-panel/40 p-3 sm:grid-cols-[1fr_120px_auto]">
                    <BuscadorSelect
                      label="Asociar servicio"
                      value={servicioAgregar}
                      onChange={(valor) => {
                        setServicioAgregar(valor);
                        const elegido = servicios.find((servicio) => String(servicio.id) === String(valor));
                        if (elegido) setDuracionAgregar(elegido.duracion_base_minutos || 30);
                      }}
                      options={serviciosDisponiblesTiempos}
                      placeholder="Buscar servicio..."
                    />
                    <div>
                      <label htmlFor="duracion-asociar" className="mb-1.5 block text-xs font-medium text-texto-principal">
                        Duración (min)
                      </label>
                      <input
                        id="duracion-asociar"
                        type="number"
                        min="5"
                        max="480"
                        value={duracionAgregar}
                        className="h-10 w-full rounded-md border border-control bg-superficie px-3 text-sm text-texto-principal focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
                        onChange={(evento) => setDuracionAgregar(Number(evento.target.value))}
                      />
                    </div>
                    <Button
                      variant="primario"
                      disabled={!servicioAgregar}
                      onClick={() => {
                        const elegido = servicios.find((servicio) => String(servicio.id) === String(servicioAgregar));
                        if (!elegido) return;
                        const duracion = Number(duracionAgregar) || elegido.duracion_base_minutos || 30;
                        setTiempos((prev) => [
                          ...prev,
                          {
                            servicio_id: elegido.id,
                            servicio_nombre: elegido.nombre,
                            duracion_minutos: duracion,
                          },
                        ]);
                        setServicioAgregar('');
                        setDuracionAgregar(30);
                      }}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" /> Agregar
                    </Button>
                  </div>

                  {tiempos.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-control bg-panel/40 p-4 text-center text-xs text-texto-secundario">
                      No tiene servicios asignados.
                    </p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1 scroll-thin">
                      {tiempos.map((tiempo, indice) => (
                        <div
                          key={tiempo.servicio_id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-borde bg-superficie p-2.5 text-xs"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-texto-principal">{tiempo.servicio_nombre}</span>
                            <span className="block text-[11px] text-texto-secundario">
                              {categoriasPorId.get(servicios.find((s) => s.id === tiempo.servicio_id)?.categoria_id)?.nombre || 'Sin categoría'}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <input
                              type="number"
                              min="5"
                              max="480"
                              value={tiempo.duracion_minutos}
                              aria-label={`Duración de ${tiempo.servicio_nombre}`}
                              onChange={(evento) =>
                                setTiempos((prev) =>
                                  prev.map((item, i) =>
                                    i === indice ? { ...item, duracion_minutos: Number(evento.target.value) } : item
                                  )
                                )
                              }
                              className="w-16 rounded border border-borde bg-superficie px-1.5 py-1 text-center text-xs focus:outline-none"
                            />
                            <span className="text-[10px] text-texto-secundario">min</span>
                            <button
                              type="button"
                              aria-label={`Quitar ${tiempo.servicio_nombre}`}
                              onClick={() => setTiempos((prev) => prev.filter((_, i) => i !== indice))}
                              className="flex h-7 w-7 items-center justify-center rounded text-error hover:bg-error/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button variant="primario" className="w-full" onClick={guardarTiempos} disabled={guardandoTiempos}>
                    {guardandoTiempos ? <Spinner /> : 'Guardar tiempos de servicio'}
                  </Button>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-control bg-panel/40 p-4 text-center text-xs text-texto-secundario">
                  Elige un empleado para configurar sus servicios.
                </p>
              )}
            </Card>
          </div>
        ) : (
          <div className="space-y-5">
            <Card>
              <h3 className="flex items-center gap-2 text-base font-semibold text-texto-principal">
                <Settings className="h-4 w-4 text-acento" strokeWidth={1.7} aria-hidden="true" />
                Configuración de reservas
              </h3>
              <p className="mt-1 text-xs leading-5 text-texto-secundario">
                El cliente puede sumar varios servicios en una misma cita. Define cuántos como máximo.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  label="Máximo de servicios por reserva"
                  type="number"
                  min="1"
                  max="10"
                  value={maxServicios}
                  onChange={(evento) => setMaxServicios(evento.target.value)}
                  wrapperClassName="sm:w-64"
                />
                <Button variant="primario" onClick={guardarConfiguracion} disabled={guardandoConfig}>
                  {guardandoConfig ? <Spinner /> : 'Guardar límite'}
                </Button>
              </div>
              <p className="mt-3 text-[11px] text-tenue">
                Valor actual: {configuracion.max_servicios_reserva}. Rango permitido: 1 a 10.
              </p>
            </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(eliminar)}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title={eliminar?.tipo === 'servicio' ? 'Eliminar servicio' : 'Eliminar categoría'}
        description={
          eliminar?.tipo === 'servicio'
            ? `¿Eliminar "${eliminar?.item?.nombre}"? Si tiene reservas, quedará desactivado para no perder el histórico.`
            : `¿Eliminar "${eliminar?.item?.nombre}"? Solo se puede eliminar si no tiene servicios asignados.`
        }
        confirmLabel={eliminando ? 'Procesando…' : 'Eliminar'}
        danger
        cargando={eliminando}
      />
    </div>
  );
}
