import { connection } from "next/server";

// Liveness: the process answers. It never touches the database, so an outage does not restart the app.
export async function GET() {
  await connection();
  return Response.json({ status: "ok" });
}
