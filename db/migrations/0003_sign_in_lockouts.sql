-- Sign-in attempts count per identifier as typed, with or without an account, so both lock alike
-- (ADR-0009). Counts and locks in progress are not carried over from users.
CREATE TABLE "sign_in_lockouts" (
	"subject" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "failed_sign_ins";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "locked_until";