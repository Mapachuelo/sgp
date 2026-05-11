const crypto = require("crypto");
const QRCode = require("qrcode");
const { env } = require("../../config/env");
const { HttpError } = require("../../shared/httpError");
const { broadcast } = require("../../integrations/realtime/wsHub");
const { getStylistsForCalendar } = require("../auth/auth.service");
const { findClientModerationById } = require("../clients/clients.model");
const {
  createReservation,
  listReservationsByClient,
  listAllReservations,
  listReservationsByStylist,
  listReservedByDate,
  listWorkScheduleByRange,
  listEmployeeWorkScheduleByRange,
  upsertWorkSchedule,
  upsertEmployeeWorkSchedule,
  deleteWorkScheduleByRange,
  deleteEmployeeWorkScheduleByRange,
  listServiceCatalog,
  listEmployeeServiceMinimumDurations,
  listEmployeeServiceTimesForCalendar,
  listEnabledServicesForEmployee,
  createServiceCatalogEntry,
  deleteServiceCatalogEntry,
  listEmployeeServiceTimesByEmployee,
  saveEmployeeServiceTimes,
  countActiveReservationsByClient,
  findClientReservationById,
  cancelReservationByClient,
  cancelReservationsByDate
} = require("./reservations.model");

const DEFAULT_START = "06:00";
const DEFAULT_END = "22:00";
const ANY_STYLIST_VALUE = "__any__";
const DEFAULT_SERVICE_DURATION_MINUTES = 30;
const MIN_SERVICE_DURATION_MINUTES = 1;
const MAX_SERVICE_DURATION_MINUTES = 280;
const MIN_LEAD_TIME_MINUTES = 15;
const MIN_CLIENT_COUNT_PER_RESERVATION = 1;
const MAX_ACTIVE_RESERVATIONS_PER_CLIENT = 5;
const MAX_CLIENT_COUNT_PER_RESERVATION = 5;
const CLIENT_HISTORY_RETENTION_DAYS = 7;
const APP_TIME_ZONE = env.appTimezone || "America/Bogota";

function getDateTimePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach(function (part) {
    map[part.type] = part.value;
  });

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute
  };
}

function validateStartsAt(startsAtText) {
  const startsAt = new Date(startsAtText);
  if (Number.isNaN(startsAt.getTime())) {
    throw new HttpError(400, "startsAt debe tener formato de fecha valido");
  }

  const now = Date.now();

  if (startsAt.getTime() < now) {
    throw new HttpError(400, "No se puede reservar en una fecha pasada");
  }

  const leadTimeMinutes = (startsAt.getTime() - now) / 60000;
  if (leadTimeMinutes < MIN_LEAD_TIME_MINUTES) {
    throw new HttpError(409, "La reserva debe hacerse con al menos " + MIN_LEAD_TIME_MINUTES + " minutos de anticipacion");
  }

  return startsAt;
}

function toDateKeyFromDate(date) {
  const parts = getDateTimePartsInTimeZone(date, APP_TIME_ZONE);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function toTimeKeyFromDate(date) {
  const parts = getDateTimePartsInTimeZone(date, APP_TIME_ZONE);
  return parts.hour + ":" + parts.minute;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function getReservationAgeMs(reservation) {
  const startsAt = new Date(reservation && reservation.starts_at);
  if (Number.isNaN(startsAt.getTime())) {
    return null;
  }

  return Date.now() - startsAt.getTime();
}

function isPastDueReservation(reservation) {
  const ageMs = getReservationAgeMs(reservation);
  const status = String(reservation && reservation.status || "");

  return ageMs !== null && ageMs > 0 && status !== "cancelled";
}

function getReservationStatusLabel(reservation) {
  if (!reservation) {
    return "Desconocido";
  }

  const status = String(reservation.status || "");
  const cancelledBy = String(reservation.cancelled_by_role || "");

  if (status === "cancelled") {
    if (cancelledBy === "employee" || cancelledBy === "empleado" || cancelledBy === "admin") {
      return "Cancelada por empleado";
    }

    return "Cancelada por cliente";
  }

  if (isPastDueReservation(reservation)) {
    return "Servicio atrasado/tardado";
  }

  if (status === "checked_in") {
    return "Ingreso validado";
  }

  return "Reserva activa";
}

function isVisibleToClient(reservation) {
  const status = String((reservation && reservation.status) || "");
  if (!status) {
    return false;
  }

  const ageMs = getReservationAgeMs(reservation);
  if (ageMs === null) {
    return false;
  }

  if (status === "booked" || status === "checked_in" || status === "cancelled") {
    return ageMs <= CLIENT_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  }

  return false;
}

function decorateReservation(reservation) {
  if (!reservation) {
    return reservation;
  }

  return {
    ...reservation,
    is_inasistencia: isPastDueReservation(reservation),
    status_label: getReservationStatusLabel(reservation),
    status_code: String(reservation.status || "").toUpperCase()
  };
}

function dedupeReservationsById(reservations) {
  const seen = new Map();

  (reservations || []).forEach(function (reservation) {
    const id = Number(reservation && reservation.id);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    if (!seen.has(id)) {
      seen.set(id, reservation);
    }
  });

  return Array.from(seen.values());
}

function isRangeOverlapping(startA, endA, startB, endB) {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

function isValidDateText(dateText) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateText);
}

function isValidTimeText(timeText) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeText);
}

