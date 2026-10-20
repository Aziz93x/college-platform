import Image from "next/image";
import { cn } from "@/components/ui/cn";

// The identity's decorative elements, fetched into public/brand/ by pnpm identity:sync (ADR-0004).
// The sizes are those of the files at the pinned identity commit. Decoration only: no alternative
// text, never under text that needs its contrast, and loaded lazily, so it never holds back a
// page's largest paint.
const ELEMENTS = {
  curves: { src: "/brand/element-curves.png", width: 2165, height: 1460 },
  wave: { src: "/brand/element-wave.png", width: 3508, height: 573 },
  dots: { src: "/brand/element-dot-grid.png", width: 4000, height: 2250 },
} as const;

export function IdentityArt({
  element,
  sizes,
  className,
}: {
  element: keyof typeof ELEMENTS;
  /** The rendered width, so the optimizer serves a file of that size. */
  sizes: string;
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
      draggable={false}
      className={cn("pointer-events-none select-none", className)}
    />
  );
}
