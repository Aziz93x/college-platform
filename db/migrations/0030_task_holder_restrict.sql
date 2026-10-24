-- A task held by a person, such as a role's or a request's, is never deleted with their account:
-- done ones are the term's history, which is append-only (lead review D). Deleting an account that
-- holds tasks is refused; nothing deletes accounts today, as disabling one keeps it.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_holder_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_holder_id_users_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;