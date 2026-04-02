const { HttpError } = require("../../shared/httpError");
const {
  listClients,
  findClientById,
  updateClient,
  deleteClient
} = require("./clients.model");

async function getAllClients() {
  return listClients();
}

async function getMyClientProfile(userId) {
  const user = await findClientById(userId);
  if (!user) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  return user;
}

async function updateMyClientProfile(userId, input) {
  const name = (input.name || "").trim();
  const phone = (input.phone || "").trim();

  if (!name || !phone) {
    throw new HttpError(400, "name y phone son obligatorios");
  }

  const updated = await updateClient(userId, { name, phone });
  if (!updated) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  return updated;
}

async function deleteMyClientProfile(userId) {
  const deleted = await deleteClient(userId);
  if (!deleted) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  return { deleted: true };
}

module.exports = {
  getAllClients,
  getMyClientProfile,
  updateMyClientProfile,
  deleteMyClientProfile
};
