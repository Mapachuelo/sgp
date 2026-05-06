const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { env } = require("../../config/env");
const { HttpError } = require("../../shared/httpError");
const {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  findEmployeeAccountByUserId,
  findEmployeeByIdentification,
  listEmployees,
  createStaffWithProfile,
  listStylists,
  updateUserById,
  updateAssignedPasswordByUserId,
  countPaymentsByStylistId,
  deleteUserById
} = require("./auth.model");

const PUBLIC_REGISTRATION_ROLE = "client";

function isEmployeeRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "empleado" || normalized === "employee";
}

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

function toSha256Hex(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

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
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const name = normalizeText(input.name) || [firstName, lastName].filter(Boolean).join(" ");
  const email = (input.email || "").trim().toLowerCase();
  const phoneRaw = normalizePhone(input.phone);
  const password = (input.password || "").trim();

  if (!name) {
    throw new HttpError(400, "La casilla nombre es obligatoria");
  }

  if (!firstName && !lastName && !name) {
    throw new HttpError(400, "La casilla nombre es obligatoria");
  }

  if (!email) {
    throw new HttpError(400, "La casilla correo es obligatoria");
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, "La casilla correo no tiene un formato valido");
  }

  if (!phoneRaw) {
    throw new HttpError(400, "La casilla numero es obligatoria");
  }

  const phone = ensureCoPhone(phoneRaw);

  if (!password) {
    throw new HttpError(400, "La casilla password es obligatoria");
  }

  if (password.length < 6) {
    throw new HttpError(400, "El password debe tener al menos 6 caracteres");
  }

  const alreadyExists = await findUserByEmail(email);
  if (alreadyExists) {
    throw new HttpError(409, "Este correo ya existe");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user = null;
  try {
    user = await createUser({
      name,
      email,
      phone,
      role: PUBLIC_REGISTRATION_ROLE,
      passwordHash
    });
  } catch (error) {
    if (error && error.code === "23505") {
      throw new HttpError(409, "Este correo ya existe");
    }

    throw error;
  }

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

  if (user.role === "client" && user.is_blocked) {
    throw new HttpError(
      403,
      user.blocked_reason
        ? "Cliente bloqueado por mal uso de la aplicacion: " + user.blocked_reason
        : "Cliente bloqueado por mal uso de la aplicacion"
    );
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  const {
    password_hash: _passwordHash,
    is_blocked: _isBlocked,
    blocked_reason: _blockedReason,
    ...safeUser
  } = user;
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

async function getEmployeeOwnAccount(userId) {
  const account = await findEmployeeAccountByUserId(userId);
  if (!account) {
    throw new HttpError(404, "Empleado no encontrado");
  }

  if (!isEmployeeRole(account.role)) {
    throw new HttpError(403, "Solo empleados pueden editar esta cuenta");
  }

  return account;
}

function normalizeText(input) {
  return (input || "").trim();
}

function normalizeRole(inputRole) {
  const role = String(inputRole || "")
    .trim()
    .toLowerCase();

  if (role === "employee") {
    return "empleado";
  }

  if (role !== "empleado" && role !== "admin") {
    throw new HttpError(400, "role debe ser empleado o admin");
  }

  return role;
}

async function createEmployeeByAdmin(input) {
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const phone = ensureCoPhone(normalizePhone(input.phone));
  const identification = normalizeText(input.identification);
  const email = normalizeText(input.email).toLowerCase();
  const password = normalizeText(input.password);
  const role = normalizeRole(input.role || "empleado");

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

  const user = await createStaffWithProfile({
    firstName,
    lastName,
    phone,
    identification,
    email,
    role,
    passwordHash,
    assignedPassword: toSha256Hex(password)
  });

  return { user };
}

async function getEmployeesByAdmin() {
  const employees = await listEmployees();

  return employees.map((employee) => {
    const { assigned_password: _assignedPassword, ...safeEmployee } = employee;

    return {
      ...safeEmployee
    };
  });
}

async function getStylistsForCalendar() {
  return listStylists();
}

function parseEmployeeId(employeeIdInput) {
  const employeeId = Number(employeeIdInput);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new HttpError(400, "employeeId debe ser un numero entero positivo");
  }

  return employeeId;
}

async function deleteEmployeeByAdmin(employeeIdInput, actorUserId) {
  const employeeId = parseEmployeeId(employeeIdInput);

  if (Number(actorUserId) === employeeId) {
    throw new HttpError(400, "No puedes eliminar tu propio usuario administrador");
  }

  const user = await findUserById(employeeId);
  if (!user) {
    throw new HttpError(404, "Empleado no encontrado");
  }

  if (!isEmployeeRole(user.role) && user.role !== "admin") {
    throw new HttpError(400, "Solo se pueden eliminar usuarios con rol empleado o admin");
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

async function updateRegisteredUserByAdmin(employeeIdInput, input, actorUserId) {
  const userId = parseEmployeeId(employeeIdInput);
  const phone = ensureCoPhone(normalizePhone(input.phone));
  const email = normalizeText(input.email).toLowerCase();
  const password = normalizeText(input.password);

  if (!phone || !email) {
    throw new HttpError(400, "phone y email son obligatorios");
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, "email no tiene un formato valido");
  }

  if (password && password.length < 6) {
    throw new HttpError(400, "La password debe tener al menos 6 caracteres");
  }

  const existingUser = await findUserById(userId);
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  if (!isEmployeeRole(existingUser.role) && existingUser.role !== "admin") {
    throw new HttpError(400, "Solo se pueden editar usuarios con rol empleado o admin");
  }

  if (Number(actorUserId) === userId && existingUser.role === "admin") {
    throw new HttpError(400, "No puedes editar tu propio usuario administrador desde esta vista");
  }

  const emailTaken = await findUserByEmail(email);
  if (emailTaken && Number(emailTaken.id) !== userId) {
    throw new HttpError(409, "El correo ya existe");
  }

  const phoneTaken = await findUserByPhone(phone);
  if (phoneTaken && Number(phoneTaken.id) !== userId) {
    throw new HttpError(409, "El numero de telefono ya existe");
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const updatedUser = await updateUserById(userId, {
    phone,
    email,
    passwordHash
  });

  if (!updatedUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  if (password) {
    await updateAssignedPasswordByUserId(userId, toSha256Hex(password));
  }

  return updatedUser;
}

async function updateEmployeeOwnAccount(userId, input) {
  const current = await findEmployeeAccountByUserId(userId);
  if (!current) {
    throw new HttpError(404, "Empleado no encontrado");
  }

  if (!isEmployeeRole(current.role)) {
    throw new HttpError(403, "Solo empleados pueden editar esta cuenta");
  }

  const phone = ensureCoPhone(normalizePhone(input.phone));
  const email = normalizeText(input.email).toLowerCase();
  const password = normalizeText(input.password);

  if (!phone || !email || !password) {
    throw new HttpError(400, "phone, email y password son obligatorios");
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, "email no tiene un formato valido");
  }

  if (password.length < 6) {
    throw new HttpError(400, "La password debe tener al menos 6 caracteres");
  }

  const emailTaken = await findUserByEmail(email);
  if (emailTaken && Number(emailTaken.id) !== Number(userId)) {
    throw new HttpError(409, "El correo ya existe");
  }

  const phoneTaken = await findUserByPhone(phone);
  if (phoneTaken && Number(phoneTaken.id) !== Number(userId)) {
    throw new HttpError(409, "El numero de telefono ya existe");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const updatedUser = await updateUserById(userId, {
    phone,
    email,
    passwordHash
  });

  if (!updatedUser) {
    throw new HttpError(404, "Empleado no encontrado");
  }

  await updateAssignedPasswordByUserId(userId, toSha256Hex(password));

  const account = await findEmployeeAccountByUserId(userId);
  if (!account) {
    throw new HttpError(404, "Empleado no encontrado");
  }

  return account;
}

module.exports = {
  register,
  login,
  getMe,
  getEmployeeOwnAccount,
  createEmployeeByAdmin,
  getEmployeesByAdmin,
  deleteEmployeeByAdmin,
  updateRegisteredUserByAdmin,
  updateEmployeeOwnAccount,
  getStylistsForCalendar
};
