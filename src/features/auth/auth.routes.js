const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
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
  stylistsController
} = require("./auth.controller");

const router = express.Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.get("/stylists", stylistsController);
router.get("/me", requireAuth, meController);
router.get("/me/employee-account", requireAuth, requireRole("employee"), employeeOwnAccountController);
router.put(
  "/me/employee-account",
  requireAuth,
  requireRole("employee"),
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

module.exports = { authRouter: router };
