import type { Instrumentation } from "next";

// Runs once when the server starts. The check exits the process, so it loads only on the Node.js runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs")
    await import("./instrumentation-node");
}

// Next calls this for every server error; the logger runs only on the Node.js runtime.
export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logRequestError } = await import("@/platform/logging/request-error");
  await logRequestError(...args);
};
