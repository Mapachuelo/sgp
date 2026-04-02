const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { env } = require("../../config/env");
const { HttpError } = require("../../shared/httpError");
const { createUser, findUserByEmail, findUserById } = require("./auth.model");

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

module.exports = {
  register,
  login,
  getMe
};
