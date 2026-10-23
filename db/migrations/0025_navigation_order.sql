-- The order of the default roles' pages for the colleges that exist (UX review 2, F3), as the base
-- seed gives a new college: the vice-dean's terms, framework and Rayat, and the head's plan,
-- sections and people, come first, so a phone's tabs hold each one's work. A role whose pages a
-- college already ordered keeps its order. Its inverse takes the two orders out where they are
-- still these.
INSERT INTO "settings" ("college_id", "key", "value") SELECT "id", 'navigation.order', '{"vice-dean": ["today", "terms", "framework", "rayat", "sections", "announcements", "settings"], "head": ["today", "plan", "sections", "people", "announcements", "framework", "rayat"]}'::jsonb FROM "colleges" ON CONFLICT ("college_id", "key") DO UPDATE SET "value" = EXCLUDED."value" || "settings"."value", "version" = "settings"."version" + 1, "updated_at" = now() WHERE NOT ("settings"."value" ? 'vice-dean' AND "settings"."value" ? 'head');
