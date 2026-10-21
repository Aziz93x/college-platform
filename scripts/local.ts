import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  chmodSync,
  createReadStream,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { networkInterfaces } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// The production-like stack on this laptop (docs/ops/local.md): docker/compose.yml with the
// production images, behind Caddy on https://localhost and on the laptop's LAN address.
const USAGE = `usage:
  pnpm local:up [--demo [--seed <n>]] [--images <folder>]
  pnpm local:down
  pnpm local:share
  pnpm local:run admin:create --name "<full name>" --email <email> --employee-number <number>`;

const DOCKER = fileURLToPath(new URL("../docker/", import.meta.url));
const ENV_FILE = join(DOCKER, ".env");

// Production-like data and demo data never share a database: each mode is a Compose project with its
// own volumes. Demo mode runs as staging, where seed:demo runs and the design catalog stays shut.
const MODES = {
  production: {
    project: "college",
    appEnv: "production",
    label: "production-like",
  },
  demo: { project: "college-demo", appEnv: "staging", label: "demo" },
} as const;
type Mode = keyof typeof MODES;

// What pnpm local:run runs inside the stack, which is where the database is.
const STACK_SCRIPTS: Record<string, string> = {
  "admin:create": "scripts/admin-create.ts",
  "seed:demo": "db/seed/demo.ts",
};

// Typed on a phone in a demo: four groups of four from letters and digits that do not look alike.
const READABLE = "abcdefghjkmnpqrstuvwxyz23456789";
const readablePassword = () =>
  Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => READABLE[randomInt(READABLE.length)]).join(
      "",
    ),
  ).join("-");

// Every other empty value: 32 random bytes, URL-safe, since the passwords go into database URLs.
const generators: Record<string, () => string> = {
  DEMO_PASSWORD: readablePassword,
};
const randomSecret = () => randomBytes(32).toString("base64url");

const ASSIGNMENT = /^([A-Z][A-Z0-9_]*)=(.*)$/;

/**
 * docker/.env from the example: a value already set stays, an empty one gets a new random value,
 * and keys the example lacks stay as they are. Returns the names it filled, never their values.
 */
export function fillEnv(example: string, current = "") {
  const kept = new Map<string, string>();
  for (const line of current.split("\n")) {
    const match = ASSIGNMENT.exec(line);
    if (match?.[2]) kept.set(match[1], match[2]);
  }
  const filled: string[] = [];
  const lines = example.split("\n").map((line) => {
    const match = ASSIGNMENT.exec(line);
    if (!match) return line;
    const [, key, value] = match;
    const existing = kept.get(key);
    kept.delete(key);
    if (existing) return `${key}=${existing}`;
    if (value) return line;
    filled.push(key);
    return `${key}=${(generators[key] ?? randomSecret)()}`;
  });
  const extra = [...kept].map(([key, value]) => `${key}=${value}`);
  return { text: [...lines, ...extra].join("\n"), filled };
}

/** The laptop's address on its local network, which a phone on the same Wi-Fi opens. */
export function lanAddress(interfaces = networkInterfaces()) {
  for (const [name, entries] of Object.entries(interfaces)) {
    // Docker's own bridges carry private addresses too, but no phone reaches them.
    if (/^(docker|br-|veth)/.test(name)) continue;
    for (const entry of entries ?? []) {
      if (
        entry.family === "IPv4" &&
        !entry.internal &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)
      ) {
        return entry.address;
      }
    }
  }
  return undefined;
}

