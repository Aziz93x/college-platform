// The cookie that keeps the term the viewer chose in the header (Step 13): a choice of what to look
// at, which the server checks against the terms they may see. Its own file, so the switcher on the
// client reads it without the server's code.
export const TERM_COOKIE = "term";
// A year: the term cookie lasts as long as the sidebar's.
export const TERM_KEEP = 60 * 60 * 24 * 365;

// A link that opens a page on a term, as choosing it in the header does: a reminder's (lead review
// D). The header follows it only when the page loads whole.
export const loadsWhole = (href: string) => href.startsWith("/switch-term/");
