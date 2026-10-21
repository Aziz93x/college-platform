import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import messages from "../messages/ar.json" with { type: "json" };

// node worker/print-check.ts: this image's Chromium prints one Arabic page to PDF in the identity
// font, and the PDF must hold the font and the text. Nothing comes from the network, so it passes on
// the stack's network, which has no route out (docs/PLAN.md, Step 41). Step 32 prints the real PDFs.
const IDENTITY_FONT = "DIN Next LT Arabic";
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const folder = mkdtempSync(join(tmpdir(), "print-check-"));
const page = join(folder, "page.html");
const pdf = join(folder, "page.pdf");
writeFileSync(
  page,
  `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<p style="font-family: '${IDENTITY_FONT}'">${escapeHtml(messages.platform.name)}</p></html>`,
);
// The sandbox needs privileges a container lacks; the page is the platform's own, read from disk.
execFileSync(
  "chromium-browser",
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${pdf}`,
    `file://${page}`,
  ],
  { stdio: "ignore" },
);
const fonts = execFileSync("pdffonts", [pdf], { encoding: "utf8" });
const text = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8" });
const embedded = fonts.includes(IDENTITY_FONT.replaceAll(" ", ""));
const arabic = /[؀-ۿﹰ-﻿]/.test(text);
if (!embedded || !arabic) {
  console.error(
    `print check failed: identity font ${embedded ? "embedded" : "missing"}, Arabic text ${arabic ? "found" : "missing"}`,
  );
  process.exit(1);
}
console.log("print check passed: one Arabic page in the identity font.");
