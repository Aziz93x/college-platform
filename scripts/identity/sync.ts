// pnpm identity:sync: fetches the pinned identity files (ADR-0004: fonts and brand assets are
// gitignored) and renders src/styles/tokens.css and src/styles/token-names.ts. Needs only HTTPS, so it runs the same on the
// laptop, in CI and in the Docker build.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import lock from "./identity.lock.json" with { type: "json" };
import {
  type DigitalTokens,
  renderTokenNames,
  renderTokens,
  type TokenMapping,
} from "./render-tokens.ts";

export type IdentityLock = {
  repo: string;
  commit: string;
  files: { from: string; to: string; sha256: string }[];
  tokens: TokenMapping & { sha256: string };
};
type FetchFile = (url: string, init: RequestInit) => Promise<Response>;

const TOKENS_CSS = "src/styles/tokens.css";
const TOKEN_NAMES = "src/styles/token-names.ts";
// Each attempt gets this long; a network error, a timeout, a 429 or a 5xx is tried again, so a
// stalled or briefly failing download neither hangs nor fails CI and the Docker build.
const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const transient = (status: number) => status === 429 || status >= 500;

// "fetch failed" alone does not say why; undici puts the reason in the cause.
const reason = ({ message, cause }: Error) =>
  cause instanceof Error ? `${message}: ${cause.message}` : message;

async function fetchBytes(
  url: string,
  fetchFile: FetchFile,
  retryDelayMs: number,
) {
  for (let attempt = 1; ; attempt++) {
    const result: { bytes: Uint8Array } | { error: string; retry: boolean } =
      await fetchFile(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
        .then(async (response) =>
          response.ok
            ? { bytes: new Uint8Array(await response.arrayBuffer()) }
            : {
                error: `${url} answered ${response.status}`,
                retry: transient(response.status),
              },
        )
        .catch((error: Error) => ({ error: reason(error), retry: true }));
    if ("bytes" in result) return result.bytes;
    if (!result.retry || attempt === ATTEMPTS) throw new Error(result.error);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
  }
}

async function download(
  { repo, commit }: IdentityLock,
  path: string,
  expected: string,
  fetchFile: FetchFile,
  retryDelayMs: number,
) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${encoded}`;
  const bytes = await fetchBytes(url, fetchFile, retryDelayMs).catch(
    (error: Error) => {
      throw new Error(`${path}: ${error.message}`);
    },
  );
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(
      `${path}: sha256 ${actual} does not match the lock, ${expected}`,
    );
  }
  return bytes;
}

const readIfExists = (path: string) =>
  readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });

// Downloads and checks every file first and writes only when all of them match the lock, so a
// refused file leaves the working tree as it was.
export async function syncIdentity({
  root,
  lock,
  fetchFile = fetch,
  retryDelayMs = 1_000,
}: {
  root: string;
  lock: IdentityLock;
  fetchFile?: FetchFile;
  retryDelayMs?: number;
}) {
  const changed: [string, Uint8Array | string][] = [];
  const upToDate: string[] = [];
  for (const file of lock.files) {
    const current = await readIfExists(join(root, file.to));
    if (current && sha256(current) === file.sha256) {
      upToDate.push(file.to);
    } else {
      changed.push([
        file.to,
        await download(lock, file.from, file.sha256, fetchFile, retryDelayMs),
      ]);
    }
  }

  // The digital tokens are read in memory only; what they render is what gets committed.
  const source: DigitalTokens = JSON.parse(
    new TextDecoder().decode(
      await download(
        lock,
        lock.tokens.from,
        lock.tokens.sha256,
        fetchFile,
        retryDelayMs,
      ),
    ),
  );
  const rendered = [
    [TOKENS_CSS, renderTokens(source, lock)],
    [TOKEN_NAMES, renderTokenNames(source, lock)],
  ] as const;
  for (const [path, text] of rendered) {
    if ((await readIfExists(join(root, path)))?.toString("utf8") === text) {
      upToDate.push(path);
    } else {
      changed.push([path, text]);
    }
  }

  // A file cut short by a crash here no longer matches its sha256, so the next run fetches it again.
  for (const [path, data] of changed) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  return { written: changed.map(([path]) => path), upToDate };
}

if (import.meta.main) {
  try {
    const { written, upToDate } = await syncIdentity({
      root: join(import.meta.dirname, "../.."),
      lock,
    });
    for (const file of written) console.log(`identity:sync: wrote ${file}`);
    console.log(
      written.length === 0
        ? `identity:sync: all ${upToDate.length} files are up to date.`
        : `identity:sync: wrote ${written.length} files, ${upToDate.length} were up to date.`,
    );
  } catch (error) {
    console.error(`identity:sync failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
