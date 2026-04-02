const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "sgp_dev_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30m"
};

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

module.exports = { env };
