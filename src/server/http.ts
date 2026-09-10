import { cookies, headers } from "next/headers";
import { COOKIE, sessionValid } from "./auth";
import { AuthError, InputError } from "../lib/post";
import { redirect } from "next/navigation";

export async function ownerToken() {
  return (await cookies()).get(COOKIE)?.value;
}
export function checkOrigin(origin: string | null) {
  const configured = process.env.APP_URL;
  if (!configured || !origin || origin !== new URL(configured).origin)
    throw new InputError(
      "Request origin was not accepted. Open the editor from the configured site URL.",
    );
}
export async function mutationToken() {
  checkOrigin((await headers()).get("origin"));
  return ownerToken();
}
export async function ownerPage(path = "/admin") {
  const token = await ownerToken();
  if (!(await sessionValid(token)))
    redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  return token!;
}
export function safeError(error: unknown) {
  if (error instanceof InputError || error instanceof AuthError)
    return error.message;
  console.error(
    "Blog operation failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return "Something could not be saved. Your changes are still here; please try again.";
}
export function safeAdminPath(value: string) {
  return /^\/admin(?:\/(?:new|posts\/[a-f0-9-]{36}\/edit))?$/.test(value)
    ? value
    : "/admin";
}
