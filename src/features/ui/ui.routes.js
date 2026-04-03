const express = require("express");
const {
  homeController,
  clientController,
  clientCalendarController,
  employeeController,
  employeeCalendarController,
  employeeVerifyClientsController,
  employeeValidateQrController,
  adminController
} = require("./ui.controller");

const router = express.Router();

router.get("/", homeController);
router.get("/ui/client", clientController);
router.get("/ui/client/calendar", clientCalendarController);
router.get("/ui/employee", employeeController);
router.get("/ui/employee/calendar", employeeCalendarController);
router.get("/ui/employee/verify-clients", employeeVerifyClientsController);
router.get("/ui/employee/validate-qr", employeeValidateQrController);
router.get("/ui/admin", adminController);

module.exports = { uiRouter: router };
