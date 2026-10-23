// The versions of the framework or of a department's plan, newest first, each in its own words:
// one list on both pages (UX review 2).
export function Versions({
  id,
  title,
  versions,
}: {
  /** The heading's id, which names the list. */
  id: string;
  title: string;
  versions: readonly { version: number; words: string }[];
}) {
  if (versions.length === 0) return null;
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border bg-card shadow-xs"
    >
      <h2 id={id} className="px-5 pt-5 font-medium text-base sm:px-6">
        {title}
      </h2>
      <ol className="mt-3 divide-y border-t">
        {versions.map((each) => (
          <li key={each.version} className="px-5 py-3 text-sm sm:px-6">
            {each.words}
          </li>
        ))}
      </ol>
    </section>
  );
}