function sha256(file: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

/**
 * The image archives in a folder, as `docker save` wrote them for approved media: each one listed in
 * the folder's SHA256SUMS must match its checksum before docker load reads it.
 */
export async function verifyArchives(folder: string) {
  const lines = readFileSync(join(folder, "SHA256SUMS"), "utf8")
    .split("\n")
    .filter((line) => line.trim());
  const archives: string[] = [];
  for (const line of lines) {
    const match = /^([0-9a-f]{64}) [ *]?(.+)$/.exec(line.trim());
    if (!match || basename(match[2]) !== match[2]) {
      throw new Error(`SHA256SUMS: cannot read "${line}"`);
    }
    const archive = join(folder, match[2]);
    if ((await sha256(archive)) !== match[1]) {
      throw new Error(`${match[2]} does not match its checksum`);
    }
    archives.push(archive);
  }
  if (archives.length === 0) throw new Error("SHA256SUMS lists no archive");
  return archives;
}

// docker/.env as it stands, or nothing before the first start.
function readEnvFile() {
  try {
    return readFileSync(ENV_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function run(
  command: string,
  args: string[],
  env: Record<string, string> = {},
) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.slice(0, 3).join(" ")} failed`);
  }
}

function compose(mode: Mode, args: string[], env: Record<string, string> = {}) {
  run(
    "docker",
    [
      "compose",
      "--project-name",
      MODES[mode].project,
      "--file",
      join(DOCKER, "compose.yml"),
      "--env-file",
      ENV_FILE,
      ...args,
    ],
    { APP_ENV: MODES[mode].appEnv, ...env },
  );
}

function isRunning(mode: Mode) {
  const result = spawnSync(
    "docker",
    [
      "ps",
      "--quiet",
      "--filter",
      `label=com.docker.compose.project=${MODES[mode].project}`,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error("docker is not running");
  return result.stdout.trim() !== "";
}

function runningMode() {
  const mode = (Object.keys(MODES) as Mode[]).find(isRunning);
  if (!mode)
    throw new Error("no stack is running: start one with pnpm local:up");
  return mode;
}

// Caddy answers on the LAN address too, with a certificate from its own root.
function siteEnv() {
  const lan = lanAddress();
  return {
    lan,
    env: {
      SITE_ADDRESS: lan ? `localhost, ${lan}` : "localhost",
      DEFAULT_SNI: lan ?? "localhost",
    },
  };
}

async function up(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      demo: { type: "boolean", default: false },
      seed: { type: "string", default: "42" },
      images: { type: "string" },
    },
  });
  const mode: Mode = values.demo ? "demo" : "production";
  const other: Mode = values.demo ? "production" : "demo";
  if (isRunning(other)) {
    throw new Error(
      `the ${MODES[other].label} stack is running: stop it first with pnpm local:down`,
    );
  }
  const { text, filled } = fillEnv(
    readFileSync(join(DOCKER, ".env.example"), "utf8"),
    readEnvFile(),
  );
  writeFileSync(ENV_FILE, text, { mode: 0o600 });
  // A file copied from the example by hand keeps its mode: only this person reads the secrets.
  chmodSync(ENV_FILE, 0o600);
  if (filled.length > 0) {
    console.log(`docker/.env: new values for ${filled.join(", ")}, not shown.`);
  }

  const { lan, env } = siteEnv();
  const start = ["up", "--detach", "--wait"];
  if (values.images) {
    for (const archive of await verifyArchives(values.images)) {
      run("docker", ["load", "--input", archive]);
    }
    start.push("--pull", "never", "--no-build");
  } else {
    start.push("--build");
  }
  compose(mode, start, env);
  if (mode === "demo") {
    compose(
      mode,
      [
        "run",
        "--rm",
        "migrate",
        "node",
        STACK_SCRIPTS["seed:demo"],
        "--seed",
        values.seed,
      ],
      env,
    );
  }

  const addresses = ["https://localhost", ...(lan ? [`https://${lan}`] : [])];
  console.log(
    `\nThe ${MODES[mode].label} stack is up: ${addresses.join(" and ")}.`,
  );
  console.log(
    mode === "demo"
      ? "Demo accounts sign in with DEMO_PASSWORD from docker/.env (docs/ops/local.md)."
      : `On the first start, create the first admin:\n  ${USAGE.split("\n").at(-1)?.trim()}`,
  );
}

function down() {
  for (const mode of Object.keys(MODES) as Mode[]) {
    if (isRunning(mode)) compose(mode, ["down"]);
  }
}

function share() {
  if (!isRunning("demo")) {
    throw new Error(
      "pnpm local:share opens the demo stack only: start it with pnpm local:up --demo",
    );
  }
  compose(
    "demo",
    ["--profile", "share", "run", "--rm", "share"],
    siteEnv().env,
  );
}

function runInStack([name, ...args]: string[]) {
  const file = STACK_SCRIPTS[name ?? ""];
  if (!file)
    throw new Error(
      `pnpm local:run takes ${Object.keys(STACK_SCRIPTS).join(" or ")}`,
    );
  compose(
    runningMode(),
    ["run", "--rm", "migrate", "node", file, ...args],
    siteEnv().env,
  );
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "up") await up(args);
    else if (command === "down") down();
    else if (command === "share") share();
    else if (command === "run") runInStack(args);
    else throw new Error(USAGE);
  } catch (error) {
    console.error(`local: ${(error as Error).message}`);
    process.exit(1);
  }
}
