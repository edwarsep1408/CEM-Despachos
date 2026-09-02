import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const hashPassword = (plain) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(plain), salt, 32).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (plain, stored) => {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  try {
    const check = scryptSync(String(plain), salt, 32);
    return timingSafeEqual(Buffer.from(hash, "hex"), check);
  } catch (error) {
    return false;
  }
};
