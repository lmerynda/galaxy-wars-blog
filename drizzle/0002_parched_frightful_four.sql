CREATE TABLE "api_requests" (
	"key" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
