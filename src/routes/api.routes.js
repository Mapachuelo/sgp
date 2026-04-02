const express = require("express");
const { authRouter } = require("../features/auth/auth.routes");
const { clientsRouter } = require("../features/clients/clients.routes");
const { reservationsRouter } = require("../features/reservations/reservations.routes");
const { checkinRouter } = require("../features/checkin/checkin.routes");
const { paymentsRouter } = require("../features/payments/payments.routes");
const { reportsRouter } = require("../features/reports/reports.routes");

const router = express.Router();

router.use("/auth", authRouter);
router.use("/clients", clientsRouter);
router.use("/reservations", reservationsRouter);
router.use("/checkin", checkinRouter);
router.use("/payments", paymentsRouter);
router.use("/reports", reportsRouter);

module.exports = { apiRouter: router };
