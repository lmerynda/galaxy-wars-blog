import { z } from "zod";
import { isDay } from "./day";

export type Role = "before" | "after" | "gallery";
export type PostImage = {
  id: string;
  role: Role;
  url: string;
  width: number;
  height: number;
  alt: string;
};
export type Post = {
  id: string;
  slug: string | null;
  title: string;
  paragraphOne: string;
  paragraphTwo: string;
  videoId: string | null;
  videoIds: string[];
  published: boolean;
  publishedAt: string | null;
  publishedDay: string | null;
  version: number;
  images: PostImage[];
};
export class InputError extends Error {}
export class AuthError extends Error {
  constructor() {
    super("Please sign in again.");
  }
}

export function youtubeId(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      throw new Error();
    let id: string | null = null;
    if (url.hostname === "youtu.be" && /^\/[\w-]{11}\/?$/.test(url.pathname))
      id = url.pathname.split("/")[1];
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    ) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (/^\/shorts\/[\w-]{11}\/?$/.test(url.pathname))
        id = url.pathname.split("/")[2];
    }
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error();
    return id;
  } catch {
    throw new InputError(
      "Enter an HTTPS YouTube video link, or leave it blank.",
    );
  }
}
export const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const paragraph = z
  .string()
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(z.string().max(1500));
export const postInput = z.object({
  id: z.uuid(),
  version: z.number().int().nonnegative(),
  publishedDay: z
    .string()
    .refine(
      (value) => value === "" || (isDay(value) && value >= "0001-01-01"),
      "Enter a valid entry date.",
    )
    .optional(),
  title: z.string().trim().max(120),
  paragraphOne: paragraph,
  paragraphTwo: paragraph,
  youtubeUrl: z.string().max(2048).default(""),
  youtubeUrls: z.array(z.string().max(2048)).optional(),
  beforeId: z.union([z.uuid(), z.literal("")]),
  afterId: z.union([z.uuid(), z.literal("")]),
  beforeAlt: z.string().trim().max(200),
  afterAlt: z.string().trim().max(200),
  images: z
    .array(z.object({ id: z.uuid(), alt: z.string().trim().max(200) }))
    .optional(),
  intent: z.enum(["draft", "publish", "unpublish"]),
});
export type PostInput = z.input<typeof postInput>;
export function validatePost(input: unknown) {
  const parsed = postInput.safeParse(input);
  if (!parsed.success)
    throw new InputError(
      "Check the field lengths and screenshot selections, then try again.",
    );
  const data = parsed.data;
  const videoIds = (data.youtubeUrls ?? [data.youtubeUrl])
    .map(youtubeId)
    .filter((id): id is string => id !== null);
  const videoId = videoIds[0] ?? null;
  const images =
    data.images ??
    [
      { id: data.beforeId, alt: data.beforeAlt },
      { id: data.afterId, alt: data.afterAlt },
    ].filter((image) => image.id);
  if (new Set(images.map((image) => image.id)).size !== images.length)
    throw new InputError("Choose each image only once.");
  if (
    data.intent === "publish" &&
    (!data.title ||
      !data.paragraphOne ||
      !data.paragraphTwo ||
      (data.images === undefined && (!data.beforeId || !data.afterId)) ||
      images.some((image) => !image.alt))
  ) {
    throw new InputError(
      "To publish, add a title, both paragraphs, and descriptions for every image.",
    );
  }
  return {
    ...data,
    videoId,
    videoIds,
    images,
    legacyImages: data.images === undefined,
  };
}
export function slugBase(title: string) {
  return (
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80)
      .replace(/-$/g, "") || "update"
  );
}
export function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "Unpublished draft";
}
