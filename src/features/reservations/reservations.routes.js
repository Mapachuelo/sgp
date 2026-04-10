const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const {
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
} = require("./reservations.controller");

const router = express.Router();

router.get("/availability", availabilityController);
router.get("/services", listServicesController);
router.post("/services", requireAuth, requireRole("admin"), createServiceController);
router.delete("/services/:serviceId", requireAuth, requireRole("admin"), deleteServiceController);
router.get(
  "/employee-service-times",
  requireAuth,
  requireRole("admin"),
  employeeServiceTimesController
);
router.put(
  "/employee-service-times",
  requireAuth,
  requireRole("admin"),
  saveEmployeeServiceTimesController
);
router.get("/work-schedule", getWorkScheduleController);
router.get(
  "/work-schedule/editable",
  requireAuth,
  requireRole("empleado", "admin"),
  getEditableWorkScheduleController
);
router.put("/work-schedule", requireAuth, requireRole("empleado", "admin"), saveWorkScheduleController);
router.delete(
  "/work-schedule",
  requireAuth,
  requireRole("empleado", "admin"),
  resetWorkScheduleController
);
router.post("/", requireAuth, requireRole("client"), createReservationController);
router.get("/me", requireAuth, requireRole("client"), myReservationsController);
router.delete("/me/:reservationId", requireAuth, requireRole("client"), cancelMyReservationController);
router.get("/", requireAuth, requireRole("empleado", "admin"), listReservationsController);

module.exports = { reservationsRouter: router };
