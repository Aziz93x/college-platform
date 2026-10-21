ALTER TABLE "sessions" ADD COLUMN "password_entered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- A session that exists already last had its password typed when it signed in.
UPDATE "sessions" SET "password_entered_at" = "created_at";
