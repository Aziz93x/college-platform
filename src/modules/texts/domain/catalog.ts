import {
  type MessageFormatElement,
  parse,
  TYPE,
} from "@formatjs/icu-messageformat-parser";

// A language's messages (messages/<lang>.json): names nested under names, as next-intl reads them.
// The design catalog's sample rows are lists, which are no one's words to change.
export type Catalog = { [name: string]: string | unknown[] | Catalog };

export type Text = { key: string; value: string };

// Every message of a catalog by its dotted key, in the catalog's order (ADR-0029).
export function flatten(catalog: Catalog, prefix = ""): Text[] {
  return Object.entries(catalog).flatMap(([name, value]) => {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === "string") return [{ key, value }];
    return Array.isArray(value) ? [] : flatten(value, key);
  });
}

function setPath(node: Catalog, path: string[], value: string): Catalog {
  const [name, ...rest] = path;
  const current = node[name as string];
  if (rest.length === 0) {
    return typeof current === "string"
      ? { ...node, [name as string]: value }
      : node;
  }
  return typeof current === "object" && !Array.isArray(current)
    ? { ...node, [name as string]: setPath(current, rest, value) }
    : node;
}

// The catalog with a college's wording laid over it: each change whose key the catalog still has,
// copying only the branches it changes. A key a release removed changes nothing.
export function applyTexts(catalog: Catalog, texts: readonly Text[]) {
  return texts.reduce(
    (current, { key, value }) => setPath(current, key.split("."), value),
    catalog,
  );
}

// What a message asks of the code that shows it: its arguments with their kind, those inside its
// plurals and selects, and its tags.
function shape(elements: MessageFormatElement[], into = new Set<string>()) {
  for (const element of elements) {
    if (element.type === TYPE.argument) into.add(`${element.value}`);
    if (element.type === TYPE.number) into.add(`${element.value}:number`);
    if (element.type === TYPE.date) into.add(`${element.value}:date`);
    if (element.type === TYPE.time) into.add(`${element.value}:time`);
    if (element.type === TYPE.select || element.type === TYPE.plural) {
      into.add(
        `${element.value}:${element.type === TYPE.select ? "select" : "plural"}`,
      );
      for (const option of Object.values(element.options)) {
        shape(option.value, into);
      }
    }
    if (element.type === TYPE.tag) {
      into.add(`<${element.value}>`);
      shape(element.children, into);
    }
  }
  return into;
}

export type TextProblem = "empty" | "syntax" | "arguments";

// Why a college's wording of a message cannot replace its default, if it cannot: it is empty, it
// does not parse as an ICU message, or it asks for other arguments or tags than the default, which
// the code that shows it would not give.
export function checkText(
  value: string,
  original: string,
): TextProblem | undefined {
  if (value.trim() === "") return "empty";
  let elements: MessageFormatElement[];
  try {
    elements = parse(value);
  } catch {
    return "syntax";
  }
  const expected = shape(parse(original));
  const given = shape(elements);
  return expected.size === given.size &&
    [...expected].every((part) => given.has(part))
    ? undefined
    : "arguments";
}
