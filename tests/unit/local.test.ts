import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import type { NetworkInterfaceInfo } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fillEnv, lanAddress, verifyArchives } from "../../scripts/local.ts";

const EXAMPLE = [
  "# A comment",
  "APP_URL=https://localhost",
  "POSTGRES_PASSWORD=",
  "AUTH_SECRET=",
  'SEED_COLLEGE_NAME="College name"',
  "DEMO_PASSWORD=",
].join("\n");

const value = (text: string, key: string) =>
  new RegExp(`^${key}=(.*)$`, "m").exec(text)?.[1];

describe("fillEnv", () => {
  it("fills each empty value with a new random one and names it, without its value", () => {
    const { text, filled } = fillEnv(EXAMPLE);
    expect(filled).toEqual([
      "POSTGRES_PASSWORD",
      "AUTH_SECRET",
      "DEMO_PASSWORD",
    ]);
    expect(value(text, "APP_URL")).toBe("https://localhost");
    expect(value(text, "SEED_COLLEGE_NAME")).toBe('"College name"');
    // URL-safe, since the passwords go into database URLs.
    expect(value(text, "POSTGRES_PASSWORD")).toMatch(/^[\w-]{43}$/);
    expect(value(text, "AUTH_SECRET")).not.toBe(
      value(text, "POSTGRES_PASSWORD"),
    );
    // Typed on a phone in a demo.
    expect(value(text, "DEMO_PASSWORD")).toMatch(
      /^[a-hj-km-np-z2-9]{4}(-[a-hj-km-np-z2-9]{4}){3}$/,
    );
    expect(text).toContain("# A comment");
  });

  it("keeps every value already set, and the keys the example lacks", () => {
    const first = fillEnv(EXAMPLE).text;
    const { text, filled } = fillEnv(
      EXAMPLE.replace("APP_URL=https://localhost", "APP_URL=https://other"),
      `${first}\nEXTRA=kept`,
    );
    expect(filled).toEqual([]);
    for (const key of ["POSTGRES_PASSWORD", "AUTH_SECRET", "DEMO_PASSWORD"]) {
      expect(value(text, key)).toBe(value(first, key));
    }
    expect(value(text, "APP_URL")).toBe("https://localhost");
    expect(value(text, "EXTRA")).toBe("kept");
  });

  it("fills a value left empty in the current file", () => {
    const { text, filled } = fillEnv(EXAMPLE, "AUTH_SECRET=");
    expect(filled).toContain("AUTH_SECRET");
    expect(value(text, "AUTH_SECRET")).toMatch(/^[\w-]{43}$/);
  });
});

describe("lanAddress", () => {
  const entry = (address: string, internal = false) =>
    ({ address, family: "IPv4", internal }) as NetworkInterfaceInfo;

  it("picks the laptop's private address, not loopback or Docker's bridges", () => {
    expect(
      lanAddress({
        lo: [entry("127.0.0.1", true)],
        docker0: [entry("172.17.0.1")],
        "br-1a2b": [entry("172.18.0.1")],
        wlan0: [entry("192.168.1.20")],
      }),
    ).toBe("192.168.1.20");
  });

  it("finds none when the laptop has no local network", () => {
    expect(lanAddress({ lo: [entry("127.0.0.1", true)] })).toBeUndefined();
    expect(lanAddress({ eth0: [entry("203.0.113.5")] })).toBeUndefined();
  });
});

describe("verifyArchives", () => {
  function folderWith(files: Record<string, string>, sums: string) {
    const folder = mkdtempSync(join(tmpdir(), "archives-"));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(folder, name), content);
    }
    writeFileSync(join(folder, "SHA256SUMS"), sums);
    return folder;
  }
  const hash = (content: string) =>
    createHash("sha256").update(content).digest("hex");

  it("lists the archives that match their checksums", async () => {
    const folder = folderWith(
      { "app.tar": "app", "worker.tar": "worker" },
      `${hash("app")}  app.tar\n${hash("worker")} *worker.tar\n`,
    );
    expect(await verifyArchives(folder)).toEqual([
      join(folder, "app.tar"),
      join(folder, "worker.tar"),
    ]);
  });

  it("refuses an archive changed since its checksum, a path out of the folder and an empty list", async () => {
    await expect(
      verifyArchives(
        folderWith({ "app.tar": "changed" }, `${hash("app")}  app.tar`),
      ),
    ).rejects.toThrow("app.tar does not match its checksum");
    await expect(
      verifyArchives(folderWith({}, `${hash("x")}  ../outside.tar`)),
    ).rejects.toThrow("SHA256SUMS: cannot read");
    await expect(verifyArchives(folderWith({}, "\n"))).rejects.toThrow(
      "SHA256SUMS lists no archive",
    );
  });
});
