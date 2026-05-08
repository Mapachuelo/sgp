const express = require("express");
const {
  homeController,
  loginController,
  clientController,
  clientCalendarController,
  employeeController,
  employeeVerifyClientsController,
  employeeValidateQrController,
  employeeClientModerationController,
  adminController,
  adminCalendarController,
  adminVerifyClientsController,
  adminValidateQrController,
  adminClientModerationController
} = require("./ui.controller");

const router = express.Router();

function redirectToEmpleado(req, res) {
  const nextPath = req.originalUrl.replace("/ui/employee", "/ui/empleado");
  res.redirect(302, nextPath);
}

router.get("/", homeController);
router.get("/ui/login", loginController);
router.get("/ui/client", clientController);
router.get("/ui/client/calendar", clientCalendarController);
router.get("/ui/empleado", employeeController);
router.get("/ui/empleado/calendar", function (_req, res) {
  res.redirect(302, "/ui/empleado");
});
router.get("/ui/empleado/verify-clients", employeeVerifyClientsController);
router.get("/ui/empleado/validate-qr", employeeValidateQrController);
router.get("/ui/empleado/client-moderation", employeeClientModerationController);
router.get("/ui/employee", redirectToEmpleado);
router.get("/ui/employee/calendar", redirectToEmpleado);
router.get("/ui/employee/verify-clients", redirectToEmpleado);
router.get("/ui/employee/validate-qr", redirectToEmpleado);
router.get("/ui/employee/client-moderation", redirectToEmpleado);
router.get("/ui/admin", adminController);
router.get("/ui/admin/calendar", adminCalendarController);
router.get("/ui/admin/verify-clients", adminVerifyClientsController);
router.get("/ui/admin/validate-qr", adminValidateQrController);
router.get("/ui/admin/client-moderation", adminClientModerationController);

module.exports = { uiRouter: router };
