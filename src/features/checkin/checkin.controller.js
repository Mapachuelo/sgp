const { asyncHandler } = require("../../shared/asyncHandler");
const { validateQrEntry } = require("./checkin.service");

const validateQrController = asyncHandler(async (req, res) => {
  const data = await validateQrEntry(req.body);
  res.json({ ok: true, data });
});

module.exports = {
  validateQrController
};
