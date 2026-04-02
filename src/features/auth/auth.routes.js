const express = require("express");
const { requireAuth } = require("../../shared/middlewares/auth.middleware");
const {
  registerController,
  loginController,
  meController
} = require("./auth.controller");

const router = express.Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.get("/me", requireAuth, meController);

module.exports = { authRouter: router };
