const QRCode = require('qrcode');
const reservasModel = require('./reservas.model');
const disponibilidadModel = require('../disponibilidad/disponibilidad.model');
const { esFestivo, festivosEntre } = require('../../shared/festivos-colombia');
const HttpError = require('../../shared/http-error');
const { withTransaction } = require('../../config/db');
const { cancelarReservasConReembolso } = require('./cancelacion-reservas');

const MAX_SERVICIOS_DEFAULT = 5;
const MAX_SERVICIOS_LIMITE = 10;
const MAX_IMAGENES_SERVICIO = 6;
const GRANULARIDADES = [15, 30, 60];
const BOGOTA_OFFSET = '-05:00';

function numero(valor, campo) {
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new HttpError(400, `${campo} debe ser un numero valido`);
  return n;
}

function entero(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n)) throw new HttpError(400, `${campo} debe ser un entero valido`);
  return n;
}

function validarFecha(fecha) {
  const valor = String(fecha || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new HttpError(400, 'fecha debe tener formato YYYY-MM-DD');
  }
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) {
    throw new HttpError(400, 'fecha no es valida');
  }
  return valor;
}

function fechaBogotaDeIso(iso) {
  return new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function minutosDeHora(hora) {
  const [h, m] = String(hora).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function horaDeMinutos(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isoBogota(fecha, minutos) {
  return new Date(`${fecha}T${horaDeMinutos(minutos)}:00${BOGOTA_OFFSET}`).toISOString();
}

function horaBogotaDeIso(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function intervalosDeHorario(horario) {
  if (horario?.descanso) return [];
  const inicio = minutosDeHora(horario.hora_inicio);
  const fin = minutosDeHora(horario.hora_fin);
  const descansos = (Array.isArray(horario.descansos) ? horario.descansos : [])
    .map((descanso) => ({
      inicio: minutosDeHora(descanso.inicio || descanso.hora_inicio),
      fin: minutosDeHora(descanso.fin || descanso.hora_fin),
    }))
    .filter((descanso) => descanso.inicio < descanso.fin)
    .sort((a, b) => a.inicio - b.inicio);
  const intervalos = [];
  let cursor = inicio;
  for (const descanso of descansos) {
    if (descanso.inicio > cursor) intervalos.push([cursor, descanso.inicio]);
    cursor = Math.max(cursor, descanso.fin);
  }
  if (cursor < fin) intervalos.push([cursor, fin]);
  return intervalos;
}

function cabeEnDisponibilidad(horario, inicioIso, finIso) {
  if (!horario) return false;
  const inicio = minutosDeHora(horaBogotaDeIso(inicioIso));
  const fin = minutosDeHora(horaBogotaDeIso(finIso));
  return intervalosDeHorario(horario).some(([desde, hasta]) => inicio >= desde && fin <= hasta);
}

function diaSemanaBogota(fecha) {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

function normalizarImagen(imagen) {
  if (imagen === undefined) return undefined;
  if (imagen === null || imagen === '') return null;
  if (typeof imagen !== 'string') throw new HttpError(400, 'imagen_url no es valida');
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(imagen)) {
    throw new HttpError(400, 'La imagen debe ser PNG, JPG o WebP');
  }
  if (imagen.length > 900000) {
    throw new HttpError(400, 'La imagen es demasiado grande; usa una imagen mas liviana');
  }
  return imagen;
}

function normalizarImagenes(imagenes) {
  if (imagenes === undefined) return undefined;
  if (!Array.isArray(imagenes)) throw new HttpError(400, 'imagenes debe ser un arreglo');
  if (imagenes.length > MAX_IMAGENES_SERVICIO) {
    throw new HttpError(400, `Puedes subir hasta ${MAX_IMAGENES_SERVICIO} imagenes por servicio`);
  }
  return imagenes.map((imagen, indice) => {
    if (typeof imagen !== 'string' || !imagen) {
      throw new HttpError(400, `imagenes[${indice}] no es valida`);
    }
    return normalizarImagen(imagen);
  });
}

function validarServicio(data, { parcial = false } = {}) {
  const salida = {};
  if (!parcial || data.nombre !== undefined) {
    const nombre = String(data.nombre || '').trim();
    if (!nombre) throw new HttpError(400, 'El nombre del servicio es obligatorio');
    if (nombre.length > 200) throw new HttpError(400, 'El nombre es demasiado largo');
    salida.nombre = nombre;
  }
  if (!parcial || data.descripcion !== undefined) {
    salida.descripcion = data.descripcion == null ? null : String(data.descripcion);
  }
  if (!parcial || data.precio_base !== undefined) {
    const precio = numero(data.precio_base, 'precio_base');
    if (precio < 0) throw new HttpError(400, 'precio_base no puede ser negativo');
    salida.precio_base = precio;
  }
  if (!parcial || data.duracion_base_minutos !== undefined) {
    const duracion = entero(data.duracion_base_minutos, 'duracion_base_minutos');
    if (duracion < 5 || duracion > 480) {
      throw new HttpError(400, 'duracion_base_minutos debe estar entre 5 y 480');
    }
    salida.duracion_base_minutos = duracion;
  }
  if (data.categoria_id !== undefined) {
    salida.categoria_id = data.categoria_id === null || data.categoria_id === '' ? null : entero(data.categoria_id, 'categoria_id');
  }
  if (data.imagenes !== undefined) {
    salida.imagenes = normalizarImagenes(data.imagenes);
  } else if (data.imagen_url !== undefined) {
    const imagen = normalizarImagen(data.imagen_url);
    salida.imagenes = imagen ? [imagen] : [];
  }
  if (data.activo !== undefined) salida.activo = Boolean(data.activo);
  return salida;
}

function parsearAsignaciones(data) {
  const crudo = Array.isArray(data.servicios)
    ? data.servicios
    : Array.isArray(data.servicio_ids)
      ? data.servicio_ids
      : data.servicio_id != null
        ? [data.servicio_id]
        : [];

  if (!crudo.length) {
    throw new HttpError(400, 'Debes elegir al menos un servicio');
  }

  const asignaciones = crudo.map((item, indice) => {
    const base = typeof item === 'object' && item !== null ? item : { servicio_id: item };
    const servicio_id = entero(base.servicio_id ?? base.id, `servicios[${indice}].servicio_id`);
    const empleado_id = entero(base.empleado_id ?? data.empleado_id, `servicios[${indice}].empleado_id`);
    return { servicio_id, empleado_id };
  });

  const ids = asignaciones.map((a) => a.servicio_id);
  if (new Set(ids).size !== ids.length) {
    throw new HttpError(400, 'No se puede repetir el mismo servicio en una reserva');
  }
  return asignaciones;
}

async function maxServicios() {
  const config = await reservasModel.findConfiguracion();
  const valor = Number(config.max_servicios_reserva);
  return Number.isInteger(valor) && valor > 0 ? valor : MAX_SERVICIOS_DEFAULT;
}

function validarCategoriaPayload(data, { parcial = false } = {}) {
  const salida = {};
  if (!parcial || data.nombre !== undefined) {
    const nombre = String(data.nombre || '').trim();
    if (!nombre) throw new HttpError(400, 'El nombre de la categoria es obligatorio');
    if (nombre.length > 120) throw new HttpError(400, 'El nombre de la categoria es demasiado largo');
    salida.nombre = nombre;
  }
  if (!parcial || data.descripcion !== undefined) {
    salida.descripcion = data.descripcion == null ? null : String(data.descripcion);
  }
  if (data.orden !== undefined) {
    const orden = entero(data.orden, 'orden');
    if (orden < 0) throw new HttpError(400, 'orden no puede ser negativo');
    salida.orden = orden;
  }
  return salida;
}

const reservasService = {
  async getCategorias() {
    return reservasModel.findAllCategorias();
  },

  async createCategoria(data) {
    const payload = validarCategoriaPayload(data);
    const existente = await reservasModel.findCategoriaByNombre(payload.nombre);
    if (existente) throw new HttpError(409, 'Ya existe una categoria con ese nombre');
    if (payload.orden === undefined) {
      const categorias = await reservasModel.findAllCategorias();
      payload.orden = categorias.reduce((max, c) => Math.max(max, Number(c.orden) || 0), 0) + 1;
    }
    return reservasModel.createCategoria(payload);
  },

  async updateCategoria(id, data) {
    const categoria = await reservasModel.findCategoriaById(id);
    if (!categoria) throw new HttpError(404, 'Categoria no encontrada');
    const payload = validarCategoriaPayload(data, { parcial: true });
    if (payload.nombre && payload.nombre.toLowerCase() !== categoria.nombre.toLowerCase()) {
      const existente = await reservasModel.findCategoriaByNombre(payload.nombre);
      if (existente) throw new HttpError(409, 'Ya existe una categoria con ese nombre');
    }
    return reservasModel.updateCategoria(id, payload);
  },

  async deleteCategoria(id) {
    const categoria = await reservasModel.findCategoriaById(id);
    if (!categoria) throw new HttpError(404, 'Categoria no encontrada');
    const total = await reservasModel.countServiciosCategoria(id);
    if (total > 0) {
      throw new HttpError(409, 'La categoria tiene servicios asignados; reasignalos antes de eliminarla');
    }
    return reservasModel.deleteCategoria(id);
  },

  async getConfiguracion() {
    const config = await reservasModel.findConfiguracion();
    return {
      ...config,
      max_servicios_reserva: await maxServicios(),
    };
  },

  async updateConfiguracion(data) {
    const valor = entero(data.max_servicios_reserva, 'max_servicios_reserva');
    if (valor < 1 || valor > MAX_SERVICIOS_LIMITE) {
      throw new HttpError(400, `max_servicios_reserva debe estar entre 1 y ${MAX_SERVICIOS_LIMITE}`);
    }
    await reservasModel.upsertConfiguracion('max_servicios_reserva', valor);
    return reservasService.getConfiguracion();
  },

  async getServicios(filtros = {}) {
    const incluirInactivos = filtros.incluir_inactivos === '1' || filtros.incluir_inactivos === true;
    const categoriaId = filtros.categoria_id ? Number(filtros.categoria_id) : null;
    const ubicacionId = filtros.ubicacion_id ? Number(filtros.ubicacion_id) : null;
    const empleadoId = filtros.empleado_id ? Number(filtros.empleado_id) : null;
    return reservasModel.findAllServicios({
      incluirInactivos,
      categoria_id: categoriaId,
      ubicacion_id: ubicacionId,
      empleado_id: empleadoId,
    });
  },

  async createServicio(data) {
    const { imagenes, ...payload } = validarServicio(data);
    if (payload.categoria_id) {
      const categoria = await reservasModel.findCategoriaById(payload.categoria_id);
      if (!categoria) throw new HttpError(404, 'Categoria no encontrada');
    } else if (payload.categoria_id === undefined) {
      const otros = await reservasModel.findCategoriaByNombre('Otros');
      payload.categoria_id = otros?.id || null;
    }
    const galeria = imagenes || [];
    payload.imagen_url = galeria[0] || null;
    return withTransaction(async (client) => {
      const servicio = await reservasModel.createServicio(payload, client);
      if (galeria.length > 0) {
        await reservasModel.replaceImagenesServicio(servicio.id, galeria, client);
      }
      return servicio;
    });
  },

  async updateServicio(id, data) {
    const servicio = await reservasModel.findServicioById(id);
    if (!servicio) throw new HttpError(404, 'Servicio no encontrado');
    const { imagenes, ...payload } = validarServicio(data, { parcial: true });
    if (payload.categoria_id) {
      const categoria = await reservasModel.findCategoriaById(payload.categoria_id);
      if (!categoria) throw new HttpError(404, 'Categoria no encontrada');
    }
    if (imagenes === undefined) {
      return reservasModel.updateServicio(id, payload);
    }
    return withTransaction(async (client) => {
      const actualizado = await reservasModel.updateServicio(id, payload, client);
      if (!actualizado) throw new HttpError(404, 'Servicio no encontrado');
      await reservasModel.replaceImagenesServicio(id, imagenes, client);
      return reservasModel.findServicioById(id, client);
    });
  },

  async getImagenesServicio(id) {
    const servicio = await reservasModel.findServicioById(id);
    if (!servicio) throw new HttpError(404, 'Servicio no encontrado');
    return reservasModel.findImagenesServicio(id);
  },

  async getSedesPorServicio({ servicio_id }) {
    if (!servicio_id) {
      throw new HttpError(400, 'servicio_id es requerido');
    }
    const id = entero(servicio_id, 'servicio_id');
    const servicio = await reservasModel.findServicioById(id);
    if (!servicio) throw new HttpError(404, 'Servicio no encontrado');
    return reservasModel.findSedesPorServicio(id);
  },

  async deleteServicio(id) {
    const servicio = await reservasModel.findServicioById(id);
    if (!servicio) throw new HttpError(404, 'Servicio no encontrado');
    const resultado = await reservasModel.deleteServicio(id);
    if (!resultado) throw new HttpError(404, 'Servicio no encontrado');
    return resultado;
  },

  async getDisponibilidad({ fecha, empleado_id, ubicacion_id }) {
    if (!fecha || !empleado_id || !ubicacion_id) {
      throw new HttpError(400, 'fecha, empleado_id y ubicacion_id son requeridos');
    }

    const diaSemana = new Date(fecha).getUTCDay();
    const diaMapeado = diaSemana === 0 ? 7 : diaSemana;

    const jornada = await reservasModel.findJornada(ubicacion_id, fecha);
    const slotsOcupados = await reservasModel.findSlotsOcupados(fecha, empleado_id);
    const disponibilidadEmpleado = await disponibilidadModel.findDisponibilidadEfectiva(
      empleado_id,
      ubicacion_id,
      fecha,
      diaMapeado
    );

    return {
      fecha,
      empleado_id,
      ubicacion_id,
      dia_semana: diaMapeado,
      jornada: jornada || null,
      slots_ocupados: slotsOcupados,
      disponibilidad_empleado: disponibilidadEmpleado || null,
    };
  },

  async getJornada(ubicacion_id) {
    return reservasModel.findJornadas(ubicacion_id);
  },

  async getJornadaPlantilla(ubicacion_id = null) {
    if (ubicacion_id) return reservasModel.findPlantilla(Number(ubicacion_id));
    return reservasModel.findPlantillas();
  },

  async updateJornadaPlantilla(ubicacion_id, items) {
    if (!Array.isArray(items)) {
      throw new HttpError(400, 'items debe ser un arreglo de la plantilla semanal');
    }
    const normalizados = items.map((item) => {
      const dia = Number(item.dia_semana);
      if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
        throw new HttpError(400, 'dia_semana debe estar entre 1 y 7');
      }
      const abierto = item.abierto !== false;
      const horaInicio = String(item.hora_inicio || '09:00').slice(0, 5);
      const horaFin = String(item.hora_fin || '18:00').slice(0, 5);
      if (abierto && minutosDeHora(horaInicio) >= minutosDeHora(horaFin)) {
        throw new HttpError(400, 'La hora fin de la plantilla debe ser mayor a la hora inicio');
      }
      return { dia_semana: dia, abierto, hora_inicio: `${horaInicio}:00`, hora_fin: `${horaFin}:00` };
    });
    await withTransaction(async (client) => {
      await reservasModel.replacePlantilla(Number(ubicacion_id), normalizados, client);
    });
    const cerrados = normalizados.filter((item) => !item.abierto);
    for (const dia of cerrados) {
      await disponibilidadModel.deleteDisponibilidadSedeDia(Number(ubicacion_id), dia.dia_semana);
    }
    const canceladas = [];
    for (const dia of cerrados) {
      const ids = await reservasModel.findReservasFuturasBySedeDia(Number(ubicacion_id), dia.dia_semana);
      if (ids.length) {
        canceladas.push(...await reservasModel.cancelReservasFuturas(ids, 'La sede no atiende ese día según la plantilla'));
      }
    }
    return {
      actualizado: true,
      dias_cerrados: cerrados.map((item) => item.dia_semana),
      reservas_canceladas: [...new Set(canceladas)],
    };
  },

  async getFestivos(desde, hasta) {
    return festivosEntre(validarFecha(desde), validarFecha(hasta));
  },

  async abrirFestivo({ fecha, sedes, hora_inicio, hora_fin }) {
    const fechaValida = validarFecha(fecha);
    if (!esFestivo(fechaValida)) {
      throw new HttpError(400, 'La fecha seleccionada no es un festivo de Colombia');
    }
    if (!Array.isArray(sedes) || sedes.length === 0) {
      throw new HttpError(400, 'Selecciona al menos una sede');
    }
    const horaInicio = String(hora_inicio || '09:00').slice(0, 5);
    const horaFin = String(hora_fin || '18:00').slice(0, 5);
    if (minutosDeHora(horaInicio) >= minutosDeHora(horaFin)) {
      throw new HttpError(400, 'La hora fin debe ser mayor a la hora inicio');
    }
    const abiertas = [];
    for (const sedeId of sedes) {
      const ubicacion = await reservasModel.findUbicacionById(Number(sedeId));
      if (!ubicacion) throw new HttpError(404, `Sede ${sedeId} no encontrada`);
      abiertas.push(await reservasModel.upsertJornada(Number(sedeId), {
        fecha: fechaValida,
        hora_inicio: `${horaInicio}:00`,
        hora_fin: `${horaFin}:00`,
        cerrado: false,
        motivo: 'Festivo abierto por administración',
      }));
    }
    return { actualizado: true, sedes: abiertas.map((fila) => fila.ubicacion_id) };
  },

  async updateJornada(ubicacion_id, items) {
    if (!Array.isArray(items)) {
      throw new HttpError(400, 'items debe ser un arreglo de jornadas');
    }
    const normalizados = items.map((item) => {
      const fecha = validarFecha(item.fecha);
      const cerrado = Boolean(item.cerrado);
      const horaInicio = cerrado ? '00:00' : String(item.hora_inicio || '').slice(0, 5);
      const horaFin = cerrado ? '00:00' : String(item.hora_fin || '').slice(0, 5);
      if (!cerrado && (!horaInicio || !horaFin || minutosDeHora(horaInicio) >= minutosDeHora(horaFin))) {
        throw new HttpError(400, 'Cada jornada abierta debe tener hora inicio y fin validas');
      }
      return {
        fecha,
        hora_inicio: `${horaInicio}:00`,
        hora_fin: `${horaFin}:00`,
        cerrado,
        motivo: item.motivo ? String(item.motivo).slice(0, 200) : null,
      };
    });
    await withTransaction(async (client) => {
      await reservasModel.replaceJornadas(Number(ubicacion_id), normalizados, client);
    });
    const canceladas = [];
    for (const dia of normalizados.filter((item) => item.cerrado)) {
      const ids = await reservasModel.findReservasFuturasBySedeFecha(Number(ubicacion_id), dia.fecha);
      if (ids.length) {
        canceladas.push(...await reservasModel.cancelReservasFuturas(ids, 'La sede no atiende ese día'));
      }
    }
    return { actualizado: true, reservas_canceladas: [...new Set(canceladas)] };
  },

  async getEmpleadosDisponibles({ fecha, ubicacion_id, servicio_id }) {
    if (!fecha || !ubicacion_id) {
      throw new HttpError(400, 'fecha y ubicacion_id son requeridos');
    }
    const jornada = await reservasModel.findJornada(ubicacion_id, fecha);
    if (jornada?.cerrado) return [];
    if (esFestivo(fecha)) {
      return reservasModel.findEmpleadosFestivo(fecha, ubicacion_id, servicio_id ? Number(servicio_id) : null);
    }
    return reservasModel.findEmpleadosDisponibles(
      fecha,
      ubicacion_id,
      servicio_id ? Number(servicio_id) : null
    );
  },

  async getEmpleadosPorServicio({ ubicacion_id, servicio_id }) {
    if (!ubicacion_id || !servicio_id) {
      throw new HttpError(400, 'ubicacion_id y servicio_id son requeridos');
    }
    return reservasModel.findEmpleadosPorServicio(Number(ubicacion_id), Number(servicio_id));
  },

  async getEmpleadosPorSede({ ubicacion_id }) {
    if (!ubicacion_id) {
      throw new HttpError(400, 'ubicacion_id es requerido');
    }
    const ubicacion = await reservasModel.findUbicacionById(Number(ubicacion_id));
    if (!ubicacion) throw new HttpError(404, 'Ubicacion no encontrada');
    return reservasModel.findEmpleadosPorSede(Number(ubicacion_id));
  },

  async getDisponibilidadCombo({ ubicacion_id, fecha, servicios, granularidad }) {
    const ubicacionId = entero(ubicacion_id, 'ubicacion_id');
    const fechaValida = validarFecha(fecha);
    const paso = granularidadValida(granularidad);
    const asignaciones = parsearAsignaciones({ servicios });
    const maximo = await maxServicios();
    if (asignaciones.length > maximo) {
      throw new HttpError(400, `Puedes elegir hasta ${maximo} servicios por reserva`);
    }

    const idsServicios = asignaciones.map((a) => a.servicio_id);
    const catalogo = await reservasModel.findServiciosPorIds(idsServicios);
    const mapaServicios = new Map(catalogo.map((s) => [s.id, s]));
    if (catalogo.length !== idsServicios.length) {
      throw new HttpError(404, 'Uno de los servicios no existe');
    }
    if (catalogo.some((s) => !s.activo)) {
      throw new HttpError(409, 'Uno de los servicios ya no esta disponible');
    }

    const diaSemana = new Date(`${fechaValida}T00:00:00Z`).getUTCDay();
    const diaMapeado = diaSemana === 0 ? 7 : diaSemana;
    const empleadosUnicos = [...new Set(asignaciones.map((a) => a.empleado_id))];
    const jornada = await reservasModel.findJornada(ubicacionId, fechaValida);
    if (jornada?.cerrado) {
      return {
        fecha: fechaValida,
        ubicacion_id: ubicacionId,
        duracion_total: 0,
        precio_total: 0,
        slots: [],
        descansos: [],
        motivo: jornada.motivo || 'La sede no atiende ese día',
      };
    }

    const [disponibilidad, ocupados] = await Promise.all([
      reservasModel.findDisponibilidadEmpleados(empleadosUnicos, ubicacionId, fechaValida, diaMapeado),
      reservasModel.findSegmentosOcupados(fechaValida, empleadosUnicos),
    ]);

    const horarios = new Map(disponibilidad.map((d) => [d.empleado_id, d]));
    const descansos = disponibilidad.flatMap((fila) => {
      const nombre = `${fila.empleado_nombre || ''} ${fila.empleado_apellido || ''}`.trim();
      if (fila.descanso) {
        return [{
          empleado_id: fila.empleado_id,
          empleado_nombre: nombre,
          todo_el_dia: true,
          inicio: '00:00',
          fin: '23:59',
        }];
      }
      return (Array.isArray(fila.descansos) ? fila.descansos : []).map((descanso) => ({
        empleado_id: fila.empleado_id,
        empleado_nombre: nombre,
        todo_el_dia: false,
        inicio: String(descanso.inicio).slice(0, 5),
        fin: String(descanso.fin).slice(0, 5),
      }));
    });
    const ocupadosPorEmpleado = new Map();
    ocupados.forEach((o) => {
      if (!ocupadosPorEmpleado.has(o.empleado_id)) ocupadosPorEmpleado.set(o.empleado_id, []);
      ocupadosPorEmpleado.get(o.empleado_id).push({
        inicio: new Date(o.inicia_en).getTime(),
        fin: new Date(o.termina_en).getTime(),
      });
    });

    const segmentosBase = [];
    for (let i = 0; i < asignaciones.length; i += 1) {
      const asignacion = asignaciones[i];
      const servicio = mapaServicios.get(asignacion.servicio_id);
      const empleado = await reservasModel.findEmpleadoById(asignacion.empleado_id);
      if (!empleado || empleado.esta_bloqueado) {
        throw new HttpError(409, `El estilista del servicio ${servicio.nombre} no esta disponible`);
      }
      const duracion = await reservasModel.findDuracionServicioEmpleado(asignacion.empleado_id, asignacion.servicio_id);
      if (!duracion) {
        throw new HttpError(400, `El estilista no ofrece el servicio ${servicio.nombre}`);
      }
      if (!horarios.has(asignacion.empleado_id)) {
        return {
          fecha: fechaValida,
          ubicacion_id: ubicacionId,
          duracion_total: 0,
          precio_total: 0,
          slots: [],
          descansos,
          motivo: 'Uno de los estilistas no trabaja en esa sede ese dia',
        };
      }
      segmentosBase.push({
        servicio_id: asignacion.servicio_id,
        empleado_id: asignacion.empleado_id,
        empleado_nombre: `${empleado.nombre} ${empleado.apellido || ''}`.trim(),
        nombre: servicio.nombre,
        precio: Number(servicio.precio_base),
        duracion_minutos: Number(duracion.duracion_minutos),
        orden: i + 1,
      });
    }

    const duracionTotal = segmentosBase.reduce((sum, s) => sum + s.duracion_minutos, 0);
    const precioTotal = segmentosBase.reduce((sum, s) => sum + s.precio, 0);
    const horariosLaborables = disponibilidad.filter((fila) => !fila.descanso);
    const inicioMin = horariosLaborables.length
      ? Math.min(...horariosLaborables.map((d) => minutosDeHora(d.hora_inicio)))
      : 0;
    const finMax = horariosLaborables.length
      ? Math.max(...horariosLaborables.map((d) => minutosDeHora(d.hora_fin)))
      : 0;

    const slots = [];
    for (let cursor = inicioMin; cursor + duracionTotal <= finMax; cursor += paso) {
      let actual = cursor;
      const plan = [];
      let valido = true;
      for (const segmento of segmentosBase) {
        const horario = horarios.get(segmento.empleado_id);
        const inicio = actual;
        const fin = actual + segmento.duracion_minutos;
        const intervalos = intervalosDeHorario(horario);
        if (!intervalos.some(([desde, hasta]) => inicio >= desde && fin <= hasta)) {
          valido = false;
          break;
        }
        const inicioMs = new Date(isoBogota(fechaValida, inicio)).getTime();
        const finMs = new Date(isoBogota(fechaValida, fin)).getTime();
        const choques = ocupadosPorEmpleado.get(segmento.empleado_id) || [];
        if (choques.some((o) => inicioMs < o.fin && finMs > o.inicio)) {
          valido = false;
          break;
        }
        plan.push({
          ...segmento,
          inicia_en: isoBogota(fechaValida, inicio),
          termina_en: isoBogota(fechaValida, fin),
        });
        actual = fin;
      }
      if (valido) {
        slots.push({
          hora: horaDeMinutos(cursor),
          inicia_en: isoBogota(fechaValida, cursor),
          termina_en: isoBogota(fechaValida, actual),
          plan,
        });
      }
    }

    return {
      fecha: fechaValida,
      ubicacion_id: ubicacionId,
      duracion_total: duracionTotal,
      precio_total: precioTotal,
      slots,
      descansos,
    };
  },

  async getEmpleadoTiemposServicio(empleado_id) {
    if (empleado_id) {
      return reservasModel.findEmpleadoTiemposServicio(empleado_id);
    }
    return reservasModel.findAllEmpleadoTiemposServicio();
  },

  async updateEmpleadoTiemposServicio(empleado_id, items) {
    if (!Array.isArray(items)) {
      throw new HttpError(400, 'items debe ser un arreglo de servicios');
    }
    const normalizados = [];
    const vistos = new Set();
    for (const item of items) {
      const servicioId = Number(item?.servicio_id);
      const duracion = Number(item?.duracion_minutos);
      if (!Number.isInteger(servicioId) || servicioId <= 0) {
        throw new HttpError(400, 'servicio_id debe ser un entero valido');
      }
      if (vistos.has(servicioId)) {
        throw new HttpError(400, 'No se puede repetir un servicio');
      }
      if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
        throw new HttpError(400, 'duracion_minutos debe estar entre 5 y 480');
      }
      const servicio = await reservasModel.findServicioById(servicioId);
      if (!servicio || !servicio.activo) {
        throw new HttpError(404, `El servicio ${servicioId} no existe o esta inactivo`);
      }
      vistos.add(servicioId);
      normalizados.push({ servicio_id: servicioId, duracion_minutos: duracion });
    }
    await reservasModel.upsertEmpleadoTiempoServicio(empleado_id, normalizados);
    return { actualizado: true };
  },

  async createReserva(cliente_id, data) {
    const { ubicacion_id, inicia_en, cantidad_personas } = data;
    const asignaciones = parsearAsignaciones(data);
    const maximo = await maxServicios();
    if (asignaciones.length > maximo) {
      throw new HttpError(400, `Puedes elegir hasta ${maximo} servicios por reserva`);
    }
    if (!ubicacion_id || !inicia_en) {
      throw new HttpError(400, 'ubicacion_id e inicia_en son requeridos');
    }

    const inicio = new Date(inicia_en);
    if (Number.isNaN(inicio.getTime())) {
      throw new HttpError(400, 'inicia_en no es una fecha valida');
    }
    const diffMin = (inicio - new Date()) / (1000 * 60);
    if (diffMin < 60) {
      throw new HttpError(400, 'La reserva debe hacerse con al menos 60 minutos de anticipacion');
    }

    const qty = Number(cantidad_personas || 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 5) {
      throw new HttpError(400, 'cantidad_personas debe estar entre 1 y 5');
    }

    const idsServicios = asignaciones.map((a) => a.servicio_id);
    const catalogo = await reservasModel.findServiciosPorIds(idsServicios);
    const mapaServicios = new Map(catalogo.map((s) => [s.id, s]));
    if (catalogo.length !== idsServicios.length) throw new HttpError(404, 'Uno de los servicios no existe');
    if (catalogo.some((s) => !s.activo)) throw new HttpError(409, 'Uno de los servicios ya no esta disponible');

    const ubicacion = await reservasModel.findUbicacionById(ubicacion_id);
    if (!ubicacion) throw new HttpError(404, 'Ubicacion no encontrada');

    const fechaReserva = fechaBogotaDeIso(inicio.toISOString());
    const jornadaReserva = await reservasModel.findJornada(ubicacion_id, fechaReserva);
    if (jornadaReserva?.cerrado) {
      throw new HttpError(409, jornadaReserva.motivo || 'La sede no atiende ese día');
    }

    const segmentos = [];
    let cursor = inicio;
    for (let i = 0; i < asignaciones.length; i += 1) {
      const asignacion = asignaciones[i];
      const servicio = mapaServicios.get(asignacion.servicio_id);
      const empleado = await reservasModel.findEmpleadoById(asignacion.empleado_id);
      if (!empleado) throw new HttpError(404, `Estilista no encontrado para ${servicio.nombre}`);
      if (empleado.esta_bloqueado) throw new HttpError(409, `El estilista de ${servicio.nombre} no esta disponible`);
      const duracion = await reservasModel.findDuracionServicioEmpleado(asignacion.empleado_id, asignacion.servicio_id);
      if (!duracion) throw new HttpError(400, `El estilista no ofrece el servicio ${servicio.nombre}`);
      const fin = new Date(cursor.getTime() + Number(duracion.duracion_minutos) * 60000);
      segmentos.push({
        servicio_id: asignacion.servicio_id,
        empleado_id: asignacion.empleado_id,
        nombre: servicio.nombre,
        precio: Number(servicio.precio_base),
        duracion_minutos: Number(duracion.duracion_minutos),
        inicia_en: cursor.toISOString(),
        termina_en: fin.toISOString(),
        orden: i + 1,
      });
      cursor = fin;
    }

    const inicioIso = segmentos[0].inicia_en;
    const finIso = segmentos[segmentos.length - 1].termina_en;
    if (fechaBogotaDeIso(inicioIso) !== fechaBogotaDeIso(finIso)) {
      throw new HttpError(400, 'La reserva no puede cruzar la medianoche');
    }

    for (const segmento of segmentos) {
      const fechaSegmento = fechaBogotaDeIso(segmento.inicia_en);
      const diaSegmento = diaSemanaBogota(fechaSegmento);
      const disponibilidadEmpleado = await disponibilidadModel.findDisponibilidadEfectiva(
        segmento.empleado_id,
        ubicacion_id,
        fechaSegmento,
        diaSegmento
      );
      if (!cabeEnDisponibilidad(disponibilidadEmpleado, segmento.inicia_en, segmento.termina_en)) {
        throw new HttpError(400, 'El horario esta fuera de la disponibilidad de uno de los estilistas');
      }
      if (jornadaReserva && jornadaReserva.hora_inicio && jornadaReserva.hora_fin) {
        const inicioSegmento = minutosDeHora(horaBogotaDeIso(segmento.inicia_en));
        const finSegmento = minutosDeHora(horaBogotaDeIso(segmento.termina_en));
        if (inicioSegmento < minutosDeHora(jornadaReserva.hora_inicio)
          || finSegmento > minutosDeHora(jornadaReserva.hora_fin)) {
          throw new HttpError(409, 'El servicio esta fuera del horario de atencion de la sede');
        }
      }
    }

    const reserva = await withTransaction(async (client) => {
      const empleadosUnicos = [...new Set(segmentos.map((s) => s.empleado_id))].sort((a, b) => a - b);
      for (const empleadoId of empleadosUnicos) {
        await reservasModel.acquireLock(empleadoId, inicioIso, client);
      }

      const activas = await reservasModel.findReservasActivasPorCliente(cliente_id, client);
      if (activas >= 5) {
        throw new HttpError(409, 'Maximo 5 reservas activas por cliente');
      }

      for (const segmento of segmentos) {
        const solapadas = await reservasModel.findReservasSolapadas(
          segmento.empleado_id,
          segmento.inicia_en,
          segmento.termina_en,
          client
        );
        if (solapadas.length > 0) {
          throw new HttpError(409, 'El horario seleccionado se superpone con otra reserva activa');
        }
      }

      const nueva = await reservasModel.createReserva(
        {
          cliente_id,
          empleado_id: segmentos[0].empleado_id,
          servicio_id: segmentos[0].servicio_id,
          ubicacion_id,
          inicia_en: inicioIso,
          termina_en: finIso,
          cantidad_personas: qty,
          qr_data_url: null,
        },
        client
      );

      await reservasModel.createReservaServicios(nueva.id, segmentos, client);

      const qr_data_url = await QRCode.toDataURL(nueva.qr_token);
      await reservasModel.updateReservaQr(nueva.id, qr_data_url, client);

      return { ...nueva, qr_data_url };
    });

    return reservasModel.findReservaById(reserva.id);
  },

  async getReservasByCliente(cliente_id) {
    return reservasModel.findReservasByCliente(cliente_id);
  },

  async getReservasEmpleadoDia(empleado_id, fecha) {
    const fechaValida = validarFecha(fecha);
    return reservasModel.findReservasActivasEmpleadoFecha(empleado_id, fechaValida);
  },

  async cancelarDiaEmpleado(empleado_id, { fecha, motivo }) {
    const fechaValida = validarFecha(fecha);
    const motivoLimpio = String(motivo || '').trim();
    if (motivoLimpio.length < 4) {
      throw new HttpError(400, 'Escribe el motivo del imprevisto');
    }
    if (motivoLimpio.length > 200) {
      throw new HttpError(400, 'El motivo no puede superar 200 caracteres');
    }

    const reservas = await reservasModel.findReservasActivasEmpleadoFecha(empleado_id, fechaValida);
    await disponibilidadModel.bloquearFecha(
      empleado_id,
      fechaValida,
      `Imprevisto del empleado: ${motivoLimpio}`
    );

    const motivoCancelacion = `Imprevisto del empleado: ${motivoLimpio}`;
    const resultados = await cancelarReservasConReembolso(reservas, motivoCancelacion, fechaValida);

    return {
      fecha: fechaValida,
      motivo: motivoLimpio,
      bloqueada: true,
      reservas_encontradas: reservas.length,
      reservas_canceladas: resultados,
      total_canceladas: resultados.length,
      reembolsos_pendientes: resultados.filter((item) => item.reembolso === 'pendiente').length,
    };
  },

  async cancelReserva(id, cliente_id) {
    const reserva = await reservasModel.findReservaById(id);
    if (!reserva) throw new HttpError(404, 'Reserva no encontrada');
    if (reserva.cliente_id !== cliente_id) throw new HttpError(403, 'No puede cancelar esta reserva');
    if (reserva.estado === 'cancelada') throw new HttpError(409, 'La reserva ya esta cancelada');
    if (reserva.estado === 'cobrado') throw new HttpError(409, 'La reserva ya fue cobrada');

    return reservasModel.cancelReserva(id, cliente_id, 'Cancelada por el cliente');
  },

  async getAllReservas(filtros) {
    return reservasModel.findAllReservas(filtros);
  },

  async getAgenda({ desde, hasta, empleado_id, ciudad, departamento }) {
    const fechaValida = (valor) =>
      typeof valor === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
      !Number.isNaN(Date.parse(`${valor}T00:00:00Z`)) &&
      new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
    if (!fechaValida(desde) || !fechaValida(hasta)) {
      throw new HttpError(400, 'desde y hasta son requeridos con formato YYYY-MM-DD');
    }
    if (desde > hasta) {
      throw new HttpError(400, 'desde no puede ser mayor que hasta');
    }
    return reservasModel.findAgenda(desde, hasta, {
      empleado_id: empleado_id ? parseInt(empleado_id, 10) : null,
      ciudad,
      departamento,
    });
  },
};

function granularidadValida(valor) {
  if (valor === undefined || valor === null || valor === '') return 30;
  const n = Number(valor);
  if (!GRANULARIDADES.includes(n)) {
    throw new HttpError(400, 'granularidad debe ser 15, 30 o 60');
  }
  return n;
}

module.exports = reservasService;
