const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const {
  dailySalesController,
  occupancyController,
  recurrentClientsController
} = require("./reports.controller");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));
router.get("/daily-sales", dailySalesController);
router.get("/occupancy", occupancyController);
router.get("/recurrent-clients", recurrentClientsController);

module.exports = { reportsRouter: router };
