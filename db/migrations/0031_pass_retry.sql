-- A quick request's pass that fails is queued again once, whoever ran it: the retry is marked, and
-- is not queued again itself, so a fault that lasts cannot keep queueing passes (lead review D).
ALTER TABLE "generation_runs" ADD COLUMN "retry" boolean DEFAULT false NOT NULL;