function parseDaysCount(daysInput) {
  const parsed = Number(daysInput || 7);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 31) {
    throw new HttpError(400, "days debe ser un numero entero entre 1 y 31");
  }

  return parsed;
}

function normalizeDateText(dateInput, fieldName) {
  const dateText = String(dateInput || "").trim();
  if (!isValidDateText(dateText)) {
    throw new HttpError(400, fieldName + " debe tener formato YYYY-MM-DD");
  }

  return dateText;
}

function toMinutes(timeText) {
  const parts = timeText.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function parseServiceDuration(inputDuration) {
  const duration = Number(inputDuration);

  if (
    !Number.isInteger(duration) ||
    duration < MIN_SERVICE_DURATION_MINUTES ||
    duration > MAX_SERVICE_DURATION_MINUTES
  ) {
    throw new HttpError(
      400,
      "durationMinutes debe ser un entero entre " +
        String(MIN_SERVICE_DURATION_MINUTES) +
        " y " +
        String(MAX_SERVICE_DURATION_MINUTES)
    );
  }

  return duration;
}

function normalizeClientCount(inputCount) {
  const count = Number(inputCount);

  if (
    !Number.isInteger(count) ||
    count < MIN_CLIENT_COUNT_PER_RESERVATION ||
    count > MAX_CLIENT_COUNT_PER_RESERVATION
  ) {
    throw new HttpError(
      400,
      "clientCount debe ser un entero entre " +
        String(MIN_CLIENT_COUNT_PER_RESERVATION) +
        " y " +
        String(MAX_CLIENT_COUNT_PER_RESERVATION)
    );
  }

  return count;
}

function normalizeScheduleEntry(input) {
  const date = normalizeDateText(input.date, "date");
  const offDay = Boolean(input.offDay);
  const start = String(input.start || DEFAULT_START).trim();
  const end = String(input.end || DEFAULT_END).trim();
  const blockedHours = Array.isArray(input.blockedHours) ? input.blockedHours : [];

  if (!isValidTimeText(start) || !isValidTimeText(end)) {
    throw new HttpError(400, "start y end deben tener formato HH:MM");
  }

  if (toMinutes(start) > toMinutes(end)) {
    throw new HttpError(400, "start no puede ser mayor que end");
  }

  return { date, offDay, start, end, blockedHours };
}

function buildDateRange(startDate, daysCount) {
  const start = new Date(startDate + "T00:00:00Z");
  const dates = [];

  for (let i = 0; i < daysCount; i += 1) {
    const next = new Date(start);
    next.setUTCDate(start.getUTCDate() + i);
    dates.push(next.toISOString().slice(0, 10));
  }

  return dates;
}

function mapScheduleRows(rows) {
  const map = {};
  (rows || []).forEach(function (row) {
    map[row.work_date] = {
      offDay: Boolean(row.off_day),
      start: row.start_time,
      end: row.end_time,
      blockedHours: Array.isArray(row.blocked_hours) ? row.blocked_hours : []
    };
  });

  return map;
}

function buildServiceCatalogMaps(serviceCatalog) {
  const byId = new Map();
  const byName = new Map();

  (serviceCatalog || []).forEach(function (service) {
    const id = Number(service.id);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    byId.set(id, service);
    byName.set(String(service.name), service);
  });

  return { byId, byName };
}

async function getDurationMapForStylist(stylistId, durationMapCache) {
  if (!durationMapCache[stylistId]) {
    const rows = await listEmployeeServiceTimesByEmployee(stylistId);
    const map = new Map();

    (rows || []).forEach(function (row) {
      if (!row || !row.enabled) {
        return;
      }

      const serviceId = Number(row.service_id);
      const durationMinutes = Number(row.duration_minutes);
      if (!Number.isInteger(serviceId) || serviceId <= 0) {
        return;
      }

      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        return;
      }

      map.set(serviceId, durationMinutes);
    });

    durationMapCache[stylistId] = map;
  }

  return durationMapCache[stylistId];
}

