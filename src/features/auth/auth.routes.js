const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const { loginLimiter } = require("../../shared/middlewares/rateLimit.middleware");
const {
  registerController,
  loginController,
  meController,
  employeeOwnAccountController,
  updateEmployeeOwnAccountController,
  createEmployeeByAdminController,
  listEmployeesByAdminController,
  deleteEmployeeByAdminController,
  updateRegisteredUserByAdminController,
  stylistsController,
  updateEmployeeLocationController
} = require("./auth.controller");

const router = express.Router();

router.post("/register", registerController);
router.post("/login", loginLimiter, loginController);
router.get("/stylists", stylistsController);
router.get("/me", requireAuth, meController);
router.get("/me/employee-account", requireAuth, requireRole("empleado"), employeeOwnAccountController);
router.put(
  "/me/employee-account",
  requireAuth,
  requireRole("empleado"),
  updateEmployeeOwnAccountController
);
router.get("/employees", requireAuth, requireRole("admin"), listEmployeesByAdminController);
router.post("/employees", requireAuth, requireRole("admin"), createEmployeeByAdminController);
router.put(
  "/employees/:employeeId",
  requireAuth,
  requireRole("admin"),
  updateRegisteredUserByAdminController
);
router.delete(
  "/employees/:employeeId",
  requireAuth,
  requireRole("admin"),
  deleteEmployeeByAdminController
);
router.put(
  "/employees/:employeeId/location",
  requireAuth,
  requireRole("admin"),
  updateEmployeeLocationController
);

module.exports = { authRouter: router };
