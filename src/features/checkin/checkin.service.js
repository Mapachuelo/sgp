const { HttpError } = require("../../shared/httpError");
const {
  findReservationByQrToken,
  markReservationCheckin
} = require("./checkin.model");

function isWithinValidationWindow(startsAt) {
  const now = Date.now();
  const appointmentTime = new Date(startsAt).getTime();
  const diffMinutes = Math.abs((appointmentTime - now) / 60000);

  return diffMinutes <= 120;
}

async function validateQrEntry(input) {
  const qrToken = (input.qrToken || "").trim();
  if (!qrToken) {
    throw new HttpError(400, "qrToken es obligatorio");
  }

  const reservation = await findReservationByQrToken(qrToken);
  if (!reservation) {
    throw new HttpError(404, "QR no asociado a una reserva");
  }

  if (reservation.status !== "booked") {
    throw new HttpError(409, "La reserva ya fue validada o no esta activa");
  }

  if (!isWithinValidationWindow(reservation.starts_at)) {
    throw new HttpError(409, "La reserva esta fuera de la ventana horaria de validacion");
  }

  return markReservationCheckin(reservation.id);
}

module.exports = {
  validateQrEntry
};
