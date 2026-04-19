const {
  homeView,
  loginView,
  clientView,
  clientCalendarView,
  employeeView,
  employeeCalendarView,
  employeeVerifyClientsView,
  employeeValidateQrView,
  employeeClientModerationView,
  adminView,
  adminCalendarView,
  adminVerifyClientsView,
  adminValidateQrView,
  adminClientModerationView
} = require("./ui.view");

function homeController(_req, res) {
  res.type("html").send(homeView());
}

function loginController(_req, res) {
  res.type("html").send(loginView());
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

function employeeClientModerationController(_req, res) {
  res.type("html").send(employeeClientModerationView());
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

function adminClientModerationController(_req, res) {
  res.type("html").send(adminClientModerationView());
}

module.exports = {
  homeController,
  loginController,
  clientController,
  clientCalendarController,
  employeeController,
  employeeCalendarController,
  employeeVerifyClientsController,
  employeeValidateQrController,
  employeeClientModerationController,
  adminController,
  adminCalendarController,
  adminVerifyClientsController,
  adminValidateQrController,
  adminClientModerationController
};
