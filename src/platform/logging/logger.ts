import pino, { type DestinationStream } from "pino";

// A database error carries the values its query ran with, in a params field and in its message and
// stack after "params:". They can hold a session token, so a logged error keeps the query and loses
// the values (lead review A).
const PARAMS = "\nparams:";

function withoutParams(text: string) {
  let result = text;
  for (
    let start = result.indexOf(PARAMS);
    start !== -1;
    start = result.indexOf(PARAMS, start)
  ) {
    // A stack goes on with its frames after the values.
    const frames = result.indexOf("\n    at ", start);
    result =
      result.slice(0, start) + (frames === -1 ? "" : result.slice(frames));
  }
  return result;
}

function serializeError(error: Error) {
  const { params: _values, ...serialized } = pino.stdSerializers.err(error);
  return {
    ...serialized,
    message: withoutParams(serialized.message),
    stack: withoutParams(serialized.stack),
  };
}

// JSON lines on stdout for the app and the worker. Uses only pino, so the worker can import it.
export function createLogger(destination?: DestinationStream) {
  return pino(
    {
      base: { service: "college-platform" },
      timestamp: pino.stdTimeFunctions.isoTime,
      serializers: { err: serializeError },
    },
    destination,
  );
}

export const logger = createLogger();
