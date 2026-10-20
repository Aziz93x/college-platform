import { parseEnv } from "../src/platform/config/env.ts";

// Job handlers arrive with pg-boss in Step 3; for now the worker validates its environment and waits.
try {
  parseEnv(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
console.log("worker ready");
setInterval(() => {}, 1 << 30);
