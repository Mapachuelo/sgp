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
  saveWorkScheduleController,
  resetWorkScheduleController
} = require("./reservations.controller");

const router = express.Router();

router.get("/availability", availabilityController);
router.get("/work-schedule", getWorkScheduleController);
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
