const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const {
  createReservationController,
  myReservationsController,
  listReservationsController,
  availabilityController,
  getWorkScheduleController,
  getEditableWorkScheduleController,
  saveWorkScheduleController,
  resetWorkScheduleController,
  listServicesController,
  createServiceController,
  deleteServiceController
} = require("./reservations.controller");

const router = express.Router();

router.get("/availability", availabilityController);
router.get("/services", listServicesController);
router.post("/services", requireAuth, requireRole("admin"), createServiceController);
router.delete("/services/:serviceId", requireAuth, requireRole("admin"), deleteServiceController);
router.get("/work-schedule", getWorkScheduleController);
router.get(
  "/work-schedule/editable",
  requireAuth,
  requireRole("employee", "admin"),
  getEditableWorkScheduleController
);
router.put("/work-schedule", requireAuth, requireRole("employee", "admin"), saveWorkScheduleController);
router.delete(
  "/work-schedule",
  requireAuth,
  requireRole("employee", "admin"),
  resetWorkScheduleController
);
router.post("/", requireAuth, requireRole("client"), createReservationController);
router.get("/me", requireAuth, requireRole("client"), myReservationsController);
router.get("/", requireAuth, requireRole("employee", "admin"), listReservationsController);

module.exports = { reservationsRouter: router };
