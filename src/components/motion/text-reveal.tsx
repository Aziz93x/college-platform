import type { ElementType } from "react";
import { cn } from "@/components/ui/cn";

// Gap between one word's start and the next one's.
const STAGGER_MS = 90;

// BeUI's text reveal by word, as a CSS animation: the words are in the page's HTML and rise into
// place as it paints, without waiting for JavaScript (theme.css, --animate-reveal). Each word keeps
// the space after it, so the line still wraps between words. Under reduced motion the words are
// simply there.
export function TextReveal({
  text,
  as: Tag = "span",
  delayMs = 0,
  className,
}: {
  text: string;
  as?: ElementType;
  delayMs?: number;
  className?: string;
}) {
  const words = text.match(/\S+\s*/g) ?? [];
  return (
    <Tag className={cn("block", className)}>
      {words.map((word, index) => (
        <span
          // The same word can appear twice in a name; its place in the line tells them apart.
          // biome-ignore lint/suspicious/noArrayIndexKey: words never move within a fixed text
          key={index}
          className="inline-block animate-reveal whitespace-pre motion-reduce:animate-none"
          style={{ animationDelay: `${delayMs + index * STAGGER_MS}ms` }}
        >
          {word}
        </span>
      ))}
    </Tag>
  );
}
