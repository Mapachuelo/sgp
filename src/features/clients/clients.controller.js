const { asyncHandler } = require("../../shared/asyncHandler");
const {
  getAllClients,
  getMyClientProfile,
  updateMyClientProfile,
  deleteMyClientProfile
} = require("./clients.service");

const listClientsController = asyncHandler(async (_req, res) => {
  const data = await getAllClients();
  res.json({ ok: true, data });
});

const getMyProfileController = asyncHandler(async (req, res) => {
  const data = await getMyClientProfile(req.auth.sub);
  res.json({ ok: true, data });
});

const updateMyProfileController = asyncHandler(async (req, res) => {
  const data = await updateMyClientProfile(req.auth.sub, req.body);
  res.json({ ok: true, data });
});

const deleteMyProfileController = asyncHandler(async (req, res) => {
  const data = await deleteMyClientProfile(req.auth.sub);
  res.json({ ok: true, data });
});

module.exports = {
  listClientsController,
  getMyProfileController,
  updateMyProfileController,
  deleteMyProfileController
};
