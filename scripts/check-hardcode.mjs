// Fails when domain values are written in code instead of data (CLAUDE.md, "Capabilities in code").
// Usage: node scripts/check-hardcode.mjs [root]   (root defaults to the repository root)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;
const TEST_FILE = /(\.test\.|\.spec\.|[\\/]__tests__[\\/])/;
const TOKENS_FILE = ["src", "styles", "tokens.css"].join(sep);

const RULES = [
  {
    name: "arabic-text",
    message: "Arabic text belongs in messages/*.json or the database",
    pattern: /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/,
  },
  {
    name: "role-name-comparison",
    message: "check a permission key with authorize(), never a role name",
    pattern:
      /\b\w*roles?(Name|Key|Slug|Code)?\b\s*(===|!==|==|!=)\s*["'`]|["'`][^"'`]*["'`]\s*(===|!==|==|!=)\s*[\w.?]*\broles?(Name|Key|Slug|Code)?\b|\b\w*roles?(Names|Keys)?\??\.includes\(\s*["'`]|\bhasRole\(\s*\w*,?\s*["'`]/i,
  },
  {
    name: "hex-color",
    message: "colors come from src/styles/tokens.css",
    pattern:
      /(^|[\s:("'`,[])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/,
    allow: (file) => file === TOKENS_FILE,
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

export function findHardcodedValues(root) {
  const srcDir = join(root, "src");
  let files;
  try {
    files = [...walk(srcDir)];
  } catch {
    return [];
  }
  const findings = [];
  for (const path of files) {
    const file = relative(root, path);
    if (!SOURCE_EXTENSIONS.test(file) || TEST_FILE.test(file)) continue;
    const lines = readFileSync(path, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (rule.allow?.(file)) continue;
        if (rule.pattern.test(line)) {
          findings.push({
            file,
            line: index + 1,
            rule: rule.name,
            message: rule.message,
          });
        }
      }
    });
  }
  return findings;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? process.cwd();
  const findings = findHardcodedValues(root);
  for (const f of findings)
    console.error(`${f.file}:${f.line}  ${f.rule}  ${f.message}`);
  if (findings.length > 0) {
    console.error(`check:hardcode failed with ${findings.length} finding(s).`);
    process.exit(1);
  }
  console.log("check:hardcode passed.");
}
