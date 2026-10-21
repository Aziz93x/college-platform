import { cn } from "@/components/ui/cn";

// BeUI's loader, its spinner only: a faint ring and an arc that turns. The turn is a CSS animation,
// so it runs before the page's JavaScript; under reduced motion the arc stands still.
export function Loader({
  size = 16,
  label,
  className,
}: {
  size?: number;
  /** Announced while the loader shows; omit it when the button's text already says so. */
  label?: string;
  className?: string;
}) {
  const stroke = Math.max(2, size * 0.12);
  const r = (size - stroke) / 2;
  const c = size / 2;
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="animate-spin"
        aria-hidden="true"
      >
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={stroke}
        />
        <path
          d={`M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c + r} ${c}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
