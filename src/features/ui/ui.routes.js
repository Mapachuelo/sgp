const express = require("express");
const {
  homeController,
  clientController,
  employeeController,
  adminController
} = require("./ui.controller");

const router = express.Router();

router.get("/", homeController);
router.get("/ui/client", clientController);
router.get("/ui/employee", employeeController);
router.get("/ui/admin", adminController);

module.exports = { uiRouter: router };
