import { headers } from "next/headers";
import { logger } from "./logger.ts";

// For server code inside a request: every line carries the id that src/proxy.ts gave the request.
// Uses next/headers, so the worker and db/ scripts never import it.
export async function getRequestLogger() {
  const requestId = (await headers()).get("x-request-id");
  return logger.child({ requestId });
}
