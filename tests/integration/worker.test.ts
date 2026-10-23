import { spawn } from "node:child_process";
import { TestClock } from "pg-boss";
import { afterAll, expect, it, onTestFinished, vi } from "vitest";
import { createLogger } from "../../src/platform/logging/logger.ts";
import { startWorker } from "../../worker/start.ts";
import { createTestDatabase, scriptEnv } from "./support/database.ts";

const databases: Awaited<ReturnType<typeof createTestDatabase>>[] = [];

// One database per test, so a worker in one test never takes another test's jobs.
async function freshDatabase() {
  const database = await createTestDatabase();
  databases.push(database);
  return database;
}

afterAll(() => Promise.all(databases.map((database) => database.drop())));

function parseLines(output: string) {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// A logger that keeps its JSON lines in memory.
function captureLogs() {
  let output = "";
  const logger = createLogger({
    write: (line) => {
      output += line;
    },
  });
  return { logger, lines: () => parseLines(output) };
}

it("schedules the heartbeat every minute, logs each job, records the beat and stops", async () => {
  const { url, pool } = await freshDatabase();
  const { logger, lines } = captureLogs();
  const { boss, stop } = await startWorker({ databaseUrl: url, logger });

  try {
    expect((await boss.getSchedule("heartbeat"))?.cron).toBe("* * * * *");

    const jobId = await boss.send("heartbeat");
    await vi.waitFor(
      () =>
        expect(lines()).toContainEqual(
          expect.objectContaining({
            msg: "heartbeat",
            queue: "heartbeat",
            jobId,
          }),
        ),
      { timeout: 10_000, interval: 100 },
    );
    // The beat the system page reads (ADR-0029).
    await vi.waitFor(
      async () =>
        expect(
          (await pool.query("select worker from worker_heartbeats")).rows,
        ).toEqual([{ worker: "worker" }]),
      { timeout: 10_000, interval: 100 },
    );

    // A lost connection reaches the boss as an error event: logged, never thrown.
    boss.emit("error", new Error("connection lost"));
    expect(lines()).toContainEqual(
      expect.objectContaining({
        msg: "pg-boss error",
        reason: "connection lost",
      }),
    );
  } finally {
    await stop();
  }
  expect(lines().at(-1)).toMatchObject({ msg: "worker stopped" });
});

it("runs one heartbeat a minute from the schedule", async () => {
  const { url } = await freshDatabase();
  const { logger, lines } = captureLogs();
  const clock = new TestClock("2026-01-01T00:00:45Z");
  const { stop } = await startWorker({ databaseUrl: url, logger, clock });
  const heartbeats = () =>
    lines().filter((line) => line.msg === "heartbeat").length;

  try {
    // pg-boss sends an occurrence up to 60 s late, so the start may or may not send 00:00.
    // Each minute's occurrence is logged within about 40 s, before the next check at :45.
    await clock.tick(60_000);
    const first = heartbeats();
    expect(first).toBeGreaterThanOrEqual(1);
    for (const minute of [1, 2]) {
      await clock.tick(60_000);
      await vi.waitFor(() => expect(heartbeats()).toBe(first + minute), {
        timeout: 10_000,
        interval: 100,
      });
    }
  } finally {
    await stop();
  }
});

it("waits 8 s for a running job, then stops inside Docker's 10 s grace", async () => {
  const { url } = await freshDatabase();
  const { boss, stop } = await startWorker({
    databaseUrl: url,
    logger: captureLogs().logger,
  });
  let started = () => {};
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  await boss.createQueue("stuck");
  await boss.work("stuck", () => {
    started();
    return new Promise(() => {});
  });
  await boss.send("stuck");
  await running;

  const stopping = performance.now();
  await stop();
  const elapsed = performance.now() - stopping;

  expect(elapsed).toBeGreaterThanOrEqual(7500);
  expect(elapsed).toBeLessThan(10_000);
});

function spawnWorker(url: string) {
  const child = spawn(process.execPath, ["worker/index.ts"], {
    env: scriptEnv(url),
  });
  // A test that fails before its signal must not leave the worker running.
  onTestFinished(() => {
    child.kill("SIGKILL");
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  const exitCode = new Promise<number | null>((resolve) =>
    child.on("exit", resolve),
  );
  const messages = () => parseLines(stdout).map((line) => line.msg);
  return { child, exitCode, messages };
}

it.each([
  ["SIGTERM", ["SIGTERM"]],
  ["SIGINT", ["SIGINT"]],
  ["SIGTERM then SIGINT", ["SIGTERM", "SIGINT"]],
] as const)("%s stops the worker once and exits 0 within 10 s", async (_name, signals) => {
  const { url } = await freshDatabase();
  const worker = spawnWorker(url);
  await vi.waitFor(
    () => expect(worker.messages()).toContain("worker started"),
    { timeout: 30_000, interval: 100 },
  );

  const signalled = performance.now();
  for (const signal of signals) worker.child.kill(signal);

  expect(await worker.exitCode).toBe(0);
  expect(performance.now() - signalled).toBeLessThan(10_000);
  expect(
    worker.messages().filter((msg) => msg === "worker stopped"),
  ).toHaveLength(1);
});

it("logs one JSON line and exits 1 when the database is unreachable at start", async () => {
  const worker = spawnWorker("postgres://college:college@127.0.0.1:1/college");

  expect(await worker.exitCode).toBe(1);
  expect(worker.messages()).toEqual(["worker failed to start"]);
});