async function resolveDurationForStylistService(
  stylistId,
  service,
  durationMapCache,
  requireEnabled
) {
  const durationMap = await getDurationMapForStylist(stylistId, durationMapCache);
  const durationMinutes = durationMap.get(Number(service.id));

  if (Number.isInteger(durationMinutes) && durationMinutes > 0) {
    return {
      enabled: true,
      durationMinutes
    };
  }

  if (requireEnabled) {
    return {
      enabled: false,
      durationMinutes: DEFAULT_SERVICE_DURATION_MINUTES
    };
  }

  return {
    enabled: false,
    durationMinutes: DEFAULT_SERVICE_DURATION_MINUTES
  };
}

async function resolveReservationDurationMinutes(
  reservation,
  serviceByName,
  stylistIdByName,
  durationMapCache
) {
  const service = serviceByName.get(String(reservation.service_name));
  if (!service) {
    return DEFAULT_SERVICE_DURATION_MINUTES;
  }

  const stylistId = Number(reservation.stylist_id) || Number(stylistIdByName[String(reservation.stylist_name)]);
  if (!Number.isInteger(stylistId) || stylistId <= 0) {
    return DEFAULT_SERVICE_DURATION_MINUTES;
  }

  const resolved = await resolveDurationForStylistService(
    stylistId,
    service,
    durationMapCache,
    false
  );

  const clientCount = Number(reservation.client_count);
  const safeClientCount = Number.isInteger(clientCount) && clientCount > 0 ? clientCount : 1;

  return resolved.durationMinutes * safeClientCount;
}

async function hasStylistOverlap(
  stylist,
  startsAt,
  endsAt,
  reservationsOfDate,
  serviceByName,
  durationMapCache,
  stylistIdByName
) {
  const stylistReservations = (reservationsOfDate || []).filter(function (reservation) {
    if (Number(reservation.stylist_id) > 0) {
      return Number(reservation.stylist_id) === Number(stylist.id);
    }

    return String(reservation.stylist_name) === String(stylist.name);
  });

  for (const reservation of stylistReservations) {
    const reservationStart = new Date(reservation.starts_at);
    if (Number.isNaN(reservationStart.getTime())) {
      continue;
    }

    const durationMinutes = await resolveReservationDurationMinutes(
      reservation,
      serviceByName,
      stylistIdByName,
      durationMapCache
    );
    const reservationEnd = addMinutes(reservationStart, durationMinutes);

    if (isRangeOverlapping(startsAt, endsAt, reservationStart, reservationEnd)) {
      return true;
    }
  }

  return false;
}

async function validateStylistWorkingSchedule(stylistId, startsAt, endsAt) {
  const dateKey = toDateKeyFromDate(startsAt);
  const startTimeKey = toTimeKeyFromDate(startsAt);
  const endTimeKey = toTimeKeyFromDate(endsAt);

  const [globalRows, employeeRows] = await Promise.all([
    listWorkScheduleByRange(dateKey, 1),
    listEmployeeWorkScheduleByRange(dateKey, 1, stylistId)
  ]);

  const merged = mergeScheduleByDate(globalRows, employeeRows, dateKey, 1);
  const config = merged[0];
  if (!config) {
    return;
  }

  if (config.offDay) {
    throw new HttpError(409, "El peluquero no trabaja en la fecha seleccionada");
  }

  if (toMinutes(startTimeKey) < toMinutes(config.start)) {
    throw new HttpError(409, "La reserva inicia antes de la jornada laboral del peluquero");
  }

  if (toMinutes(endTimeKey) > toMinutes(config.end)) {
    throw new HttpError(409, "El servicio excede la jornada laboral del peluquero");
  }
}

