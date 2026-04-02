const { asyncHandler } = require("../../shared/asyncHandler");
const {
  reserveAppointment,
  getMyReservations,
  getAllReservations,
  getAvailabilityByDate
} = require("./reservations.service");

const createReservationController = asyncHandler(async (req, res) => {
  const data = await reserveAppointment(req.auth.sub, req.body);
  res.status(201).json({ ok: true, data });
});

const myReservationsController = asyncHandler(async (req, res) => {
  const data = await getMyReservations(req.auth.sub);
  res.json({ ok: true, data });
});

const listReservationsController = asyncHandler(async (_req, res) => {
  const data = await getAllReservations();
  res.json({ ok: true, data });
});

const availabilityController = asyncHandler(async (req, res) => {
  const data = await getAvailabilityByDate(req.query.date);
  res.json({ ok: true, data });
});

module.exports = {
  createReservationController,
  myReservationsController,
  listReservationsController,
  availabilityController
};
