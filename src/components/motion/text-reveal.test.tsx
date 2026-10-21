import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TextReveal } from "./text-reveal.tsx";

it("puts every word in the HTML, each rising later than the one before, with its space kept", () => {
  const html = renderToStaticMarkup(
    <TextReveal as="h1" text="One two  one" delayMs={200} />,
  );
  expect(html).toMatch(/^<h1 class="block">/);
  const words = [
    ...html.matchAll(/animation-delay:(\d+)ms[^>]*>([^<]*)<\/span>/g),
  ].map(([, delay, word]) => [Number(delay), word]);
  expect(words).toEqual([
    [200, "One "],
    [290, "two  "],
    [380, "one"],
  ]);
  // Under reduced motion the words are simply there.
  expect(html.match(/motion-reduce:animate-none/g)).toHaveLength(3);
});