async function evaluateStylistCandidate(
  stylist,
  startsAt,
  clientCount,
  service,
  reservationsOfDate,
  serviceByName,
  durationMapCache,
  stylistIdByName
) {
  const durationResult = await resolveDurationForStylistService(
    stylist.id,
    service,
    durationMapCache,
    false
  );

  const totalDurationMinutes = durationResult.durationMinutes * clientCount;
  const endsAt = addMinutes(startsAt, totalDurationMinutes);
  await validateStylistWorkingSchedule(stylist.id, startsAt, endsAt);

  const overlap = await hasStylistOverlap(
    stylist,
    startsAt,
    endsAt,
    reservationsOfDate,
    serviceByName,
    durationMapCache,
    stylistIdByName
  );

  if (overlap) {
    throw new HttpError(409, "Ese peluquero ya tiene una reserva en el rango horario indicado");
  }

  return {
    stylist,
    durationMinutes: totalDurationMinutes,
    endsAt
  };
}

async function resolveStylistSelection(
  input,
  stylists,
  startsAt,
  clientCount,
  service,
  reservationsOfDate,
  serviceByName,
  durationMapCache,
  stylistIdByName
) {
  const stylistIdInput = String(input.stylistId || "").trim();
  const fallbackStylistName = String(input.stylistName || "").trim();

  if (!stylistIdInput && !fallbackStylistName) {
    throw new HttpError(400, "stylistId o stylistName es obligatorio");
  }

  if (stylistIdInput === ANY_STYLIST_VALUE || fallbackStylistName === ANY_STYLIST_VALUE) {
    for (const stylist of stylists) {
      try {
        return await evaluateStylistCandidate(
          stylist,
          startsAt,
          clientCount,
          service,
          reservationsOfDate,
          serviceByName,
          durationMapCache,
          stylistIdByName
        );
      } catch (_error) {
        continue;
      }
    }

    throw new HttpError(409, "No hay peluqueros disponibles para el horario seleccionado");
  }

  let selected = null;

  if (stylistIdInput) {
    const stylistId = Number(stylistIdInput);
    if (!Number.isInteger(stylistId) || stylistId <= 0) {
      throw new HttpError(400, "stylistId no es valido");
    }

    selected = stylists.find(function (entry) {
      return Number(entry.id) === stylistId;
    });
  } else {
    selected = stylists.find(function (entry) {
      return String(entry.name) === fallbackStylistName;
    });
  }

  if (!selected) {
    throw new HttpError(404, "El peluquero seleccionado no existe");
  }

  return evaluateStylistCandidate(
    selected,
    startsAt,
    clientCount,
    service,
    reservationsOfDate,
    serviceByName,
    durationMapCache,
    stylistIdByName
  );
}

async function enrichReservationsWithDuration(reservations) {
  const stylists = await getStylistsForCalendar();
  const stylistIdByName = {};

  (stylists || []).forEach(function (stylist) {
    stylistIdByName[String(stylist.name)] = stylist.id;
  });

  const serviceCatalog = await listServiceCatalog();
  const serviceMaps = buildServiceCatalogMaps(serviceCatalog);
  const durationMapCache = {};

  const enriched = [];
  for (const reservation of reservations || []) {
    const durationMinutes = await resolveReservationDurationMinutes(
      reservation,
      serviceMaps.byName,
      stylistIdByName,
      durationMapCache
    );

    const startsAt = new Date(reservation.starts_at);
    const endsAt = addMinutes(startsAt, durationMinutes);

    enriched.push({
      ...reservation,
      duration_minutes: durationMinutes,
      ends_at: endsAt.toISOString()
    });
  }

  return enriched;
}

