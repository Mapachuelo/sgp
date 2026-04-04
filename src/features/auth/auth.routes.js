const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const {
  registerController,
  loginController,
  meController,
  createEmployeeByAdminController,
  listEmployeesByAdminController,
  deleteEmployeeByAdminController
} = require("./auth.controller");

const router = express.Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.get("/me", requireAuth, meController);
router.get("/employees", requireAuth, requireRole("admin"), listEmployeesByAdminController);
router.post("/employees", requireAuth, requireRole("admin"), createEmployeeByAdminController);
router.delete(
  "/employees/:employeeId",
  requireAuth,
  requireRole("admin"),
  deleteEmployeeByAdminController
);

module.exports = { authRouter: router };
