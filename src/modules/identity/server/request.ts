// Who made a request, for audit events and the sign-in limits. Caddy replaces X-Forwarded-For for
// clients it does not trust, and Next.js fills it from the socket when nothing in front set it, so
// its first entry is the client's address.
export function requestMeta(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || null,
    userAgent: headers.get("user-agent"),
  };
}
