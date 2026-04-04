const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const {
  listClientsController,
  getMyProfileController,
  updateMyProfileController,
  deleteMyProfileController
} = require("./clients.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), listClientsController);
router.get("/me", requireAuth, requireRole("client"), getMyProfileController);
router.put("/me", requireAuth, requireRole("client"), updateMyProfileController);
router.delete("/me", requireAuth, requireRole("client"), deleteMyProfileController);

module.exports = { clientsRouter: router };
