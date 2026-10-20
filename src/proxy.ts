import { type NextRequest, NextResponse } from "next/server";

const REQUEST_ID = "x-request-id";

// Every request gets a new id that the server logs and the response share; an id the client sends
// is replaced, so no client chooses what the logs say. Step 6 adds security headers here.
export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID, requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID, requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
