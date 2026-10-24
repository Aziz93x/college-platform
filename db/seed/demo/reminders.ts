import { and, eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import messages from "../../../messages/ar.json" with { type: "json" };
import { users } from "../../../src/modules/identity/index.ts";
import { notifications } from "../../../src/modules/notifications/index.ts";
import {
  remindOwners,
  rowWords,
} from "../../../src/modules/readiness/index.ts";
import { getSetting } from "../../../src/modules/settings/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoAccounts } from "./accounts.ts";
import { deviceOf } from "./device.ts";

// A reminder from the readiness board (lead review D, proposal 5): the vice-dean reminded the admin
// that the trainers SS01 names are still to be added or enabled, by the board's own function, with
// the board's words in the college's language. Written once, while the college has no reminder;
// none when the row is settled by then.
export async function seedDemoReminders({ db }: { db: Db }, collegeId: string) {
  const term = await activeTerm(collegeId, db);
  if (!term) return;
  const [held] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.collegeId, collegeId),
        eq(notifications.kind, "readinessReminder"),
      ),
    )
    .limit(1);
  if (held) return;

  const [[viceDean], language, digits] = await Promise.all([
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, demoAccounts.viceDean.email)),
    getSetting("locale.language", { collegeId }, db),
    getSetting("locale.digits", { collegeId }, db),
  ]);
  if (!viceDean) throw new Error("seed:demo: the vice-dean is missing");
  const locale = `${language}-u-nu-${digits}`;
  const readiness = createTranslator({
    locale,
    messages,
    namespace: "readiness",
  });
  const rayat = createTranslator({ locale, messages, namespace: "rayat" });
  const list = new Intl.ListFormat(locale);
  const reminded = await remindOwners(
    { termId: term.id, row: { id: "matched" } },
    "college",
    {
      collegeId,
      actorId: viceDean.id,
      ...(await deviceOf(db, collegeId, viceDean.id)),
    },
    (row) =>
      rowWords(row, {
        readiness: (key, values) => readiness(key as never, values as never),
        rayat: (key, values) => rayat(key as never, values as never),
        list: (items) => list.format(items),
      }),
    new Date(),
    db,
  );
  if (reminded.status === "notFound") {
    throw new Error("seed:demo: the board's matched row is missing");
  }
}
