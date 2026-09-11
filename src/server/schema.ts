import { sql } from "drizzle-orm";
import {
  pgTable,
  uniqueIndex,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  index,
  check,
  date,
  jsonb,
} from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().unique(),
    title: text().notNull().default(""),
    paragraphOne: text("paragraph_one").notNull().default(""),
    paragraphTwo: text("paragraph_two").notNull().default(""),
    videoId: text("video_id"),
    videoIds: text("video_ids").array().notNull().default([]),
    published: boolean().notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedDay: date("published_day"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer().notNull().default(0),
  },
  (t) => [
    check(
      "publication_metadata",
      sql`not ${t.published} or (${t.slug} is not null and ${t.publishedAt} is not null and ${t.publishedDay} is not null)`,
    ),
    index("published_days")
      .on(t.publishedDay, t.publishedAt)
      .where(sql`${t.published}`),
  ],
);

export const images = pgTable(
  "post_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    role: text().notNull(),
    objectKey: text("object_key").notNull().unique(),
    mime: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    bytes: integer().notNull(),
    alt: text().notNull().default(""),
    position: integer().notNull().default(0),
    active: boolean().notNull().default(false),
  },
  (t) => [
    index("images_post").on(t.postId),
    check("image_role", sql`${t.role} in ('before', 'after', 'gallery')`),
  ],
);

export const sessions = pgTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  credentialVersion: text("credential_version").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const attempts = pgTable("login_attempts", {
  key: text().primaryKey(),
  count: integer().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const cleanup = pgTable("storage_cleanup", {
  objectKey: text("object_key").primaryKey(),
  notBefore: timestamp("not_before", { withTimezone: true }).notNull(),
  attempts: integer().notNull().default(0),
});

export const apiRequests = pgTable("api_requests", {
  key: text().primaryKey(),
  fingerprint: text().notNull(),
  response: jsonb().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text().notNull(),
    body: text().notNull(),
    hidden: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("comments_post").on(t.postId)],
);
export const polls = pgTable("polls", {
  id: uuid().primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .unique()
    .references(() => posts.id, { onDelete: "cascade" }),
  question: text().notNull(),
  options: jsonb().notNull(),
  closed: boolean().notNull().default(false),
  version: integer().notNull().default(0),
});
export const votes = pgTable(
  "poll_votes",
  {
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    voter: text().notNull(),
    optionId: uuid("option_id").notNull(),
  },
  (t) => [uniqueIndex("one_vote_per_browser").on(t.pollId, t.voter)],
);