async function reserveAppointment(clientId, input) {
  const serviceName = (input.serviceName || "").trim();
  const startsAt = validateStartsAt(input.startsAt);
  const clientCount = normalizeClientCount(input.clientCount || 1);

  if (!serviceName) {
    throw new HttpError(400, "serviceName es obligatorio");
  }

  const client = await findClientModerationById(clientId);
  if (!client) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  if (client.is_blocked) {
    throw new HttpError(
      403,
      client.blocked_reason
        ? "Cliente bloqueado por mal uso de la aplicacion: " + client.blocked_reason
        : "Cliente bloqueado por mal uso de la aplicacion"
    );
  }

  const activeReservationsCount = await countActiveReservationsByClient(clientId);
  if (activeReservationsCount >= MAX_ACTIVE_RESERVATIONS_PER_CLIENT) {
    throw new HttpError(
      409,
      "Has alcanzado el maximo de " + MAX_ACTIVE_RESERVATIONS_PER_CLIENT + " reservas activas. Cancela alguna existente para crear una nueva."
    );
  }

  const serviceCatalog = await listServiceCatalog();
  const serviceMaps = buildServiceCatalogMaps(serviceCatalog);
  const selectedService = serviceMaps.byName.get(serviceName);

  if (!selectedService) {
    throw new HttpError(400, "El servicio seleccionado no esta disponible");
  }

  const stylists = await getStylistsForCalendar();
  if (!stylists || stylists.length === 0) {
    throw new HttpError(409, "No hay peluqueros registrados para reservar");
  }

  const stylistIdByName = {};
  stylists.forEach(function (stylist) {
    stylistIdByName[String(stylist.name)] = stylist.id;
  });

  const dateKey = toDateKeyFromDate(startsAt);
  const reservationsOfDate = dedupeReservationsById(await listReservedByDate(dateKey));
  const durationMapCache = {};

  const selection = await resolveStylistSelection(
    input,
    stylists,
    startsAt,
    clientCount,
    selectedService,
    reservationsOfDate,
    serviceMaps.byName,
    durationMapCache,
    stylistIdByName
  );

  const qrToken = crypto.randomUUID();
  const qrDataUrl = await QRCode.toDataURL(qrToken);

  const reservation = await createReservation({
    clientId,
    serviceName,
    stylistName: selection.stylist.name,
    stylistId: selection.stylist.id,
    startsAt,
    clientCount,
    qrToken,
    qrDataUrl
  });

  const availability = await getAvailabilityByDate(dateKey);
  broadcast("availability.updated", { date: dateKey, reservedSlots: availability });

  return {
    ...decorateReservation(reservation),
    duration_minutes: selection.durationMinutes,
    ends_at: selection.endsAt.toISOString()
  };
}

async function getMyReservations(clientId) {
  const reservations = await listReservationsByClient(clientId);
  const visibleReservations = dedupeReservationsById(reservations).filter(function (reservation) {
    return isVisibleToClient(reservation);
  });

  const enriched = await enrichReservationsWithDuration(visibleReservations);

  return enriched.map(function (reservation) {
    const decorated = decorateReservation(reservation);

    if (decorated.status !== "booked") {
      delete decorated.qr_data_url;
    }

    return decorated;
  });
}

async function getAllReservations(authUser) {
  const role = String((authUser && authUser.role) || "").trim().toLowerCase();
  const employeeLikeRole = role === "empleado" || role === "employee";

  let reservations = [];
  if (employeeLikeRole) {
    reservations = await listReservationsByStylist(authUser.sub, String(authUser.name || ""));
  } else {
    reservations = await listAllReservations();
  }

  const enriched = await enrichReservationsWithDuration(dedupeReservationsById(reservations));

  return enriched.map(function (reservation) {
    const sanitized = {
      ...decorateReservation(reservation)
    };

    delete sanitized.qr_data_url;
    return sanitized;
  });
}

async function cancelMyReservation(clientId, reservationIdInput) {
  const reservationId = Number(reservationIdInput);
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    throw new HttpError(400, "reservationId debe ser un entero positivo");
  }

  const cancelled = await cancelReservationByClient(reservationId, clientId);
  if (!cancelled) {
    const existing = await findClientReservationById(reservationId, clientId);
    if (!existing) {
      throw new HttpError(404, "Reserva no encontrada");
    }

    throw new HttpError(409, "Solo se pueden cancelar reservas activas");
  }

  const reservationDate = toDateKeyFromDate(new Date(cancelled.starts_at));
  const availability = await getAvailabilityByDate(reservationDate);
  broadcast("availability.updated", { date: reservationDate, reservedSlots: availability });

  return decorateReservation(cancelled);
}

