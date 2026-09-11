ALTER TABLE "posts" ADD COLUMN "video_ids" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE "posts" SET "video_ids" = ARRAY["video_id"] WHERE "video_id" IS NOT NULL;
