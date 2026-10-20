import { parseEnv } from "@/platform/config/env";

// Refuse to serve with an invalid environment, naming each bad variable.
try {
  parseEnv(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
