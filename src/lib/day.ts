import type { Post } from "./post";

export const DEFAULT_BLOG_TIME_ZONE = "America/Chicago";
export function publicationDay(at: Date, timeZone = DEFAULT_BLOG_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function isDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function formatDay(day: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
export const dayUrl = (day: string) => `/days/${day}`;
export const entryAnchor = (post: Pick<Post, "id">) => `entry-${post.id}`;
export const postUrl = (post: Pick<Post, "id" | "publishedDay">) =>
  `${dayUrl(post.publishedDay!)}#${entryAnchor(post)}`;
