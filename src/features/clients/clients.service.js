const bcrypt = require("bcryptjs");
const { HttpError } = require("../../shared/httpError");
const {
  listClients,
  findClientById,
  findUserByEmail,
  updateClient,
  deleteClient,
  listClientsForModeration,
  blockClientById,
  unblockClientById
} = require("./clients.model");
const { hasNoShowReservationForClient } = require("../reservations/reservations.model");

function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function normalizePhone(input) {
  const compact = String(input || "").trim().replace(/[^\d+]/g, "");
  if (!compact) {
    return "";
  }

  if (compact.startsWith("+")) {
    return compact;
  }

  if (compact.startsWith("57")) {
    return "+" + compact;
  }

  return "+57" + compact;
}

function ensureCoPhone(phone) {
  if (!/^\+57\d{10}$/.test(phone)) {
    throw new HttpError(400, "El numero de telefono debe tener formato +57XXXXXXXXXX");
  }

  return phone;
}

function parseClientId(clientIdInput) {
  const clientId = Number(clientIdInput);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new HttpError(400, "clientId debe ser un numero entero positivo");
  }

  return clientId;
}

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
  const phone = ensureCoPhone(normalizePhone(input.phone));
  const email = (input.email || "").trim().toLowerCase();
  const password = (input.password || "").trim();

  if (!name || !phone || !email || !password) {
    throw new HttpError(400, "name, phone, email y password son obligatorios");
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, "email no tiene un formato valido");
  }

  if (password.length < 6) {
    throw new HttpError(400, "El password debe tener al menos 6 caracteres");
  }

  const emailTaken = await findUserByEmail(email);
  if (emailTaken && Number(emailTaken.id) !== Number(userId)) {
    throw new HttpError(409, "Este correo ya existe");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let updated = null;
  try {
    updated = await updateClient(userId, { name, phone, email, passwordHash });
  } catch (error) {
    if (error && error.code === "23505") {
      throw new HttpError(409, "Este correo ya existe");
    }

    throw error;
  }

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

async function deleteClientIfNoShow(clientId) {
  const hasNoShow = await hasNoShowReservationForClient(clientId);
  if (!hasNoShow) {
    throw new HttpError(400, "No hay reservas pasadas sin asistencia para este cliente");
  }

  const deleted = await deleteClient(clientId);
  if (!deleted) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  return { deleted: true };
}

async function getClientsForModeration() {
  return listClientsForModeration();
}

async function blockClientForMisuse(clientIdInput, input, actorUserId) {
  const clientId = parseClientId(clientIdInput);
  const reason = String((input && input.reason) || "").trim() || "Spam o mal uso de la aplicacion";

  const updated = await blockClientById(clientId, reason, actorUserId);
  if (!updated) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  return updated;
}

async function unblockClientForMisuse(clientIdInput) {
  const clientId = parseClientId(clientIdInput);

  const updated = await unblockClientById(clientId);
  if (!updated) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  return updated;
}

module.exports = {
  getAllClients,
  getMyClientProfile,
  updateMyClientProfile,
  deleteMyClientProfile,
  deleteClientIfNoShow,
  getClientsForModeration,
  blockClientForMisuse,
  unblockClientForMisuse
};
