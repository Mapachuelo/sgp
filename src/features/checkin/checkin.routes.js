const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const { validateQrController } = require("./checkin.controller");

const router = express.Router();

router.post("/validate", requireAuth, requireRole("empleado", "admin"), validateQrController);

module.exports = { checkinRouter: router };
