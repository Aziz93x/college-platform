-- Announcements (ADR-0017): what a head, the dean or the vice-dean announced to a department or the
-- college. Each person it reached has it as a notification; a withdrawn one keeps its row for the log.
-- Its inverse drops the table; the notifications of kind 'announcement' go with a delete of that kind.
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"department_id" uuid,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_live_idx" ON "announcements" USING btree ("college_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE "announcements"."withdrawn_at" is null;