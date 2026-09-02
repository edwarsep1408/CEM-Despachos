import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const host = process.env.MONGODB_HOST || "127.0.0.1";
const port = process.env.MONGODB_PORT || "27027";
const database = process.env.MONGODB_DB || "cem-db_distribuccion";
const user = process.env.MONGODB_USER;
const password = process.env.MONGODB_PASSWORD;
const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  (user && password
    ? `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(
        password
      )}@${host}:${port}/${database}?authSource=${authSource}`
    : `mongodb://${host}:${port}/${database}`);

export default {
  PORT: process.env.PORT || 3020,
  MONGODB_HOST: host,
  MONGODB_DATABASE: database,
  MONGODB_URI,
};
