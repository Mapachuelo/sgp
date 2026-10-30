const disponibilidadModel = require('./disponibilidad.model');
const reservasModel = require('../reservas/reservas.model');
const { cancelarReservasConReembolso, cancelarReservasPorIds } = require('../reservas/cancelacion-reservas');
const HttpError = require('../../shared/http-error');
const { esFestivo } = require('../../shared/festivos-colombia');

const MOTIVO_CAMBIO_SEDE = 'El empleado cambió de sede';
const DIAS_VALIDOS = new Set([1, 2, 3, 4, 5, 6, 7]);

function minutosDeHora(hora) {
  const [h, m] = String(hora).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function horaValida(hora) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora || '').slice(0, 5));
}

function normalizarHora(hora) {
  return String(hora || '').slice(0, 5);
}

function normalizarDescansos(descansos, inicio, fin) {
  if (descansos == null) return [];
  if (!Array.isArray(descansos)) throw new HttpError(400, 'Los descansos deben ser un arreglo');
  const normalizados = descansos
    .map((descanso) => ({
      inicio: normalizarHora(descanso?.inicio),
      fin: normalizarHora(descanso?.fin),
    }))
    .filter((descanso) => descanso.inicio && descanso.fin)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  let cursor = minutosDeHora(inicio);
  const finDia = minutosDeHora(fin);
  for (const descanso of normalizados) {
    if (!horaValida(descanso.inicio) || !horaValida(descanso.fin)) {
      throw new HttpError(400, 'Cada descanso debe tener hora inicio y hora fin validas');
    }
    const desde = minutosDeHora(descanso.inicio);
    const hasta = minutosDeHora(descanso.fin);
    if (desde < cursor || hasta <= desde || hasta > finDia) {
      throw new HttpError(400, 'Los descansos deben estar dentro del horario y no pueden superponerse');
    }
    cursor = hasta;
  }
  return normalizados;
}

function normalizarDia(dia) {
  const numero = Number(dia);
  if (!Number.isInteger(numero) || !DIAS_VALIDOS.has(numero)) {
    throw new HttpError(400, 'dia_semana debe estar entre 1 y 7');
  }
  return numero;
}

function normalizarFecha(fecha) {
  const texto = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new HttpError(400, 'La fecha debe tener formato AAAA-MM-DD');
  }
  return texto;
}

async function validarHorarioSede(ubicacion_id, dia_semana, hora_inicio, hora_fin) {
  const plantilla = await reservasModel.findPlantilla(ubicacion_id);
  if (!plantilla.length) return;
  const dia = plantilla.find((fila) => Number(fila.dia_semana) === Number(dia_semana));
  if (!dia || !dia.abierto) {
    throw new HttpError(409, 'La sede no abre ese día según su plantilla semanal');
  }
  if (minutosDeHora(hora_inicio) < minutosDeHora(dia.hora_inicio)
    || minutosDeHora(hora_fin) > minutosDeHora(dia.hora_fin)) {
    throw new HttpError(
      400,
      `El horario debe estar dentro del horario de la sede (${normalizarHora(dia.hora_inicio)}–${normalizarHora(dia.hora_fin)})`
    );
  }
}

