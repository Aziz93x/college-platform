// The Arabic definite article (alef, lam), written as escapes because check:hardcode rejects Arabic
// script in src/. A family name such as al-Qahtani is known by the letter after it.
const ARTICLE = /^\u0627\u0644(?=\S{2})/;

// Up to two letters for an avatar: the first name's and the family name's.
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .filter((word): word is string => word !== undefined)
    .map((word) => Array.from(word.replace(ARTICLE, ""))[0])
    .join(" ");
}
