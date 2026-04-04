const crypto = require("crypto");
const QRCode = require("qrcode");
const { HttpError } = require("../../shared/httpError");
const { broadcast } = require("../../integrations/realtime/wsHub");
const {
  createReservation,
  findOverlappingReservation,
  listReservationsByClient,
  listAllReservations,
  listReservedByDate,
  listWorkScheduleByRange,
  upsertWorkSchedule,
  deleteWorkScheduleByRange
} = require("./reservations.model");

const DEFAULT_START = "06:00";
const DEFAULT_END = "22:00";

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
  const stylistName = (input.stylistName || "").trim();
  const startsAt = validateStartsAt(input.startsAt);
  const clientCount = Number(input.clientCount || 1);

  if (!serviceName || !stylistName) {
    throw new HttpError(400, "serviceName y stylistName son obligatorios");
  }

  if (!Number.isInteger(clientCount) || clientCount <= 0) {
    throw new HttpError(400, "clientCount debe ser un entero mayor a 0");
  }

  const overlap = await findOverlappingReservation({
    stylistName,
    startsAt
  });

  if (overlap) {
    throw new HttpError(409, "Ese peluquero ya tiene una reserva en la fecha/hora indicada");
  }

  const qrToken = crypto.randomUUID();
  const qrDataUrl = await QRCode.toDataURL(qrToken);

  const reservation = await createReservation({
    clientId,
    serviceName,
    stylistName,
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

async function saveWorkSchedule(entriesInput, updatedBy) {
  const entries = Array.isArray(entriesInput) ? entriesInput : [];
  if (entries.length === 0) {
    throw new HttpError(400, "entries debe ser un arreglo no vacio");
  }

  const normalized = entries.map(normalizeScheduleEntry);
  await upsertWorkSchedule(normalized, updatedBy);

  return normalized;
}

async function resetWorkScheduleRange(startDateInput, daysInput) {
  const startDate = normalizeDateText(startDateInput, "start");
  const days = parseDaysCount(daysInput);
  await deleteWorkScheduleByRange(startDate, days);

  return { reset: true };
}

module.exports = {
  reserveAppointment,
  getMyReservations,
  getAllReservations,
  getAvailabilityByDate,
  getWorkScheduleRange,
  saveWorkSchedule,
  resetWorkScheduleRange
};
