import { writeAudit } from "../../audit/index.ts";
import { getAuth } from "./auth.ts";
import { requestMeta } from "./request.ts";

// Ends the session this request carries and records it.
export async function signOut(
  user: { userId: string; collegeId: string },
  requestHeaders: Headers,
) {
  await getAuth().api.signOut({ headers: requestHeaders });
  await writeAudit({
    collegeId: user.collegeId,
    actorId: user.userId,
    action: "session.signOut",
    entityType: "user",
    entityId: user.userId,
    ...requestMeta(requestHeaders),
  });
}
