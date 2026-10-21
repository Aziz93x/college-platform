import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { authorize, requireViewer } from "@/modules/access";
import { allAuditEvents, writeAudit } from "@/modules/audit";
import { requestMeta } from "@/modules/identity";
import { getSetting } from "@/modules/settings";
import { csvLines } from "@/platform/files/table";
import { wallClock } from "@/platform/i18n/time-zone";
import { describeEvent } from "../describe.ts";
import { auditFilters } from "../filters.ts";
import { auditLookups, auditWords } from "../lookups.ts";
import { parseAuditQuery } from "../query.ts";

// Rows per chunk of the file.
const BATCH = 500;

// Every event the log's filters select, as a CSV file a spreadsheet opens in Arabic: UTF-8 with
// its byte order mark first, times on the college's clock. It streams a batch at a time, and the
// export is itself an event, written with how many rows left once the file ends or stops.
export async function GET(request: Request) {
  // The export reads the session and the database, which next build does not reach.
  await connection();
  const viewer = await requireViewer();
  const { collegeId } = viewer;
  if (!authorize(viewer, "audit.view", { collegeId })) {
    return new Response(null, { status: 403 });
  }
  const { after: _after, ...query } = parseAuditQuery(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const timeZone = await getSetting("locale.timeZone", { collegeId });
  const [filters, lookups, words, t] = await Promise.all([
    auditFilters(query, collegeId, timeZone),
    auditLookups(collegeId),
    auditWords(),
    getTranslations("audit"),
  ]);
  const encoder = new TextEncoder();

  async function* file() {
    let rows = 0;
    try {
      yield encoder.encode(
        `\uFEFF${csvLines([
          [
            t("columns.time"),
            t("columns.actor"),
            t("columns.action"),
            t("columns.subject"),
            t("columns.changes"),
            t("address"),
            t("device"),
          ],
        ])}`,
      );
      let batch: string[][] = [];
      for await (const entry of allAuditEvents(collegeId, filters)) {
        const event = describeEvent(entry, lookups, words);
        batch.push([
          wallClock(entry.createdAt, timeZone),
          event.actor,
          event.action,
          event.subject,
          event.changes
            .map(({ field, before, after = t("none") }) =>
              before === undefined
                ? t("note", { field, value: after })
                : t("change", { field, before, after }),
            )
            .join("\n"),
          event.ip ?? "",
          event.device ?? "",
        ]);
        if (batch.length === BATCH) {
          rows += batch.length;
          yield encoder.encode(csvLines(batch));
          batch = [];
        }
      }
      rows += batch.length;
      yield encoder.encode(csvLines(batch));
    } finally {
      await writeAudit({
        collegeId,
        actorId: viewer.userId,
        action: "audit.export",
        entityType: "college",
        entityId: collegeId,
        diff: {
          start: query.from,
          end: query.to,
          action: query.action,
          search: query.q,
          rows,
        },
        ...requestMeta(request.headers),
      });
    }
  }

  const chunks = file();
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await chunks.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      async cancel() {
        await chunks.return(undefined);
      },
    }),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(t("exportFile"))}`,
        "Cache-Control": "no-store",
      },
    },
  );
}
