const express = require("express");
const {
  loginController,
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
} = require("./ui.controller");

const router = express.Router();

function redirectToEmpleado(req, res) {
  const nextPath = req.originalUrl.replace("/ui/employee", "/ui/empleado");
  res.redirect(302, nextPath);
}

function redirectRootToClient(_req, res) {
  res.redirect(302, "/ui/client");
}

router.get("/", redirectRootToClient);
router.get("/ui/login", loginController);
router.get("/ui/client", clientController);
router.get("/ui/client/calendar", clientCalendarController);
router.get("/ui/empleado", employeeController);
router.get("/ui/empleado/calendar", employeeCalendarController);
router.get("/ui/empleado/verify-clients", employeeVerifyClientsController);
router.get("/ui/empleado/validate-qr", employeeValidateQrController);
router.get("/ui/employee", redirectToEmpleado);
router.get("/ui/employee/calendar", redirectToEmpleado);
router.get("/ui/employee/verify-clients", redirectToEmpleado);
router.get("/ui/employee/validate-qr", redirectToEmpleado);
router.get("/ui/admin", adminController);
router.get("/ui/admin/calendar", adminCalendarController);
router.get("/ui/admin/verify-clients", adminVerifyClientsController);
router.get("/ui/admin/validate-qr", adminValidateQrController);

module.exports = { uiRouter: router };
