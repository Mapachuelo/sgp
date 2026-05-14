const express = require("express");
const router = express.Router();
const locationService = require("./location.service");
const { requireAuth, requireRole } = require("../../shared/middlewares/auth.middleware");

router.get("/", async (req, res) => {
  try {
    const locations = await locationService.listAll();
    res.json({ ok: true, data: locations });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, address, region } = req.body || {};
    const location = await locationService.createOne({ name, address, region });
    res.status(201).json({ ok: true, data: location });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, region } = req.body || {};
    const location = await locationService.updateOne(id, { name, address, region });
    if (!location) {
      return res.status(404).json({ ok: false, message: "Local no encontrado." });
    }
    res.json({ ok: true, data: location });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const location = await locationService.deleteOne(id);
    if (!location) {
      return res.status(404).json({ ok: false, message: "Local no encontrado." });
    }
    res.json({ ok: true, data: location });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

module.exports = router;
