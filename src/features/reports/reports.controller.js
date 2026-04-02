const { asyncHandler } = require("../../shared/asyncHandler");
const {
  getDailySalesReport,
  getOccupancyReport,
  getRecurrentClientsReport
} = require("./reports.service");

const dailySalesController = asyncHandler(async (req, res) => {
  const data = await getDailySalesReport(req.query.date);
  res.json({ ok: true, data });
});

const occupancyController = asyncHandler(async (req, res) => {
  const data = await getOccupancyReport(req.query.date);
  res.json({ ok: true, data });
});

const recurrentClientsController = asyncHandler(async (req, res) => {
  const data = await getRecurrentClientsReport(req.query.limit);
  res.json({ ok: true, data });
});

module.exports = {
  dailySalesController,
  occupancyController,
  recurrentClientsController
};
