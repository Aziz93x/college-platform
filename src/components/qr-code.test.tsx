import { renderToStaticMarkup } from "react-dom/server";
import { encode } from "uqr";
import { expect, it } from "vitest";
import { QrCode } from "./qr-code.tsx";

it("draws one square for each dark module of the code, labelled for assistive technology", () => {
  const value = "otpauth://totp/Platform:person%40college.example?secret=ABC";
  const html = renderToStaticMarkup(<QrCode value={value} label="Scan me" />);
  const { size, data } = encode(value, { ecc: "M", border: 2 });

  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="Scan me"');
  expect(html).toContain(`viewBox="0 0 ${size} ${size}"`);
  const squares = html.match(/M\d+ \d+h1v1h-1z/g) ?? [];
  expect(squares).toHaveLength(data.flat().filter(Boolean).length);
  expect(squares.length).toBeGreaterThan(0);
});