async function getAvailabilityByDate(dateText) {
  const date = normalizeDateText(dateText, "date");
  const reservations = dedupeReservationsById(await listReservedByDate(date));

  if (!reservations || reservations.length === 0) {
    return [];
  }

  return enrichReservationsWithDuration(reservations);
}

async function getWorkScheduleRange(startDateInput, daysInput) {
  const startDate = normalizeDateText(startDateInput, "start");
  const days = parseDaysCount(daysInput);
  const rows = await listWorkScheduleByRange(startDate, days);
  const indexed = mapScheduleRows(rows);

  return buildDateRange(startDate, days).map(function (date) {
    const config = indexed[date] || {
      offDay: false,
      start: DEFAULT_START,
      end: DEFAULT_END,
      blockedHours: []
    };

    return {
      date,
      offDay: config.offDay,
      start: config.start,
      end: config.end,
      blockedHours: config.blockedHours || []
    };
  });
}

function mergeScheduleByDate(globalRows, employeeRows, startDate, days) {
  const globalMap = mapScheduleRows(globalRows);
  const employeeMap = mapScheduleRows(employeeRows);

  return buildDateRange(startDate, days).map(function (date) {
    const globalConfig = globalMap[date] || {
      offDay: false,
      start: DEFAULT_START,
      end: DEFAULT_END,
      blockedHours: []
    };

    const employeeConfig = employeeMap[date] || {
      offDay: false,
      start: DEFAULT_START,
      end: DEFAULT_END,
      blockedHours: []
    };

    if (globalConfig.offDay) {
      return {
        date,
        offDay: true,
        start: globalConfig.start,
        end: globalConfig.end,
        blockedHours: globalConfig.blockedHours || []
      };
    }

    return {
      date,
      offDay: employeeConfig.offDay,
      start: employeeConfig.start,
      end: employeeConfig.end,
      blockedHours: employeeConfig.blockedHours || []
    };
  });
}

async function getWorkScheduleRangeByStylist(startDateInput, daysInput, stylistIdInput) {
  const startDate = normalizeDateText(startDateInput, "start");
  const days = parseDaysCount(daysInput);
  const stylistId = Number(stylistIdInput);

  if (!Number.isInteger(stylistId) || stylistId <= 0) {
    throw new HttpError(400, "stylistId debe ser un numero entero positivo");
  }

  const [globalRows, employeeRows] = await Promise.all([
    listWorkScheduleByRange(startDate, days),
    listEmployeeWorkScheduleByRange(startDate, days, stylistId)
  ]);

  return mergeScheduleByDate(globalRows, employeeRows, startDate, days);
}

async function getEditableWorkScheduleForUser(startDateInput, daysInput, authUser) {
  const startDate = normalizeDateText(startDateInput, "start");
  const days = parseDaysCount(daysInput);

  if (authUser.role === "admin") {
    const rows = await listWorkScheduleByRange(startDate, days);
    const indexed = mapScheduleRows(rows);

    return buildDateRange(startDate, days).map(function (date) {
      const config = indexed[date] || {
        offDay: false,
        start: DEFAULT_START,
        end: DEFAULT_END,
        blockedHours: []
      };

      return {
        date,
        offDay: config.offDay,
        start: config.start,
        end: config.end,
        blockedHours: config.blockedHours || []
      };
    });
  }

  const rows = await listEmployeeWorkScheduleByRange(startDate, days, authUser.sub);
  const indexed = mapScheduleRows(rows);

  return buildDateRange(startDate, days).map(function (date) {
    const config = indexed[date] || {
      offDay: false,
      start: DEFAULT_START,
      end: DEFAULT_END,
      blockedHours: []
    };

    return {
      date,
      offDay: config.offDay,
      start: config.start,
      end: config.end,
      blockedHours: config.blockedHours || []
    };
  });
}

