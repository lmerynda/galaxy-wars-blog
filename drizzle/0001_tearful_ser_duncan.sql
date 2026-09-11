ALTER TABLE "posts" DROP CONSTRAINT "publication_metadata";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "published_day" date;--> statement-breakpoint
-- Preserve existing entries, including unpublished entries that had a first publication.
-- The blog's original owner timezone is America/Chicago; future entries use BLOG_TIME_ZONE.
UPDATE "posts" SET "published_day" = ("published_at" AT TIME ZONE 'America/Chicago')::date WHERE "published_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "published_days" ON "posts" USING btree ("published_day","published_at") WHERE "posts"."published";--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "publication_metadata" CHECK (not "posts"."published" or ("posts"."slug" is not null and "posts"."published_at" is not null and "posts"."published_day" is not null));
