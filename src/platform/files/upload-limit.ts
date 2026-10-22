// The largest body a server action takes (next.config.ts), so the largest file a page sends: a
// people file or a Rayat report, which the action reads whole. Ten megabytes, the size Next.js's
// proxy reads of any request already, hold a college's SF01 several times over. A guard on the
// server's memory, not a policy anyone sets.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
