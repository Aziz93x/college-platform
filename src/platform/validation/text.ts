// One line of text as someone typed it: trimmed, each run of spaces made one. No schema library
// here: client components tidy what is typed with it too, so they compare what the server keeps.
export function oneLine(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// A paragraph as someone typed it: each line as oneLine leaves it, and no more than one empty line
// in a row, so what is kept reads as it was written.
export function paragraph(value: string) {
  return value
    .split(/\r?\n/)
    .map(oneLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Texts that differ only in the case of their Latin letters are one text when they name something,
// such as a department in Rayat's exports, which do not keep one case.
export function foldCase(value: string) {
  return value.toLowerCase();
}

// A value as one text whatever the order of its objects' keys, which a jsonb column does not keep,
// so two values compare the same however they were stored.
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_, inner) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : inner,
  );
}
