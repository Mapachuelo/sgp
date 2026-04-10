const { asyncHandler } = require("../../shared/asyncHandler");
const {
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
} = require("./reservations.service");

const createReservationController = asyncHandler(async (req, res) => {
  const data = await reserveAppointment(req.auth.sub, req.body);
  res.status(201).json({ ok: true, data });
});

const myReservationsController = asyncHandler(async (req, res) => {
  const data = await getMyReservations(req.auth.sub);
  res.json({ ok: true, data });
});

const cancelMyReservationController = asyncHandler(async (req, res) => {
  const data = await cancelMyReservation(req.auth.sub, req.params.reservationId);
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

const getWorkScheduleController = asyncHandler(async (req, res) => {
  const stylistId = req.query.stylistId;
  const data = stylistId
    ? await getWorkScheduleRangeByStylist(req.query.start, req.query.days, stylistId)
    : await getWorkScheduleRange(req.query.start, req.query.days);
  res.json({ ok: true, data });
});

const getEditableWorkScheduleController = asyncHandler(async (req, res) => {
  const data = await getEditableWorkScheduleForUser(req.query.start, req.query.days, req.auth);
  res.json({ ok: true, data });
});

const saveWorkScheduleController = asyncHandler(async (req, res) => {
  const data = await saveWorkSchedule(req.body.entries, req.auth);
  res.json({ ok: true, data });
});

const resetWorkScheduleController = asyncHandler(async (req, res) => {
  const data = await resetWorkScheduleRange(req.query.start, req.query.days, req.auth);
  res.json({ ok: true, data });
});

const listServicesController = asyncHandler(async (req, res) => {
  const role = req.auth && req.auth.role;
  const data = role === "empleado"
    ? await listServicesForEmployeeCalendar(req.auth.sub)
    : await listServicesForCalendar();
  res.json({ ok: true, data });
});

const createServiceController = asyncHandler(async (req, res) => {
  const data = await createServiceByAdmin(req.body, req.auth.sub);
  res.status(201).json({ ok: true, data });
});

const deleteServiceController = asyncHandler(async (req, res) => {
  const data = await deleteServiceByAdmin(req.params.serviceId);
  res.json({ ok: true, data });
});

const employeeServiceTimesController = asyncHandler(async (req, res) => {
  const data = await getEmployeeServiceTimesByAdmin(req.query.employeeId);
  res.json({ ok: true, data });
});

const saveEmployeeServiceTimesController = asyncHandler(async (req, res) => {
  const data = await saveEmployeeServiceTimesByAdmin(
    req.query.employeeId,
    req.body.entries,
    req.auth.sub
  );
  res.json({ ok: true, data });
});

module.exports = {
  createReservationController,
  myReservationsController,
  cancelMyReservationController,
  listReservationsController,
  availabilityController,
  getWorkScheduleController,
  getEditableWorkScheduleController,
  saveWorkScheduleController,
  resetWorkScheduleController,
  listServicesController,
  createServiceController,
  deleteServiceController,
  employeeServiceTimesController,
  saveEmployeeServiceTimesController
};
