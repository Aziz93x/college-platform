import { afterEach, expect, it, vi } from "vitest";
import { createLogger } from "../../src/platform/logging/logger.ts";
import { onStopSignal } from "../../worker/shutdown.ts";

afterEach(() => {
  vi.useRealTimers();
});

function setup(stop: () => Promise<void>) {
  let output = "";
  const logger = createLogger({
    write: (line) => {
      output += line;
    },
  });
  const exit = vi.fn();
  const lines = () =>
    output
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  return { shutdown: onStopSignal(stop, logger, exit), exit, lines };
}

it("stops once and exits 0, however many signals arrive", async () => {
  const stop = vi.fn(async () => {});
  const { shutdown, exit } = setup(stop);

  await Promise.all([shutdown(), shutdown()]);

  expect(stop).toHaveBeenCalledOnce();
  expect(exit.mock.calls).toEqual([[0]]);
});

it("logs a failed stop as one JSON line and exits 1", async () => {
  const { shutdown, exit, lines } = setup(async () => {
    throw new Error("pool already closed");
  });

  await shutdown();

  expect(lines()).toEqual([
    expect.objectContaining({
      msg: "worker stop failed",
      reason: "pool already closed",
    }),
  ]);
  expect(exit.mock.calls).toEqual([[1]]);
});

it("exits 1 before Docker's SIGKILL at 10 s when the stop never ends", async () => {
  vi.useFakeTimers();
  const { shutdown, exit, lines } = setup(() => new Promise(() => {}));

  void shutdown();
  await vi.advanceTimersByTimeAsync(9499);
  expect(exit).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);

  expect(exit.mock.calls).toEqual([[1]]);
  expect(lines()).toEqual([
    expect.objectContaining({ msg: "worker stop timed out" }),
  ]);
});
