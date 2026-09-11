import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { isIP } from "node:net";
import { db } from "./db";
import { digest, validHash, verifyPassword } from "./password";
import { AuthError, InputError } from "../lib/post";

export const COOKIE = "gw_owner";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function clientKey(headers: Headers) {
  const ip =
    process.env.TRUST_RAILWAY_PROXY === "true"
      ? headers.get("x-real-ip")
      : null;
  return digest(ip && isIP(ip) ? ip : "untrusted-client");
}
export async function sessionValid(token: string | undefined) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !validHash(hash)) return false;
  const rows =
    await db()`select 1 from admin_sessions where token_hash = ${digest(token)} and credential_version = ${digest(hash)} and expires_at > now()`;
  return rows.length === 1;
}
export type OwnerCredential = string | undefined | { apiToken: string };
export function apiTokenValid(token: string) {
  const expected = process.env.BLOG_API_TOKEN;
  if (!expected || expected.length < 32 || !token || token.length > 512)
    return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(token), hash(expected));
}
export async function requireOwner(token: OwnerCredential) {
  if (typeof token === "object") {
    if (!apiTokenValid(token.apiToken)) throw new AuthError();
  } else if (!(await sessionValid(token))) throw new AuthError();
}
export async function login(
  password: string,
  client: string,
  oldToken?: string,
) {
  const sql = db();
  // Serialize the limit check/reservation across instances before doing expensive password work.
  const allowed = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(78234621)`;
    await tx`delete from login_attempts where expires_at <= now()`;
    const keys = [`client:${client}`, "global"];
    const rows =
      await tx`select key, count from login_attempts where key in ${tx(keys)}`;
    if (rows.some((r) => r.count >= (r.key === "global" ? 100 : 5)))
      return false;
    for (const key of keys)
      await tx`insert into login_attempts (key, count, expires_at) values (${key}, 1, now() + interval '15 minutes') on conflict (key) do update set count = login_attempts.count + 1`;
    return true;
  });
  if (!allowed)
    throw new InputError("Too many sign-in attempts. Try again in 15 minutes.");
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!(await verifyPassword(password, hash)))
    throw new InputError(
      "Unable to sign in. Check your password and try again.",
    );
  const token = randomBytes(32).toString("hex");
  await sql.begin(async (tx) => {
    await tx`delete from admin_sessions where expires_at <= now() or credential_version <> ${digest(hash!)} or token_hash = ${digest(oldToken ?? "")}`;
    await tx`delete from login_attempts where key = ${`client:${client}`}`;
    await tx`insert into admin_sessions (token_hash, credential_version, expires_at) values (${digest(token)}, ${digest(hash!)}, ${new Date(Date.now() + SESSION_SECONDS * 1000)})`;
  });
  return token;
}
export async function logout(token: string | undefined) {
  if (token)
    await db()`delete from admin_sessions where token_hash = ${digest(token)}`;
}
