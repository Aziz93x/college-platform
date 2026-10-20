// Fails when domain values are written in code instead of data (CLAUDE.md, "Capabilities in code").
// Usage: node scripts/check-hardcode.mjs [root]   (root defaults to the repository root)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;
const TEST_FILE = /(\.test\.|\.spec\.|[\\/]__tests__[\\/])/;
const TOKENS_FILE = ["src", "styles", "tokens.css"].join(sep);

const ROLE = /role/i;
// A string literal that can hold a role key or name. Permission keys ("roles.assign"), message
// keys ("roles.title") and paths ("/admin/roles") hold a dot or a slash, so they are not one.
const NAME = "(?:\"[^\"./]+\"|'[^'./]+'|`[^`./]+`)";
// On a line that mentions role: a NAME compared with ==, !=, === or !==; passed to .includes,
// .has, .startsWith, .endsWith, hasRole() or a Drizzle comparison; in an array literal that is
// assigned; compared in SQL (= 'x', <> 'x', in ('x')); or an array or Set literal searched with
// .includes( or .has(.
const LITERAL_CHECK = new RegExp(
  [
    `[!=]==?\\s*${NAME}`,
    `${NAME}\\s*[!=]==?`,
    `\\.(?:includes|has|startsWith|endsWith)\\(\\s*${NAME}`,
    `\\bhasRole\\([^)]*${NAME}`,
    `\\b(?:eq|ne|inArray|notInArray|like|ilike)\\([^)]*${NAME}`,
    `[=:]\\s*\\[\\s*${NAME}`,
    `(?:=|<>|\\bin\\s*\\()\\s*'[^'./]+'`,
    "\\]\\s*\\)?\\s*\\.(?:includes|has)\\(",
  ].join("|"),
  "i",
);
// A SCREAMING_CASE name with a ROLE or ROLES part (HEAD_ROLE_ID, ADMIN_ROLES, ROLE_DEAN, ROLES),
// and an enum named after roles: both hold role names in code.
const ROLE_CONSTANT = /\b(?:[A-Z][A-Z0-9]*_)*ROLES?(?:_[A-Z0-9]+)*\b/;
const ROLE_ENUM = /\benum\s+\w*Role/;
const CASE_LITERAL = /\bcase\s+["'`]/g;
const SWITCH_OR_BRACE = /\bswitch\s*\(([^{}]*?)\)\s*\{|[{}]/g;

// The discriminant of the innermost `switch (…) {` still open at the end of `text`.
function openSwitch(text) {
  const open = [];
  for (const [token, discriminant] of text.matchAll(SWITCH_OR_BRACE)) {
    if (token === "}") open.pop();
    else open.push(discriminant);
  }
  return open.findLast((d) => d !== undefined);
}

function isRoleNameCheck(line, index, lines) {
  if (ROLE_CONSTANT.test(line) || ROLE_ENUM.test(line)) return true;
  if (ROLE.test(line) && LITERAL_CHECK.test(line)) return true;
  // A `case "x":` belongs to the innermost open switch, which may start lines above.
  for (const { index: column } of line.matchAll(CASE_LITERAL)) {
    const before = [...lines.slice(0, index), line.slice(0, column)].join("\n");
    if (ROLE.test(openSwitch(before) ?? "")) return true;
  }
  return false;
}

const RULES = [
  {
    name: "arabic-text",
    message: "Arabic text belongs in messages/*.json or the database",
    pattern: /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/,
  },
  {
    name: "role-name-comparison",
    message: "check a permission key with authorize(), never a role name",
    test: isRoleNameCheck,
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
        const found = rule.test
          ? rule.test(line, index, lines)
          : rule.pattern.test(line);
        if (found) {
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