async function saveWorkSchedule(entriesInput, authUser) {
  const entries = Array.isArray(entriesInput) ? entriesInput : [];
  if (entries.length === 0) {
    throw new HttpError(400, "entries debe ser un arreglo no vacio");
  }

  const normalized = entries.map(normalizeScheduleEntry);

  if (authUser.role === "admin") {
    await upsertWorkSchedule(normalized, authUser.sub);
  } else {
    await upsertEmployeeWorkSchedule(normalized, authUser.sub, authUser.sub);
  }

  const offDayEntries = normalized.filter(function (entry) {
    return entry.offDay;
  });

  for (const entry of offDayEntries) {
    await cancelReservationsByDate({
      dateText: entry.date,
      cancelledByRole: authUser.role === "admin" ? "employee" : "employee",
      cancelledByUserId: authUser.sub,
      stylistId: authUser.role === "admin" ? null : authUser.sub,
      stylistName: authUser.role === "admin" ? null : String(authUser.name || "")
    });

    const availability = await getAvailabilityByDate(entry.date);
    broadcast("availability.updated", { date: entry.date, reservedSlots: availability });
  }

  return normalized;
}

async function resetWorkScheduleRange(startDateInput, daysInput, authUser) {
  const startDate = normalizeDateText(startDateInput, "start");
  const days = parseDaysCount(daysInput);

  if (authUser.role === "admin") {
    await deleteWorkScheduleByRange(startDate, days);
  } else {
    await deleteEmployeeWorkScheduleByRange(startDate, days, authUser.sub);
  }

  return { reset: true };
}

async function listServicesForCalendar() {
  const [services, minimumDurations, allEmployeeDurations] = await Promise.all([
    listServiceCatalog(),
    listEmployeeServiceMinimumDurations(),
    listEmployeeServiceTimesForCalendar()
  ]);

  const durationByServiceId = new Map();
  (minimumDurations || []).forEach(function (entry) {
    const serviceId = Number(entry.service_id);
    const minDuration = Number(entry.min_duration_minutes);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return;
    }

    if (!Number.isInteger(minDuration) || minDuration <= 0) {
      return;
    }

    durationByServiceId.set(serviceId, minDuration);
  });

  const byServiceStylist = new Map();
  (allEmployeeDurations || []).forEach(function (entry) {
    const serviceId = Number(entry.service_id);
    const employeeId = Number(entry.employee_id);
    const duration = Number(entry.duration_minutes);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return;
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return;
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      return;
    }

    if (!byServiceStylist.has(serviceId)) {
      byServiceStylist.set(serviceId, {});
    }

    byServiceStylist.get(serviceId)[String(employeeId)] = duration;
  });

  return (services || []).map(function (service) {
    const serviceId = Number(service.id);
    const durationMinutes = durationByServiceId.get(serviceId);
    const stylistDurations = byServiceStylist.get(serviceId) || {};

    return {
      ...service,
      duration_minutes: Number.isInteger(durationMinutes)
        ? durationMinutes
        : DEFAULT_SERVICE_DURATION_MINUTES,
      stylist_durations: stylistDurations
    };
  });
}

async function listServicesForEmployeeCalendar(employeeId) {
  const employeeIdNumber = Number(employeeId);
  if (!Number.isInteger(employeeIdNumber) || employeeIdNumber <= 0) {
    throw new HttpError(400, "employeeId debe ser un numero entero positivo");
  }

  const [services, employeeRows] = await Promise.all([
    listEnabledServicesForEmployee(employeeIdNumber),
    listEmployeeServiceTimesByEmployee(employeeIdNumber)
  ]);

  const durationByServiceId = new Map();
  (employeeRows || []).forEach(function (row) {
    if (!row || !row.enabled) {
      return;
    }

    const serviceId = Number(row.service_id);
    const durationMinutes = Number(row.duration_minutes);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return;
    }

    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      return;
    }

    durationByServiceId.set(serviceId, durationMinutes);
  });

  return (services || []).map(function (service) {
    const serviceId = Number(service.id);
    const durationMinutes = durationByServiceId.get(serviceId);

    return {
      id: serviceId,
      name: service.name,
      duration_minutes: Number.isInteger(durationMinutes)
        ? durationMinutes
        : DEFAULT_SERVICE_DURATION_MINUTES,
      stylist_durations: {
        [String(employeeIdNumber)]: Number.isInteger(durationMinutes)
          ? durationMinutes
          : DEFAULT_SERVICE_DURATION_MINUTES
      }
    };
  });
}

