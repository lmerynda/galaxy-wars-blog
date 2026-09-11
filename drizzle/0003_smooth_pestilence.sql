CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "polls_post_id_unique" UNIQUE("post_id")
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"poll_id" uuid NOT NULL,
	"voter" text NOT NULL,
	"option_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_images" DROP CONSTRAINT "image_role";--> statement-breakpoint
DROP INDEX "active_post_role";--> statement-breakpoint
ALTER TABLE "post_images" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_post" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_vote_per_browser" ON "poll_votes" USING btree ("poll_id","voter");--> statement-breakpoint
ALTER TABLE "post_images" ADD CONSTRAINT "image_role" CHECK ("post_images"."role" in ('before', 'after', 'gallery'));
--> statement-breakpoint
UPDATE post_images SET position = CASE WHEN role = 'after' THEN 1 ELSE 0 END;
