const { HttpError } = require("../../shared/httpError");
const {
  findReservationById,
  findPaymentByReservationId,
  createManualPayment
} = require("./payments.model");

async function registerManualPayment(stylistId, input) {
  const reservationId = Number(input.reservationId);
  const amount = Number(input.amount);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    throw new HttpError(400, "reservationId debe ser entero positivo");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "amount debe ser mayor a 0");
  }

  const reservation = await findReservationById(reservationId);
  if (!reservation) {
    throw new HttpError(404, "Reserva no encontrada");
  }

  const exists = await findPaymentByReservationId(reservationId);
  if (exists) {
    throw new HttpError(409, "La reserva ya tiene cobro registrado");
  }

  if (!["booked", "checked_in"].includes(reservation.status)) {
    throw new HttpError(409, "La reserva no esta en estado valido para cobro manual");
  }

  return createManualPayment({
    reservationId,
    stylistId,
    amount
  });
}

module.exports = {
  registerManualPayment
};
