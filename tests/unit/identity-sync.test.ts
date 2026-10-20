import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  type IdentityLock,
  syncIdentity,
} from "../../scripts/identity/sync.ts";

const sha256 = (data: string) =>
  createHash("sha256").update(data).digest("hex");

const font = "font bytes";
const logo = "<svg/>";
const tokens = JSON.stringify({
  tokens: {
    "support-r1-c1": { row_from_top: 1, column_from_left: 1, hex: "#4B4D4E" },
  },
});
const lock: IdentityLock = {
  repo: "owner/identity",
  commit: "0123abc",
  files: [
    {
      from: "assets/identity/الخطوط -Fonts/Font Regular.ttf",
      to: "src/styles/fonts/font-400.ttf",
      sha256: sha256(font),
    },
    {
      from: "assets/identity/logo.svg",
      to: "public/brand/logo.svg",
      sha256: sha256(logo),
    },
  ],
  tokens: {
    from: "assets/digital-tokens.json",
    sha256: sha256(tokens),
    hues: ["gray"],
    light: { foreground: "support-r1-c1" },
    dark: { foreground: "white" },
    extra: {},
  },
};
const base = "https://raw.githubusercontent.com/owner/identity/0123abc";
const fontUrl = `${base}/assets/identity/%D8%A7%D9%84%D8%AE%D8%B7%D9%88%D8%B7%20-Fonts/Font%20Regular.ttf`;
const logoUrl = `${base}/assets/identity/logo.svg`;
const tokensUrl = `${base}/assets/digital-tokens.json`;
const fontPath = "src/styles/fonts/font-400.ttf";
const logoPath = "public/brand/logo.svg";
const all = { [fontUrl]: font, [logoUrl]: logo, [tokensUrl]: tokens };

let root: string;
let requested: string[];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "identity-sync-"));
  requested = [];
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function serve(files: Record<string, string>) {
  return async (url: string, init: RequestInit) => {
    requested.push(url);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    return new Response(files[url] ?? "", {
      status: url in files ? 200 : 404,
    });
  };
}

// Answers each URL with the given failures first, then with the file.
function flaky(failures: Record<string, (Response | Error)[]>) {
  const files = serve(all);
  return async (url: string, init: RequestInit) => {
    const failure = failures[url]?.shift();
    if (failure instanceof Error) {
      requested.push(url);
      throw failure;
    }
    if (failure) {
      requested.push(url);
      return failure;
    }
    return files(url, init);
  };
}

it("fetches each file at the pinned commit by its percent-encoded path", async () => {
  const result = await syncIdentity({ root, lock, fetchFile: serve(all) });
  expect(requested).toEqual([fontUrl, logoUrl, tokensUrl]);
  expect(readFileSync(join(root, fontPath), "utf8")).toBe(font);
  expect(readFileSync(join(root, logoPath), "utf8")).toBe(logo);
  expect(readFileSync(join(root, "src/styles/tokens.css"), "utf8")).toContain(
    "--palette-gray-1: #4b4d4e;",
  );
  expect(
    readFileSync(join(root, "src/styles/token-names.ts"), "utf8"),
  ).toContain('"--palette-gray-1",');
  expect(result).toEqual({
    written: [
      fontPath,
      logoPath,
      "src/styles/tokens.css",
      "src/styles/token-names.ts",
    ],
    upToDate: [],
  });
});

it("refuses a file whose sha256 differs from the lock, names it and writes nothing", async () => {
  // The second file is refused after the first one matched: the first is not written either.
  const sync = syncIdentity({
    root,
    lock,
    fetchFile: serve({ ...all, [logoUrl]: "tampered" }),
  });
  await expect(sync).rejects.toThrow(
    `${lock.files[1].from}: sha256 ${sha256("tampered")} does not match the lock`,
  );
  expect(requested).toEqual([fontUrl, logoUrl]);
  expect(readdirSync(root)).toEqual([]);
});

it("names the file the server does not have, without asking again", async () => {
  const { [fontUrl]: _missing, ...rest } = all;
  await expect(
    syncIdentity({ root, lock, fetchFile: serve(rest) }),
  ).rejects.toThrow(`${lock.files[0].from}: ${fontUrl} answered 404`);
  expect(requested).toEqual([fontUrl]);
});

it("tries a network error, a timeout, a 429 or a 5xx again", async () => {
  const fetchFile = flaky({
    [fontUrl]: [
      new Error("fetch failed", { cause: new Error("ECONNRESET") }),
      new Response("", { status: 503 }),
    ],
    [logoUrl]: [
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      ),
      new Response("", { status: 429 }),
    ],
  });
  await syncIdentity({ root, lock, fetchFile, retryDelayMs: 0 });
  expect(requested).toEqual([
    fontUrl,
    fontUrl,
    fontUrl,
    logoUrl,
    logoUrl,
    logoUrl,
    tokensUrl,
  ]);
  expect(readFileSync(join(root, fontPath), "utf8")).toBe(font);
});

it("gives up after three attempts and says why", async () => {
  const reset = () =>
    new Error("fetch failed", { cause: new Error("ECONNRESET") });
  const fetchFile = flaky({ [fontUrl]: [reset(), reset(), reset()] });
  await expect(
    syncIdentity({ root, lock, fetchFile, retryDelayMs: 0 }),
  ).rejects.toThrow(`${lock.files[0].from}: fetch failed: ECONNRESET`);
  expect(requested).toEqual([fontUrl, fontUrl, fontUrl]);
  expect(readdirSync(root)).toEqual([]);
});

it("skips a file whose bytes already match, then reports everything up to date", async () => {
  mkdirSync(join(root, "src/styles/fonts"), { recursive: true });
  writeFileSync(join(root, fontPath), font);
  const fetchFile = serve(all);

  const first = await syncIdentity({ root, lock, fetchFile });
  expect(requested).toEqual([logoUrl, tokensUrl]);
  expect(first).toEqual({
    written: [logoPath, "src/styles/tokens.css", "src/styles/token-names.ts"],
    upToDate: [fontPath],
  });

  const second = await syncIdentity({ root, lock, fetchFile });
  expect(second).toEqual({
    written: [],
    upToDate: [
      fontPath,
      logoPath,
      "src/styles/tokens.css",
      "src/styles/token-names.ts",
    ],
  });
});
