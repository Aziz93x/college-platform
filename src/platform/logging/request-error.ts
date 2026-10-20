import type { Instrumentation } from "next";
import { logger } from "./logger.ts";

// Next reports a server error from a route, a server component or an action here, with the request's
// headers, so the line carries the id that src/proxy.ts gave the request. The query is left out: it may hold a token.
export const logRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  logger.error(
    {
      requestId: request.headers["x-request-id"],
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      err: error,
    },
    "request failed",
  );
};
