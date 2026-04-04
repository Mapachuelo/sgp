const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { env } = require("../../config/env");
const { HttpError } = require("../../shared/httpError");
const {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  findEmployeeByIdentification,
  listEmployees,
  createEmployeeWithProfile,
  countPaymentsByStylistId,
  deleteUserById
} = require("./auth.model");

const PUBLIC_REGISTRATION_ROLE = "client";

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn
    }
  );
}

async function register(input) {
  const name = (input.name || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").trim();
  const password = (input.password || "").trim();

  if (!name || !email || !phone || !password) {
    throw new HttpError(400, "name, email, phone y password son obligatorios");
  }

  if (password.length < 6) {
    throw new HttpError(400, "El password debe tener al menos 6 caracteres");
  }

  const alreadyExists = await findUserByEmail(email);
  if (alreadyExists) {
    throw new HttpError(409, "El email ya existe");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await createUser({
    name,
    email,
    phone,
    role: PUBLIC_REGISTRATION_ROLE,
    passwordHash
  });

  const token = signToken(user);

  return { user, token };
}

async function login(input) {
  const email = (input.email || "").trim().toLowerCase();
  const password = (input.password || "").trim();

  if (!email || !password) {
    throw new HttpError(400, "email y password son obligatorios");
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  const { password_hash: _passwordHash, ...safeUser } = user;
  const token = signToken(safeUser);

  return { user: safeUser, token };
}

async function getMe(userId) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  return user;
}

function normalizeText(input) {
  return (input || "").trim();
}

async function createEmployeeByAdmin(input) {
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const phone = normalizeText(input.phone);
  const identification = normalizeText(input.identification);
  const email = normalizeText(input.email).toLowerCase();
  const password = normalizeText(input.password);

  if (!firstName || !lastName || !phone || !identification || !email || !password) {
    throw new HttpError(
      400,
      "firstName, lastName, phone, identification, email y password son obligatorios"
    );
  }

  if (password.length < 6) {
    throw new HttpError(400, "La password asignada debe tener al menos 6 caracteres");
  }

  const emailTaken = await findUserByEmail(email);
  if (emailTaken) {
    throw new HttpError(409, "El correo ya existe");
  }

  const phoneTaken = await findUserByPhone(phone);
  if (phoneTaken) {
    throw new HttpError(409, "El numero de telefono ya existe");
  }

  const identificationTaken = await findEmployeeByIdentification(identification);
  if (identificationTaken) {
    throw new HttpError(409, "La identificacion ya existe");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const employee = await createEmployeeWithProfile({
    firstName,
    lastName,
    phone,
    identification,
    email,
    passwordHash,
    assignedPassword: password
  });

  return { employee };
}

async function getEmployeesByAdmin() {
  return listEmployees();
}

function parseEmployeeId(employeeIdInput) {
  const employeeId = Number(employeeIdInput);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new HttpError(400, "employeeId debe ser un numero entero positivo");
  }

  return employeeId;
}

async function deleteEmployeeByAdmin(employeeIdInput) {
  const employeeId = parseEmployeeId(employeeIdInput);

  const user = await findUserById(employeeId);
  if (!user) {
    throw new HttpError(404, "Empleado no encontrado");
  }

  if (user.role !== "employee") {
    throw new HttpError(400, "Solo se pueden eliminar usuarios con rol empleado");
  }

  const paymentsCount = await countPaymentsByStylistId(employeeId);
  if (paymentsCount > 0) {
    throw new HttpError(
      409,
      "No se puede eliminar el empleado porque tiene pagos asociados"
    );
  }

  const deletedEmployee = await deleteUserById(employeeId);
  if (!deletedEmployee) {
    throw new HttpError(404, "Empleado no encontrado");
  }

  return deletedEmployee;
}

module.exports = {
  register,
  login,
  getMe,
  createEmployeeByAdmin,
  getEmployeesByAdmin,
  deleteEmployeeByAdmin
};