async function createServiceByAdmin(input, authUserId) {
  const name = String((input && input.name) || "").trim();
  if (!name) {
    throw new HttpError(400, "name es obligatorio");
  }

  const existing = await listServiceCatalog();
  if (
    existing.some(function (entry) {
      return entry.name.toLowerCase() === name.toLowerCase();
    })
  ) {
    throw new HttpError(409, "El servicio ya existe");
  }

  return createServiceCatalogEntry(name, authUserId);
}

async function deleteServiceByAdmin(serviceIdInput) {
  const serviceId = Number(serviceIdInput);
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw new HttpError(400, "serviceId debe ser un entero positivo");
  }

  const deleted = await deleteServiceCatalogEntry(serviceId);
  if (!deleted) {
    throw new HttpError(404, "Servicio no encontrado");
  }

  return deleted;
}

async function getEmployeeServiceTimesByAdmin(employeeIdInput) {
  const employeeId = Number(employeeIdInput);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new HttpError(400, "employeeId debe ser un entero positivo");
  }

  const stylists = await getStylistsForCalendar();
  const employee = (stylists || []).find(function (stylist) {
    return Number(stylist.id) === employeeId;
  });

  if (!employee) {
    throw new HttpError(400, "Solo se pueden configurar tiempos para usuarios con rol empleado");
  }

  const rows = await listEmployeeServiceTimesByEmployee(employeeId);

  return {
    employee,
    services: (rows || []).map(function (row) {
      return {
        serviceId: Number(row.service_id),
        name: row.name,
        enabled: Boolean(row.enabled),
        durationMinutes: row.duration_minutes
          ? Number(row.duration_minutes)
          : DEFAULT_SERVICE_DURATION_MINUTES
      };
    })
  };
}

async function saveEmployeeServiceTimesByAdmin(employeeIdInput, entriesInput, authUserId) {
  const employeeId = Number(employeeIdInput);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new HttpError(400, "employeeId debe ser un entero positivo");
  }

  const stylists = await getStylistsForCalendar();
  const employeeExists = (stylists || []).some(function (stylist) {
    return Number(stylist.id) === employeeId;
  });

  if (!employeeExists) {
    throw new HttpError(400, "Solo se pueden configurar tiempos para usuarios con rol empleado");
  }

  const serviceCatalog = await listServiceCatalog();
  const serviceMaps = buildServiceCatalogMaps(serviceCatalog);
  const entries = Array.isArray(entriesInput) ? entriesInput : [];
  const normalized = [];
  const usedServiceIds = new Set();

  for (const entry of entries) {
    const serviceId = Number(entry && entry.serviceId);
    const enabled = Boolean(entry && entry.enabled);

    if (!Number.isInteger(serviceId) || serviceId <= 0 || !serviceMaps.byId.has(serviceId)) {
      throw new HttpError(400, "serviceId invalido en entries");
    }

    if (usedServiceIds.has(serviceId)) {
      throw new HttpError(400, "No se puede repetir serviceId en entries");
    }

    usedServiceIds.add(serviceId);

    if (!enabled) {
      continue;
    }

    normalized.push({
      serviceId,
      durationMinutes: parseServiceDuration(entry.durationMinutes)
    });
  }

  await saveEmployeeServiceTimes(employeeId, normalized, authUserId);

  return getEmployeeServiceTimesByAdmin(employeeId);
}

module.exports = {
  reserveAppointment,
  cancelMyReservation,
  getMyReservations,
  getAllReservations,
  getAvailabilityByDate,
  getWorkScheduleRange,
  getWorkScheduleRangeByStylist,
  getEditableWorkScheduleForUser,
  saveWorkSchedule,
  resetWorkScheduleRange,
  listServicesForCalendar,
  listServicesForEmployeeCalendar,
  createServiceByAdmin,
  deleteServiceByAdmin,
  getEmployeeServiceTimesByAdmin,
  saveEmployeeServiceTimesByAdmin
};
