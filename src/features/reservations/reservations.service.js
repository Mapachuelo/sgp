const crypto = require("crypto");
const QRCode = require("qrcode");
const { HttpError } = require("../../shared/httpError");
const { broadcast } = require("../../integrations/realtime/wsHub");
const { getStylistsForCalendar } = require("../auth/auth.service");
const {
  createReservation,
  findOverlappingReservation,
  listReservationsByClient,
  listAllReservations,
  listReservedByDate,
  listWorkScheduleByRange,
  listEmployeeWorkScheduleByRange,
  upsertWorkSchedule,
  upsertEmployeeWorkSchedule,
  deleteWorkScheduleByRange,
  deleteEmployeeWorkScheduleByRange,
  listServiceCatalog,
  createServiceCatalogEntry,
  deleteServiceCatalogEntry
} = require("./reservations.model");

const DEFAULT_START = "06:00";
const DEFAULT_END = "22:00";
const ANY_STYLIST_VALUE = "__any__";

function validateStartsAt(startsAtText) {
  const startsAt = new Date(startsAtText);
  if (Number.isNaN(startsAt.getTime())) {
    throw new HttpError(400, "startsAt debe tener formato de fecha valido");
  }

  if (startsAt.getTime() < Date.now()) {
    throw new HttpError(400, "No se puede reservar en una fecha pasada");
  }

  return startsAt;
}

async function reserveAppointment(clientId, input) {
  const serviceName = (input.serviceName || "").trim();
  const startsAt = validateStartsAt(input.startsAt);
  const clientCount = Number(input.clientCount || 1);

  if (!serviceName) {
    throw new HttpError(400, "serviceName es obligatorio");
  }

  if (!Number.isInteger(clientCount) || clientCount <= 0) {
    throw new HttpError(400, "clientCount debe ser un entero mayor a 0");
  }

  const serviceCatalog = await listServiceCatalog();
  const isKnownService = serviceCatalog.some(function (entry) {
    return String(entry.name) === serviceName;
  });

  if (!isKnownService) {
    throw new HttpError(400, "El servicio seleccionado no esta disponible");
  }

  const stylists = await getStylistsForCalendar();
  if (!stylists || stylists.length === 0) {
    throw new HttpError(409, "No hay peluqueros registrados para reservar");
  }

  const selectedStylist = await resolveStylistSelection(input, stylists, startsAt);

  const overlap = await findOverlappingReservation({
    stylistName: selectedStylist.name,
    startsAt
  });

  if (overlap) {
    throw new HttpError(409, "Ese peluquero ya tiene una reserva en la fecha/hora indicada");
  }

  await validateStylistWorkingSchedule(selectedStylist.id, startsAt);

  const qrToken = crypto.randomUUID();
  const qrDataUrl = await QRCode.toDataURL(qrToken);

  const reservation = await createReservation({
    clientId,
    serviceName,
    stylistName: selectedStylist.name,
    startsAt,
    clientCount,
    qrToken,
    qrDataUrl
  });

  const date = startsAt.toISOString().slice(0, 10);
  const availability = await listReservedByDate(date);
  broadcast("availability.updated", { date, reservedSlots: availability });

  return reservation;
}

async function getMyReservations(clientId) {
  return listReservationsByClient(clientId);
}

async function getAllReservations() {
  return listAllReservations();
}

async function getAvailabilityByDate(dateText) {
  const date = (dateText || "").trim();
  if (!date) {
    throw new HttpError(400, "date es obligatorio con formato YYYY-MM-DD");
  }

  return listReservedByDate(date);
}

function toDateKeyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function toTimeKeyFromDate(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return hours + ":" + minutes;
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

function normalizeScheduleEntry(input) {
  const date = normalizeDateText(input.date, "date");
  const offDay = Boolean(input.offDay);
  const start = String(input.start || DEFAULT_START).trim();
  const end = String(input.end || DEFAULT_END).trim();

  if (!isValidTimeText(start) || !isValidTimeText(end)) {
    throw new HttpError(400, "start y end deben tener formato HH:MM");
  }

  if (toMinutes(start) > toMinutes(end)) {
    throw new HttpError(400, "start no puede ser mayor que end");
  }

  return { date, offDay, start, end };
}

function buildDateRange(startDate, daysCount) {
  const start = new Date(startDate + "T00:00:00");
  const dates = [];

  for (let i = 0; i < daysCount; i += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
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
      end: row.end_time
    };
  });

  return map;
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
      end: DEFAULT_END
    };

    return {
      date,
      offDay: config.offDay,
      start: config.start,
      end: config.end
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
      end: DEFAULT_END
    };

    const employeeConfig = employeeMap[date] || {
      offDay: false,
      start: DEFAULT_START,
      end: DEFAULT_END
    };

    if (globalConfig.offDay) {
      return {
        date,
        offDay: true,
        start: globalConfig.start,
        end: globalConfig.end
      };
    }

    return {
      date,
      offDay: employeeConfig.offDay,
      start: employeeConfig.start,
      end: employeeConfig.end
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
        end: DEFAULT_END
      };

      return {
        date,
        offDay: config.offDay,
        start: config.start,
        end: config.end
      };
    });
  }

  const rows = await listEmployeeWorkScheduleByRange(startDate, days, authUser.sub);
  const indexed = mapScheduleRows(rows);

  return buildDateRange(startDate, days).map(function (date) {
    const config = indexed[date] || {
      offDay: false,
      start: DEFAULT_START,
      end: DEFAULT_END
    };

    return {
      date,
      offDay: config.offDay,
      start: config.start,
      end: config.end
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
  return listServiceCatalog();
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

async function resolveStylistSelection(input, stylists, startsAt) {
  const stylistIdInput = String(input.stylistId || "").trim();
  const fallbackStylistName = String(input.stylistName || "").trim();

  if (!stylistIdInput && !fallbackStylistName) {
    throw new HttpError(400, "stylistId o stylistName es obligatorio");
  }

  if (stylistIdInput === ANY_STYLIST_VALUE || fallbackStylistName === ANY_STYLIST_VALUE) {
    for (const stylist of stylists) {
      const overlap = await findOverlappingReservation({
        stylistName: stylist.name,
        startsAt
      });

      if (overlap) {
        continue;
      }

      try {
        await validateStylistWorkingSchedule(stylist.id, startsAt);
        return stylist;
      } catch (_error) {
        continue;
      }
    }

    throw new HttpError(409, "No hay peluqueros disponibles para el horario seleccionado");
  }

  if (stylistIdInput) {
    const stylistId = Number(stylistIdInput);
    if (!Number.isInteger(stylistId) || stylistId <= 0) {
      throw new HttpError(400, "stylistId no es valido");
    }

    const selected = stylists.find(function (entry) {
      return Number(entry.id) === stylistId;
    });

    if (!selected) {
      throw new HttpError(404, "El peluquero seleccionado no existe");
    }

    return selected;
  }

  const byName = stylists.find(function (entry) {
    return String(entry.name) === fallbackStylistName;
  });

  if (!byName) {
    throw new HttpError(404, "El peluquero seleccionado no existe");
  }

  return byName;
}

async function validateStylistWorkingSchedule(stylistId, startsAt) {
  const dateKey = toDateKeyFromDate(startsAt);
  const timeKey = toTimeKeyFromDate(startsAt);

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

  if (toMinutes(timeKey) < toMinutes(config.start) || toMinutes(timeKey) > toMinutes(config.end)) {
    throw new HttpError(409, "El horario seleccionado esta fuera de la jornada del peluquero");
  }
}

module.exports = {
  reserveAppointment,
  getMyReservations,
  getAllReservations,
  getAvailabilityByDate,
  getWorkScheduleRange,
  getWorkScheduleRangeByStylist,
  getEditableWorkScheduleForUser,
  saveWorkSchedule,
  resetWorkScheduleRange,
  listServicesForCalendar,
  createServiceByAdmin,
  deleteServiceByAdmin
};