const disponibilidadService = {
  async getDisponibilidad(empleado_id) {
    return disponibilidadModel.findDisponibilidadByEmpleado(empleado_id);
  },

  async getAllDisponibilidad() {
    return disponibilidadModel.findAllDisponibilidad();
  },

  async updateDisponibilidad(empleado_id, items) {
    if (!Array.isArray(items)) {
      throw new HttpError(400, 'Los items de disponibilidad deben ser un arreglo');
    }

    const diasAsignados = new Set();
    const normalizados = [];
    for (const item of items) {
      const dia = normalizarDia(item?.dia_semana);
      if (diasAsignados.has(dia)) {
        throw new HttpError(400, 'El empleado no puede estar disponible en más de una sede el mismo día');
      }
      diasAsignados.add(dia);

      const descanso = Boolean(item.descanso);
      let horaInicio = normalizarHora(item.hora_inicio);
      let horaFin = normalizarHora(item.hora_fin);
      let descansos = [];
      if (!descanso) {
        if (!horaValida(horaInicio) || !horaValida(horaFin) || minutosDeHora(horaInicio) >= minutosDeHora(horaFin)) {
          throw new HttpError(400, 'Cada día debe tener una hora inicio y fin validas');
        }
        descansos = normalizarDescansos(item.descansos, horaInicio, horaFin);
        await validarHorarioSede(item.ubicacion_id, dia, horaInicio, horaFin);
      } else if (!horaValida(horaInicio) || !horaValida(horaFin) || minutosDeHora(horaInicio) >= minutosDeHora(horaFin)) {
        horaInicio = '00:00';
        horaFin = '00:00';
      }

      normalizados.push({
        dia_semana: dia,
        ubicacion_id: Number(item.ubicacion_id),
        hora_inicio: `${horaInicio}:00`,
        hora_fin: `${horaFin}:00`,
        descansos,
        descanso,
      });
    }

    const anteriores = await disponibilidadModel.findDisponibilidadByEmpleado(empleado_id);
    const mapaAnterior = new Map(anteriores.map((r) => [r.dia_semana, r.ubicacion_id]));
    const mapaNuevo = new Map(normalizados.map((i) => [i.dia_semana, i.ubicacion_id]));

    const diasCambiados = [];
    for (const [dia, sedeAnterior] of mapaAnterior) {
      if (mapaNuevo.get(dia) !== sedeAnterior) {
        diasCambiados.push({ dia_semana: dia, ubicacion_id: sedeAnterior });
      }
    }

    await disponibilidadModel.deleteDisponibilidadEmpleado(empleado_id);
    if (normalizados.length > 0) {
      await disponibilidadModel.insertDisponibilidad(empleado_id, normalizados);
    }

    const reservasCanceladas = [];
    for (const cambio of diasCambiados) {
      const reservasFuturas = await reservasModel.findReservasFuturasByEmpleadoUbicacionYDia(
        empleado_id,
        cambio.ubicacion_id,
        cambio.dia_semana
      );
      if (reservasFuturas.length > 0) {
        const ids = reservasFuturas.map((r) => r.id);
        const canceladas = await cancelarReservasPorIds(ids, MOTIVO_CAMBIO_SEDE);
        reservasCanceladas.push(...canceladas.map((item) => item.reserva_id));
      }
    }

    return {
      actualizado: true,
      dias_cambiados: diasCambiados.map((d) => d.dia_semana),
      reservas_canceladas: reservasCanceladas,
      motivo_cancelacion: MOTIVO_CAMBIO_SEDE,
    };
  },

  async actualizarDescansos(empleado_id, data = {}) {
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      throw new HttpError(400, 'Debes indicar al menos un día');
    }

    const actuales = await disponibilidadModel.findDisponibilidadByEmpleado(empleado_id);
    const porDia = new Map(actuales.map((fila) => [Number(fila.dia_semana), fila]));
    const normalizados = items.map((item) => {
      const dia = normalizarDia(item?.dia_semana);
      const actual = porDia.get(dia);
      if (!actual) {
        throw new HttpError(409, `Primero configura la sede y el horario del día ${dia}`);
      }
      const descanso = Boolean(item?.descanso);
      const descansos = descanso
        ? []
        : normalizarDescansos(
          item?.descansos,
          String(actual.hora_inicio).slice(0, 5),
          String(actual.hora_fin).slice(0, 5)
        );
      return { dia_semana: dia, descanso, descansos };
    });

    const configuracionPorDia = new Map(normalizados.map((item) => [item.dia_semana, item]));
    const diasConDescanso = normalizados
      .filter((item) => item.descanso || item.descansos.length > 0)
      .map((item) => item.dia_semana);
    const segmentos = await reservasModel.findSegmentosFuturosEmpleadoDias(
      empleado_id,
      diasConDescanso
    );

    const conflictosMapa = new Map();
    segmentos.forEach((segmento) => {
      const configuracion = configuracionPorDia.get(Number(segmento.dia_semana));
      if (!configuracion) return;
      const inicio = minutosDeHora(segmento.hora_inicio);
      const fin = minutosDeHora(segmento.hora_fin);
      const cruza = configuracion.descanso || configuracion.descansos.some(
        (descanso) => inicio < minutosDeHora(descanso.fin) && fin > minutosDeHora(descanso.inicio)
      );
      if (!cruza) return;

      if (!conflictosMapa.has(segmento.reserva_id)) {
        conflictosMapa.set(segmento.reserva_id, {
          reserva_id: segmento.reserva_id,
          cliente: `${segmento.cliente_nombre || ''} ${segmento.cliente_apellido || ''}`.trim(),
          fecha: segmento.fecha,
          hora_inicio: segmento.hora_inicio,
          hora_fin: segmento.hora_fin,
          servicios: [segmento.servicio],
        });
      } else if (!conflictosMapa.get(segmento.reserva_id).servicios.includes(segmento.servicio)) {
        conflictosMapa.get(segmento.reserva_id).servicios.push(segmento.servicio);
      }
    });
    const conflictos = [...conflictosMapa.values()];

    if (conflictos.length > 0 && !data.confirmar_cancelaciones) {
      throw new HttpError(
        409,
        'El descanso se cruza con citas futuras',
        { codigo: 'CONFLICTOS_DESCANSO', conflictos }
      );
    }

    await disponibilidadModel.updateDescansos(empleado_id, normalizados);
    const motivo = 'El empleado actualizó su descanso semanal';
    const canceladas = conflictos.length > 0 && data.confirmar_cancelaciones
      ? await cancelarReservasConReembolso(
        segmentos.filter((segmento) => conflictosMapa.has(segmento.reserva_id)),
        motivo
      )
      : [];

    return {
      actualizado: true,
      descansos: normalizados,
      total_canceladas: canceladas.length,
      reservas_canceladas: canceladas.map((item) => item.reserva_id),
      reembolsos_pendientes: canceladas.filter((item) => item.reembolso === 'pendiente').length,
    };
  },

  async getTemporales(usuario, empleadoId = null) {
    if (usuario.rol === 'admin') {
      if (empleadoId) return disponibilidadModel.findTemporalesByEmpleado(Number(empleadoId));
      return disponibilidadModel.findTodasTemporales();
    }
    return disponibilidadModel.findTemporalesByEmpleado(usuario.id);
  },

  async crearTemporal(usuario, data) {
    const empleadoId = usuario.rol === 'empleado' ? usuario.id : Number(data.empleado_id);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      throw new HttpError(400, 'Selecciona un empleado');
    }
    const empleado = await reservasModel.findEmpleadoById(empleadoId);
    if (!empleado) throw new HttpError(404, 'Empleado no encontrado');
    const ubicacion = await reservasModel.findUbicacionById(Number(data.ubicacion_id));
    if (!ubicacion) throw new HttpError(404, 'Sede no encontrada');

    const desde = normalizarFecha(data.desde);
    const hasta = normalizarFecha(data.hasta);
    if (hasta < desde) throw new HttpError(400, 'La fecha hasta no puede ser anterior a la fecha desde');

    const dias = Array.isArray(data.dias_semana) && data.dias_semana.length > 0
      ? [...new Set(data.dias_semana.map(normalizarDia))].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6, 7];

    const plantilla = await reservasModel.findPlantilla(Number(data.ubicacion_id));
    if (plantilla.length) {
      for (const dia of dias) {
        const fila = plantilla.find((item) => Number(item.dia_semana) === dia);
        if (fila && !fila.abierto) {
          throw new HttpError(409, `La sede temporal no abre el día ${dia} según su plantilla`);
        }
      }
    }

    const existentes = await disponibilidadModel.findTemporalesByEmpleado(empleadoId);
    const solapa = existentes.some((fila) => {
      const cruzaFechas = desde <= String(fila.hasta).slice(0, 10) && hasta >= String(fila.desde).slice(0, 10);
      const cruzaDias = (fila.dias_semana || []).some((dia) => dias.includes(Number(dia)));
      return cruzaFechas && cruzaDias;
    });
    if (solapa) {
      throw new HttpError(409, 'Ya existe un cambio temporal que se cruza con esas fechas o días');
    }

    return disponibilidadModel.createTemporal({
      empleado_id: empleadoId,
      ubicacion_id: Number(data.ubicacion_id),
      desde,
      hasta,
      dias_semana: dias,
      creado_por: usuario.id,
    });
  },

  async finalizarTemporal(usuario, id, data = {}) {
    const temporal = await disponibilidadModel.findTemporalById(Number(id));
    if (!temporal) throw new HttpError(404, 'Cambio temporal no encontrado');
    if (usuario.rol !== 'admin' && temporal.empleado_id !== usuario.id) {
      throw new HttpError(403, 'No puedes modificar el cambio temporal de otro empleado');
    }

    if (data.sede_retorno_id) {
      const sede = await reservasModel.findUbicacionById(Number(data.sede_retorno_id));
      if (!sede) throw new HttpError(404, 'Sede de retorno no encontrada');
      await disponibilidadModel.updateSedeBaseSemanal(
        temporal.empleado_id,
        temporal.dias_semana || [],
        Number(data.sede_retorno_id)
      );
    }

    await disponibilidadModel.deleteTemporal(temporal.id);
    return { finalizado: true, empleado_id: temporal.empleado_id, sede_retorno_id: data.sede_retorno_id || null };
  },

  async getBloqueos(desde, hasta, empleado_id = null) {
    const inicio = normalizarFecha(desde);
    const fin = normalizarFecha(hasta);
    return disponibilidadModel.findBloqueos(inicio, fin, empleado_id ? Number(empleado_id) : null);
  },

  async getFestivosEmpleado(empleado_id, desde, hasta) {
    return disponibilidadModel.findFestivosByEmpleado(empleado_id, normalizarFecha(desde), normalizarFecha(hasta));
  },

  async getFestivosAdmin(fecha) {
    return disponibilidadModel.findFestivosPorFecha(normalizarFecha(fecha));
  },

  async crearFestivo(usuario, data) {
    const empleadoId = usuario.rol === 'empleado' ? usuario.id : Number(data.empleado_id);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      throw new HttpError(400, 'Selecciona un empleado');
    }
    const fecha = normalizarFecha(data.fecha);
    const festivo = esFestivo(fecha);
    if (!festivo) throw new HttpError(400, 'La fecha seleccionada no es un festivo de Colombia');

    const ubicacionId = Number(data.ubicacion_id);
    const jornada = await reservasModel.findJornada(ubicacionId, fecha);
    if (!jornada || jornada.cerrado) {
      throw new HttpError(409, 'La sede no está abierta para trabajar ese festivo');
    }

    const horaInicio = normalizarHora(data.hora_inicio);
    const horaFin = normalizarHora(data.hora_fin);
    if (!horaValida(horaInicio) || !horaValida(horaFin) || minutosDeHora(horaInicio) >= minutosDeHora(horaFin)) {
      throw new HttpError(400, 'El turno del festivo debe tener hora inicio y fin validas');
    }
    if (minutosDeHora(horaInicio) < minutosDeHora(jornada.hora_inicio)
      || minutosDeHora(horaFin) > minutosDeHora(jornada.hora_fin)) {
      throw new HttpError(
        400,
        `El turno debe estar dentro del horario de la sede (${normalizarHora(jornada.hora_inicio)}–${normalizarHora(jornada.hora_fin)})`
      );
    }
    const descansos = normalizarDescansos(data.descansos, horaInicio, horaFin);

    return disponibilidadModel.createFestivo({
      empleado_id: empleadoId,
      ubicacion_id: ubicacionId,
      fecha,
      hora_inicio: `${horaInicio}:00`,
      hora_fin: `${horaFin}:00`,
      descansos,
    });
  },

  async eliminarFestivo(usuario, fecha) {
    const empleadoId = usuario.rol === 'empleado' ? usuario.id : Number(usuario.empleado_id);
    const eliminado = await disponibilidadModel.deleteFestivo(empleadoId, normalizarFecha(fecha));
    if (!eliminado) throw new HttpError(404, 'Opt-in de festivo no encontrado');
    return { eliminado: true };
  },
};

module.exports = disponibilidadService;
