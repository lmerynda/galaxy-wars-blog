"use server";
import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  checkOrigin,
  mutationToken,
  ownerToken,
  safeError,
} from "@/server/http";
import { clientKey, requireOwner } from "@/server/auth";
import { digest } from "@/server/password";
import {
  discussion,
  addComment,
  vote,
  savePoll,
  moderateComment,
} from "@/server/discussion";
const COOKIE = "gw_voter";
async function voter(create = false) {
  const jar = await cookies();
  let value = jar.get(COOKIE)?.value;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) {
    if (!create) return "";
    value = randomBytes(32).toString("hex");
    jar.set(COOKIE, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  return digest(value);
}
function errorMessage(error: unknown) {
  return error instanceof z.ZodError
    ? "Check the fields and their lengths."
    : safeError(error);
}
export async function loadDiscussion(postId: string, admin = false) {
  try {
    const owner = admin ? await ownerToken() : undefined;
    if (admin) await requireOwner(owner);
    return { data: await discussion(postId, await voter(), owner) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function sendComment(postId: string, input: unknown) {
  try {
    const h = await headers();
    checkOrigin(h.get("origin"));
    await addComment(postId, input, clientKey(h));
    return { data: await discussion(postId, await voter()) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function castVote(postId: string, optionId: string) {
  try {
    checkOrigin((await headers()).get("origin"));
    const identity = await voter(true);
    await vote(postId, optionId, identity);
    return { data: await discussion(postId, identity) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function configurePoll(postId: string, input: unknown) {
  try {
    const owner = await mutationToken();
    await savePoll(owner, postId, input);
    return { data: await discussion(postId, await voter(), owner) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function hideComment(postId: string, id: string, hidden: boolean) {
  try {
    const owner = await mutationToken();
    await moderateComment(owner, postId, id, hidden);
    return { data: await discussion(postId, await voter(), owner) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
