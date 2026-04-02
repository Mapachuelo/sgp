const { asyncHandler } = require("../../shared/asyncHandler");
const { registerManualPayment } = require("./payments.service");

const manualPaymentController = asyncHandler(async (req, res) => {
  const data = await registerManualPayment(req.auth.sub, req.body);
  res.status(201).json({ ok: true, data });
});

module.exports = {
  manualPaymentController
};
