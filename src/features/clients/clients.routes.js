const express = require("express");
const {
  requireAuth,
  requireRole
} = require("../../shared/middlewares/auth.middleware");
const {
  listClientsController,
  listClientsForModerationController,
  getMyProfileController,
  updateMyProfileController,
  deleteMyProfileController,
  blockClientController,
  unblockClientController,
  deleteClientByIdController
} = require("./clients.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), listClientsController);
router.get(
  "/moderation",
  requireAuth,
  requireRole("admin", "empleado"),
  listClientsForModerationController
);
router.get("/me", requireAuth, requireRole("client"), getMyProfileController);
router.put("/me", requireAuth, requireRole("client"), updateMyProfileController);
router.delete("/me", requireAuth, requireRole("client"), deleteMyProfileController);
router.put("/:id/block", requireAuth, requireRole("admin", "empleado"), blockClientController);
router.put("/:id/unblock", requireAuth, requireRole("admin", "empleado"), unblockClientController);
router.delete("/:id", requireAuth, requireRole("admin", "empleado"), deleteClientByIdController);

module.exports = { clientsRouter: router };
