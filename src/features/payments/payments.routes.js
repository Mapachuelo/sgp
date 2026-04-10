const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const { manualPaymentController } = require("./payments.controller");

const router = express.Router();

router.post(
  "/manual",
  requireAuth,
  requireRole("empleado", "admin"),
  manualPaymentController
);

module.exports = { paymentsRouter: router };
