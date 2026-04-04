const {
  homeView,
  clientView,
  clientCalendarView,
  employeeView,
  employeeCalendarView,
  employeeVerifyClientsView,
  employeeValidateQrView,
  adminView,
  adminCalendarView,
  adminVerifyClientsView,
  adminValidateQrView
} = require("./ui.view");

function homeController(_req, res) {
  res.type("html").send(homeView());
}

function clientController(_req, res) {
  res.type("html").send(clientView());
}

function clientCalendarController(_req, res) {
  res.type("html").send(clientCalendarView());
}

function employeeController(_req, res) {
  res.type("html").send(employeeView());
}

function employeeCalendarController(_req, res) {
  res.type("html").send(employeeCalendarView());
}

function employeeVerifyClientsController(_req, res) {
  res.type("html").send(employeeVerifyClientsView());
}

function employeeValidateQrController(_req, res) {
  res.type("html").send(employeeValidateQrView());
}

function adminController(_req, res) {
  res.type("html").send(adminView());
}

function adminCalendarController(_req, res) {
  res.type("html").send(adminCalendarView());
}

function adminVerifyClientsController(_req, res) {
  res.type("html").send(adminVerifyClientsView());
}

function adminValidateQrController(_req, res) {
  res.type("html").send(adminValidateQrView());
}

module.exports = {
  homeController,
  clientController,
  clientCalendarController,
  employeeController,
  employeeCalendarController,
  employeeVerifyClientsController,
  employeeValidateQrController,
  adminController,
  adminCalendarController,
  adminVerifyClientsController,
  adminValidateQrController
};
