// Arabic-Indic (U+0660 to U+0669) and Extended Arabic-Indic (U+06F0 to U+06F9) digits, written as
// escapes because check:hardcode rejects Arabic script in src/.
const ARABIC_INDIC_DIGIT = /[\u0660-\u0669\u06F0-\u06F9]/g;
// The Arabic decimal separator (U+066B) and thousands separator (U+066C) that Arabic keyboards type
// between those digits, as their Latin counterparts.
const ARABIC_SEPARATOR = /[\u066B\u066C]/g;
const LATIN_SEPARATOR: Record<string, string> = {
  "\u066B": ".",
  "\u066C": ",",
};

// Both digit ranges start at a multiple of 16, so a digit's value is its code point modulo 16.
// No schema library here: client components convert typed digits with it too.
export function toLatinDigits(value: string) {
  return value
    .replace(ARABIC_INDIC_DIGIT, (digit) => String(digit.charCodeAt(0) % 16))
    .replace(ARABIC_SEPARATOR, (separator) => LATIN_SEPARATOR[separator]);
}
