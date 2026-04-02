const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const {
  createReservationController,
  myReservationsController,
  listReservationsController,
  availabilityController
} = require("./reservations.controller");

const router = express.Router();

router.get("/availability", availabilityController);
router.post("/", requireAuth, requireRole("client"), createReservationController);
router.get("/me", requireAuth, requireRole("client"), myReservationsController);
router.get("/", requireAuth, requireRole("employee", "admin"), listReservationsController);

module.exports = { reservationsRouter: router };
