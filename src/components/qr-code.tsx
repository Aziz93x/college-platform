import { encode } from "uqr";

// A QR code drawn as one SVG path, one square per dark module, from text such as an authenticator
// app's otpauth:// address. Encoded here, so nothing leaves the page to draw it. The identity's
// darkest gray on white keeps the contrast scanners need.
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { size, data } = encode(value, { ecc: "M", border: 2 });
  const path = data
    .flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])),
    )
    .join("");
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} className="fill-background" />
      <path d={path} className="fill-foreground" />
    </svg>
  );
}
