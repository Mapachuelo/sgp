const { HttpError } = require("../../shared/httpError");
const {
  getDailySales,
  getDailyOccupancy,
  getRecurrentClients
} = require("./reports.model");

function normalizeDate(dateText) {
  const date = (dateText || "").trim();
  if (!date) {
    throw new HttpError(400, "date es obligatorio con formato YYYY-MM-DD");
  }

  const dateObject = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dateObject.getTime())) {
    throw new HttpError(400, "date tiene formato invalido");
  }

  return date;
}

async function getDailySalesReport(dateText) {
  const date = normalizeDate(dateText);
  return getDailySales(date);
}

async function getOccupancyReport(dateText) {
  const date = normalizeDate(dateText);
  return getDailyOccupancy(date);
}

async function getRecurrentClientsReport(limitText) {
  const limit = Number(limitText || 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new HttpError(400, "limit debe ser entero positivo");
  }

  return getRecurrentClients(limit);
}

module.exports = {
  getDailySalesReport,
  getOccupancyReport,
  getRecurrentClientsReport
};
