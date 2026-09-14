-- Every existing entry becomes public without changing its saved content.
-- Allocate missing slugs with collision checks; preserve all existing links.
DO $$
DECLARE entry record; candidate text;
BEGIN
  FOR entry IN SELECT id FROM posts WHERE slug IS NULL ORDER BY id LOOP
    candidate := 'update-' || entry.id::text;
    WHILE EXISTS (SELECT 1 FROM posts WHERE slug = candidate) LOOP
      candidate := candidate || '-m';
    END LOOP;
    UPDATE posts SET slug = candidate WHERE id = entry.id;
  END LOOP;
END $$;
--> statement-breakpoint
UPDATE posts SET published_at = COALESCE(published_at, created_at),
 published_day = COALESCE(published_day, (COALESCE(published_at, created_at) AT TIME ZONE COALESCE(NULLIF(current_setting('blog.time_zone', true), ''), 'America/Chicago'))::date),
 version = version + 1;
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "publication_metadata";--> statement-breakpoint
DROP INDEX "published_days";--> statement-breakpoint
ALTER TABLE "post_images" ALTER COLUMN "post_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "published_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "published_day" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "entry_days" ON "posts" USING btree ("published_day","published_at");--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "published";