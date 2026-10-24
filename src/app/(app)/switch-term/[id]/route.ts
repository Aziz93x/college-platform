import { connection, NextResponse } from "next/server";
import { requireViewer } from "@/modules/access";
import { preparesTerms, visibleTerms } from "../../_shell/term.ts";
import { TERM_COOKIE, TERM_KEEP } from "../../_shell/term-cookie.ts";

// Opens a page of the platform on a term, as choosing the term in the header does: a reminder of a
// row of the readiness board opens the row's page on the row's term (lead review D). A term the
// viewer may not see is not chosen, and anything but a page of the platform opens Today.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // It reads the session, which next build does not reach.
  await connection();
  const viewer = await requireViewer();
  const [{ id }, terms] = await Promise.all([
    params,
    visibleTerms(viewer.collegeId, preparesTerms(viewer)),
  ]);
  const here = new URL(request.url);
  const next = new URL(here.searchParams.get("next") ?? "/today", here);
  // A path that dot segments leave starting with two slashes, as `/.//elsewhere` resolves, keeps
  // this origin but would open another site from the header, so it opens Today too.
  const own = next.origin === here.origin && !next.pathname.startsWith("//");
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: own ? `${next.pathname}${next.search}` : "/today" },
  });
  if (terms.some((term) => term.id === id)) {
    response.cookies.set(TERM_COOKIE, id, {
      path: "/",
      maxAge: TERM_KEEP,
      sameSite: "lax",
    });
  }
  return response;
}
