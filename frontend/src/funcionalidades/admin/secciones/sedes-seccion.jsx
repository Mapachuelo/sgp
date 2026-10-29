import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader, Button, Card, Input, Select, Spinner } from '../../../componentes/ui/index.jsx';
import SelectorUbicacion from '../../../componentes/mapa/selector-ubicacion.jsx';
import { avisarAdmin } from './avisos.js';
import api from '../../../api/cliente.js';
import { DEPARTAMENTOS, ciudadesDeDepartamento } from '../../../lib/colombia.js';

const FORM_INICIAL = {
  nombre: '',
  direccion: '',
  departamento: '',
  ciudad: '',
  latitud: '',
  longitud: '',
};

export default function SedesSeccion() {
  const [sedes, setSedes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [editId, setEditId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');
  const [ciudadManual, setCiudadManual] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.ubicaciones.list();
      setSedes(Array.isArray(data) ? data : []);
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const departamentos = useMemo(() => {
    const presentes = sedes.map((sede) => sede.departamento).filter(Boolean);
    return [...new Set([...DEPARTAMENTOS, ...presentes])].sort((a, b) => a.localeCompare(b));
  }, [sedes]);

  const ciudades = useMemo(() => {
    const base = filtroDepartamento
      ? ciudadesDeDepartamento(filtroDepartamento)
      : sedes.map((sede) => sede.ciudad).filter(Boolean);
    return [...new Set(base)].sort((a, b) => a.localeCompare(b));
  }, [filtroDepartamento, sedes]);

  const sedesFiltradas = useMemo(
    () =>
      sedes.filter((sede) => {
        if (filtroDepartamento && sede.departamento !== filtroDepartamento) return false;
        if (filtroCiudad && sede.ciudad !== filtroCiudad) return false;
        return true;
      }),
    [sedes, filtroDepartamento, filtroCiudad]
  );

  const resetForm = () => {
    setForm(FORM_INICIAL);
    setEditId(null);
    setMostrarForm(false);
    setCiudadManual(false);
  };

  const guardar = async () => {
    if (!form.nombre || !form.direccion) {
      return avisarAdmin('Nombre y dirección son obligatorios', 'warning');
    }
    if (!form.departamento || !form.ciudad) {
      return avisarAdmin('Selecciona departamento y ciudad', 'warning');
    }
    const latitud = Number(form.latitud);
    const longitud = Number(form.longitud);
    if (
      form.latitud === '' ||
      form.longitud === '' ||
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud)
    ) {
      return avisarAdmin('Selecciona la ubicación de la sede en el mapa', 'warning');
    }
    setGuardando(true);
    try {
      const body = { ...form, latitud, longitud };
      if (editId) await api.ubicaciones.update(editId, body);
      else await api.ubicaciones.create(body);
      avisarAdmin(editId ? 'Sede actualizada' : 'Sede creada');
      resetForm();
      await cargar();
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (sede) => {
    if (!window.confirm(`¿Eliminar sede "${sede.nombre}"?`)) return;
    try {
      await api.ubicaciones.delete(sede.id);
      avisarAdmin('Sede eliminada');
      await cargar();
    } catch (error) {
      avisarAdmin(error.message, 'error');
    }
  };

  const editar = (sede) => {
    setEditId(sede.id);
    setMostrarForm(true);
    setCiudadManual(true);
    setForm({
      nombre: sede.nombre || '',
      direccion: sede.direccion || '',
      departamento: sede.departamento || '',
      ciudad: sede.ciudad || '',
      latitud: sede.latitud ?? '',
      longitud: sede.longitud ?? '',
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sedes"
        subtitle="Direcciones, ciudades, mapas y disponibilidad del salón."
      />
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Departamento"
              value={filtroDepartamento}
              onChange={(e) => {
                setFiltroDepartamento(e.target.value);
                setFiltroCiudad('');
              }}
              options={[
                { value: '', label: 'Todos los departamentos' },
                ...departamentos.map((item) => ({ value: item, label: item })),
              ]}
            />
            <Select
              label="Ciudad"
              value={filtroCiudad}
              onChange={(e) => setFiltroCiudad(e.target.value)}
              options={[
                { value: '', label: 'Todas las ciudades' },
                ...ciudades.map((item) => ({ value: item, label: item })),
              ]}
            />
          </div>
          <Button variant="primario" onClick={() => { resetForm(); setMostrarForm(true); }}>
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Nueva sede
          </Button>
        </div>

        {mostrarForm && (
          <Card>
            <h3 className="font-display text-lg font-bold text-texto-principal mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primario" aria-hidden="true" />
              {editId ? 'Editar sede' : 'Nueva sede'}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Select
                label="Departamento"
                value={form.departamento}
                onChange={(e) => {
                  const departamento = e.target.value;
                  setForm((previo) => ({ ...previo, departamento, ciudad: '' }));
                  setCiudadManual(true);
                }}
                options={[
                  { value: '', label: 'Seleccionar departamento...' },
                  ...departamentos.map((item) => ({ value: item, label: item })),
                  ...(form.departamento && !departamentos.includes(form.departamento)
                    ? [{ value: form.departamento, label: form.departamento }]
                    : []),
                ]}
              />
              <Select
                label="Ciudad"
                value={form.ciudad}
                onChange={(e) => {
                  setForm((previo) => ({ ...previo, ciudad: e.target.value }));
                  setCiudadManual(true);
                }}
                options={[
                  { value: '', label: 'Seleccionar ciudad...' },
                  ...ciudadesDeDepartamento(form.departamento).map((item) => ({ value: item, label: item })),
                  ...(form.ciudad && !ciudadesDeDepartamento(form.departamento).includes(form.ciudad)
                    ? [{ value: form.ciudad, label: form.ciudad }]
                    : []),
                ]}
              />
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
              <Input label="Dirección" value={form.direccion} onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))} />
              <Input label="Latitud" type="number" step="any" value={form.latitud} onChange={(e) => setForm((p) => ({ ...p, latitud: e.target.value }))} />
              <Input label="Longitud" type="number" step="any" value={form.longitud} onChange={(e) => setForm((p) => ({ ...p, longitud: e.target.value }))} />
            </div>
            <div className="mt-4">
              <SelectorUbicacion
                latitud={form.latitud}
                longitud={form.longitud}
                onChange={(latitud, longitud) =>
                  setForm((previo) => ({
                    ...previo,
                    latitud: String(latitud),
                    longitud: String(longitud),
                  }))
                }
                onCiudadDetectada={({ ciudad, departamento }) => {
                  if (ciudadManual) return;
                  setForm((previo) => ({
                    ...previo,
                    ciudad: ciudad || previo.ciudad,
                    departamento: departamento || previo.departamento,
                  }));
                }}
              />
              <p className="mt-2 text-[11px] leading-5 text-tenue">
                La ciudad y el departamento se detectan al mover el marcador. Puedes corregirlos manualmente.
              </p>
            </div>
            <div className="sticky bottom-0 z-20 mt-4 flex gap-2 border-t border-borde bg-superficie pt-3">
              <Button variant="primario" onClick={guardar} disabled={guardando}>{guardando ? <Spinner /> : editId ? 'Actualizar' : 'Crear'}</Button>
              <Button variant="secundario" onClick={resetForm}>Cancelar</Button>
            </div>
          </Card>
        )}

        {cargando ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borde">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-fondo/60">
                <tr className="text-left text-texto-secundario text-xs uppercase">
                  <th className="py-3 px-3">Departamento</th>
                  <th className="py-3 px-3">Ciudad</th>
                  <th className="py-3 px-3">Nombre</th>
                  <th className="py-3 px-3">Dirección</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sedesFiltradas.map((sede) => (
                  <tr key={sede.id} className="border-t border-borde/50 hover:bg-fondo/30 transition-colors">
                    <td className="py-2.5 px-3 text-xs text-texto-secundario">{sede.departamento || 'Sin departamento'}</td>
                    <td className="py-2.5 px-3 text-xs text-texto-secundario">{sede.ciudad || 'Sin ciudad'}</td>
                    <td className="py-2.5 px-3 font-semibold text-texto-principal">{sede.nombre}</td>
                    <td className="py-2.5 px-3 text-xs text-texto-secundario">{sede.direccion}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" aria-label={`Editar ${sede.nombre}`} onClick={() => editar(sede)}>
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button variant="dangerSuave" size="sm" aria-label={`Eliminar ${sede.nombre}`} onClick={() => eliminar(sede)}>
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sedesFiltradas.length === 0 && (
                  <tr><td colSpan="5" className="py-10 text-center text-texto-secundario">No hay sedes para los filtros seleccionados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
