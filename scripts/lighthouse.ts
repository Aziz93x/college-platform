import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEMO_PASSWORD, demoAccounts } from "../db/seed/demo/accounts.ts";
import { getAuth } from "../src/modules/identity/index.ts";
import { getPool } from "../src/platform/db/client.ts";

// pnpm lighthouse: section 4's targets on phone emulation (lighthouserc.json) for the login page,
// signed out, and for Today as the demo trainer (pnpm seed:demo). Each run starts the built server
// itself; the reports land in .lighthouseci/.
const BASE = "http://localhost:3000";

// lhci's own entry, run with this Node, so no shell parses the arguments on any system.
const LHCI = fileURLToPath(import.meta.resolve("@lhci/cli/src/cli.js"));
const lhci = (args: string[]) =>
  execFileSync(process.execPath, [LHCI, ...args], { stdio: "inherit" });

// A session for the demo trainer, as the browser would send its cookie back.
const { headers } = await getAuth().api.signInEmail({
  body: {
    email: demoAccounts.trainer.email,
    password: DEMO_PASSWORD,
    rememberMe: false,
  },
  returnHeaders: true,
});
await getPool().end();
const cookie = headers
  .getSetCookie()
  .map((entry) => entry.split(";")[0])
  .join("; ");

lhci(["collect", `--url=${BASE}/`]);
lhci([
  "collect",
  "--additive",
  `--url=${BASE}/today`,
  `--settings.extraHeaders=${JSON.stringify({ Cookie: cookie })}`,
]);
lhci(["assert"]);
lhci(["upload"]);
