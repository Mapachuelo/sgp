const { homeView, clientView, employeeView, adminView } = require("./ui.view");

function homeController(_req, res) {
  res.type("html").send(homeView());
}

function clientController(_req, res) {
  res.type("html").send(clientView());
}

function employeeController(_req, res) {
  res.type("html").send(employeeView());
}

function adminController(_req, res) {
  res.type("html").send(adminView());
}

module.exports = {
  homeController,
  clientController,
  employeeController,
  adminController
};
