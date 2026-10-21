// A role's name in a language: its own label in that language, or the first it has.
export function roleLabel(labels: Record<string, string>, language: string) {
  return labels[language] ?? Object.values(labels)[0] ?? "";
}
