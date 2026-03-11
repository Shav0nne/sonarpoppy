import crypto from "node:crypto";
import bcrypt from "bcrypt";

const PREFIX = "sk_live_";
const HEX_LENGTH = 32;
const SALT_ROUNDS = 10;

export function generateApiKey() {
  const hex = crypto.randomBytes(HEX_LENGTH / 2).toString("hex");
  const key = PREFIX + hex;
  const prefix = key.slice(0, 16);
  return { key, prefix };
}

export async function hashApiKey(key) {
  return bcrypt.hash(key, SALT_ROUNDS);
}

export async function compareApiKey(key, hash) {
  return bcrypt.compare(key, hash);
}
