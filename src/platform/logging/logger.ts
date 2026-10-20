import pino, { type DestinationStream } from "pino";

// JSON lines on stdout for the app and the worker. Uses only pino, so the worker can import it.
export function createLogger(destination?: DestinationStream) {
  return pino(
    {
      base: { service: "college-platform" },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}

export const logger = createLogger();
