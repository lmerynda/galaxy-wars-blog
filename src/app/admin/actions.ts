"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE,
  SESSION_SECONDS,
  clientKey,
  login,
  logout,
} from "@/server/auth";
import { mutationToken, safeAdminPath, safeError } from "@/server/http";
import { createPost, savePost } from "@/server/posts";
import type { PostInput } from "@/lib/post";

export async function signIn(_: { error: string }, form: FormData) {
  let destination = "/admin";
  try {
    const old = await mutationToken();
    const token = await login(
      String(form.get("password") ?? ""),
      clientKey(await headers()),
      old,
    );
    (await cookies()).set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    destination = safeAdminPath(String(form.get("next") ?? ""));
  } catch (error) {
    return { error: safeError(error) };
  }
  redirect(destination);
}
export async function signOut() {
  await logout(await mutationToken());
  (await cookies()).delete(COOKIE);
  redirect("/admin/login");
}
export async function newPost() {
  const id = await createPost(await mutationToken());
  redirect(`/admin/posts/${id}/edit`);
}
export async function save(input: PostInput) {
  try {
    return { post: await savePost(await mutationToken(), input) };
  } catch (error) {
    return { error: safeError(error) };
  }
}
