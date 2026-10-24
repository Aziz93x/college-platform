type SearchableCommand = {
  label: string;
  group?: string;
  keywords?: string[];
};

// Arabic words that differ only in how they are written match: the definite article (al-) before
// a word, taa marbuta written as haa, alef maqsura as yaa. NFKD has already taken the hamza off
// an alef. Escapes, because check:hardcode rejects Arabic script in src/.
function arabicForms(value: string) {
  return value
    .replace(/(^| )\u0627\u0644(?=\p{L}{2})/gu, "$1")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A");
}

function normalize(value: string) {
  return arabicForms(
    value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim(),
  );
}

function tokenScore(token: string, field: string) {
  const words = field.split(" ");
  if (words.includes(token)) return 100;
  if (words.some((word) => word.startsWith(token))) return 80;
  if (field.includes(token)) return 60;
  // Keep short queries precise; fuzzy abbreviations may skip at most two
  // letters within a word, rather than matching across a whole description.
  if (token.length < 3) return 0;
  for (const word of words) {
    if (word.length - token.length > 2) continue;
    let matched = 0;
    for (const char of word) {
      if (char === token[matched]) matched++;
    }
    if (matched === token.length) return 20;
  }
  return 0;
}

// The last search's items' words as matched: a search runs over the same items for each letter
// typed, such as the texts page's 2,114 texts, where working them out again took three quarters of
// a query (lead review D). Only the last search's are kept, so they never outgrow one search's
// items or outlast its people, and the words typed are not kept.
let known = new Map<string, string>();

/** Match every query word across fields and put direct name matches first. */
export function searchCommands<T extends SearchableCommand>(
  items: T[],
  query: string,
): T[] {
  const typed = normalize(query);
  if (!typed) return items;
  const tokens = typed.split(/\s+/);
  const seen = new Map<string, string>();
  const normalized = (value: string) => {
    const found = seen.get(value) ?? known.get(value) ?? normalize(value);
    seen.set(value, found);
    return found;
  };
  const found = items
    .map((item) => {
      const label = normalized(item.label);
      const fields = [
        label,
        normalized(item.group ?? ""),
        ...(item.keywords ?? []).map(normalized),
      ];
      let score = label === typed ? 10000 : label.startsWith(typed) ? 2000 : 0;
      for (const token of tokens) {
        const best = Math.max(
          ...fields.map((field, index) => {
            const match = tokenScore(token, field);
            return match ? match + (index === 0 ? 40 : 0) : 0;
          }),
        );
        if (!best) return { item, score: 0 };
        score += best;
      }
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
  known = seen;
  return found;
}
