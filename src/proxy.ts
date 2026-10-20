import { type NextRequest, NextResponse } from "next/server";
import { isDesignCatalogEnabled } from "@/app/design/gate";
import { parseEnv } from "@/platform/config/env";

const REQUEST_ID = "x-request-id";

// Under Cache Components a route's notFound() is streamed after the response has started with a
// 200 status, so a refused /design gets its 404 status here. src/app/design/page.tsx refuses it
// as well, so the catalog never renders even if this check is skipped.
function isRefused(path: string) {
  return (
    (path === "/design" || path.startsWith("/design/")) &&
    !isDesignCatalogEnabled(parseEnv(process.env))
  );
}

// Every request gets a new id that the server logs and the response share; an id the client sends
// is replaced, so no client chooses what the logs say. Step 6 adds security headers here.
export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID, requestId);
  const response = isRefused(request.nextUrl.pathname)
    ? NextResponse.rewrite(new URL("/_not-found", request.url), {
        status: 404,
        request: { headers },
      })
    : NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID, requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
