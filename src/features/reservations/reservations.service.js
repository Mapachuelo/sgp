const crypto = require("crypto");
const QRCode = require("qrcode");
const { HttpError } = require("../../shared/httpError");
const { broadcast } = require("../../integrations/realtime/wsHub");
const {
  createReservation,
  findOverlappingReservation,
  listReservationsByClient,
  listAllReservations,
  listReservedByDate
} = require("./reservations.model");

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

module.exports = {
  reserveAppointment,
  getMyReservations,
  getAllReservations,
  getAvailabilityByDate
};
