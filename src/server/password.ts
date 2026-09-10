import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(nodeScrypt);
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function validHash(value: string | undefined): value is string {
  return !!value && /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value);
}
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256)
    throw new Error("Use a password between 12 and 256 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(
  password: string,
  encoded: string | undefined,
) {
  if (!validHash(encoded) || password.length > 256) return false;
  const [, salt, expected] = encoded.split(":");
  return timingSafeEqual(
    (await scrypt(password, salt, 64)) as Buffer,
    Buffer.from(expected, "hex"),
  );
}
