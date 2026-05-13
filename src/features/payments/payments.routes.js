const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const { paymentLimiter } = require("../../shared/middlewares/rateLimit.middleware");
const { manualPaymentController } = require("./payments.controller");

const router = express.Router();

router.post(
  "/manual",
  paymentLimiter,
  requireAuth,
  requireRole("empleado", "admin"),
  manualPaymentController
);

module.exports = { paymentsRouter: router };
