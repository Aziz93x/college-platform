import { type NextRequest, NextResponse } from "next/server";
import { isDesignCatalogEnabled } from "@/app/design/gate";
import { type Env, parseEnv } from "@/platform/config/env";

const REQUEST_ID = "x-request-id";
const CSP = "content-security-policy";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Under Cache Components a route's notFound() is streamed after the response has started with a
// 200 status, so a refused /design gets its 404 status here. src/app/design/page.tsx refuses it
// as well, so the catalog never renders even if this check is skipped.
function isRefused(path: string, env: Env) {
  return (
    (path === "/design" || path.startsWith("/design/")) &&
    !isDesignCatalogEnabled(env)
  );
}

// A change (any method but GET, HEAD and OPTIONS) is accepted only from the platform's own pages:
// the browser's Origin must name the host the request came to, as Next.js checks server actions,
// and unlike Next.js a change without an Origin is refused too. This covers every route.
function isCrossOriginChange(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return false;
  const origin = request.headers.get("origin");
  let originHost: string;
  try {
    originHost = new URL(origin ?? "").host;
  } catch {
    return true;
  }
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  return (
    originHost !== forwardedHost && originHost !== request.headers.get("host")
  );
}

// Scripts run only from the platform with this request's nonce, which Next.js reads from the
// request's policy and puts on its own scripts. Styles may be inline: Motion and the image
// component set style attributes, which no nonce can cover.
function contentSecurityPolicy(nonce: string, env: Env) {
  const development = env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // React's development build evaluates code to rebuild server error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(new URL(env.APP_URL).protocol === "https:"
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ");
}

// Every request gets a new id that the server logs and the response share; an id the client sends
// is replaced, so no client chooses what the logs say. Every page gets a new nonce in its Content
// Security Policy; next.config.ts adds the other security headers to every response.
export function proxy(request: NextRequest) {
  const env = parseEnv(process.env);
  const requestId = crypto.randomUUID();
  const policy = contentSecurityPolicy(
    Buffer.from(crypto.randomUUID()).toString("base64"),
    env,
  );
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID, requestId);
  headers.set(CSP, policy);

  let response: NextResponse;
  if (isCrossOriginChange(request)) {
    response = new NextResponse(null, { status: 403 });
  } else if (isRefused(request.nextUrl.pathname, env)) {
    response = NextResponse.rewrite(new URL("/_not-found", request.url), {
      status: 404,
      request: { headers },
    });
  } else {
    response = NextResponse.next({ request: { headers } });
  }
  response.headers.set(REQUEST_ID, requestId);
  response.headers.set(CSP, policy);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
