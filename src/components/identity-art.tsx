import Image from "next/image";
import { cn } from "@/components/ui/cn";

// The identity's decorative elements, fetched into public/brand/ by pnpm identity:sync (ADR-0004).
// The sizes are those of the files at the pinned identity commit. Decoration only: no alternative
// text and never under text that needs its contrast. Loaded lazily, so it never holds back a page's
// largest paint, except where it is that paint: art at the top of a page loads at once.
const ELEMENTS = {
  curves: { src: "/brand/element-curves.png", width: 2165, height: 1460 },
  wave: { src: "/brand/element-wave.png", width: 3508, height: 573 },
  dots: { src: "/brand/element-dot-grid.png", width: 4000, height: 2250 },
} as const;

export function IdentityArt({
  element,
  sizes,
  eager = false,
  className,
}: {
  element: keyof typeof ELEMENTS;
  /** The rendered width, so the optimizer serves a file of that size. */
  sizes: string;
  /** Above the fold, where the browser should fetch it with the page. */
  eager?: boolean;
  className?: string;
}) {
  const { src, width, height } = ELEMENTS[element];
  return (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      draggable={false}
      className={cn("pointer-events-none select-none", className)}
    />
  );
}
