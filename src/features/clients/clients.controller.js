const { asyncHandler } = require("../../shared/asyncHandler");
const {
  getAllClients,
  getMyClientProfile,
  updateMyClientProfile,
  deleteMyClientProfile,
  deleteClientIfNoShow,
  getClientsForModeration,
  blockClientForMisuse,
  unblockClientForMisuse
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

const deleteClientByIdController = asyncHandler(async (req, res) => {
  const clientId = Number(req.params.id);
  const data = await deleteClientIfNoShow(clientId);
  res.json({ ok: true, data });
});

const listClientsForModerationController = asyncHandler(async (_req, res) => {
  const data = await getClientsForModeration();
  res.json({ ok: true, data });
});

const blockClientController = asyncHandler(async (req, res) => {
  const data = await blockClientForMisuse(req.params.id, req.body, req.auth.sub);
  res.json({ ok: true, data });
});

const unblockClientController = asyncHandler(async (req, res) => {
  const data = await unblockClientForMisuse(req.params.id);
  res.json({ ok: true, data });
});

module.exports = {
  listClientsController,
  getMyProfileController,
  updateMyProfileController,
  deleteMyProfileController,
  deleteClientByIdController,
  listClientsForModerationController,
  blockClientController,
  unblockClientController
};
