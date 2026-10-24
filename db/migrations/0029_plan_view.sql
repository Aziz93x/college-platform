-- Reading a department's plan (lead review D, proposal 3): section 1 gives the vice-dean every
-- department "down to trainer, section, task and evidence, read only", and the readiness board shows
-- them each department's plan, which /plan refused whoever neither edits nor publishes it. The key
-- plan.view opens a plan to read, as the base seed gives it to the vice-dean. Its inverse takes the
-- key from the vice-dean.
INSERT INTO "role_permissions" ("role_id", "permission") SELECT "id", 'plan.view' FROM "roles" WHERE "key" = 'vice-dean' ON CONFLICT DO NOTHING;
