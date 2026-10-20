// Runs once when the server starts. The check exits the process, so it loads only on the Node.js runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs")
    await import("./instrumentation-node");
}
