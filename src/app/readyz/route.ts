import { connection } from "next/server";
import { checkReadiness } from "@/platform/health/readiness";
import { getRequestLogger } from "@/platform/logging/request-logger";

// Readiness: the database answers and the job queue is installed.
export async function GET() {
  await connection();
  const readiness = await checkReadiness();
  if (!readiness.ok) {
    (await getRequestLogger()).warn(readiness.checks, "not ready");
  }
  return Response.json(readiness, { status: readiness.ok ? 200 : 503 });
}
