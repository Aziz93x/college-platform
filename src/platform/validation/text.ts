// One line of text as someone typed it: trimmed, each run of spaces made one. No schema library
// here: client components tidy what is typed with it too, so they compare what the server keeps.
export function oneLine(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// Texts that differ only in the case of their Latin letters are one text when they name something,
// such as a department in Rayat's exports, which do not keep one case.
export function foldCase(value: string) {
  return value.toLowerCase();
}
