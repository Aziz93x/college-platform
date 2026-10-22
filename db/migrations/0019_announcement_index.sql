-- An announcement's notifications by its id, which its read counts and its withdrawal look up
-- instead of reading every notification (lead review C, proposal 4). Its inverse drops the index.
CREATE INDEX "notifications_announcement_idx" ON "notifications" USING btree (("params" ->> 'announcementId')) WHERE "notifications"."kind" = 'announcement';