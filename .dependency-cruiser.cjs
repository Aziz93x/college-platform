/** Module boundaries from docs/PLAN.md section 2: app -> modules -> platform. */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "platform-not-to-modules-or-app",
      comment:
        "platform/ is the bottom layer: no modules, routes, interface, styles or request i18n setup " +
        "(i18n/ reads module settings, so it sits above modules).",
      severity: "error",
      from: { path: "^src/platform/" },
      to: { path: "^src/(modules|app|components|i18n|styles)/" },
    },
    {
      name: "modules-not-to-app",
      comment: "modules/ never import routes or the request i18n setup.",
      severity: "error",
      from: { path: "^src/modules/" },
      to: { path: "^src/(app|i18n)/" },
    },
    {
      name: "module-logic-not-to-components",
      comment:
        "A module's domain/ and server/ hold no interface; its ui/ uses the design system.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/(domain|server)/" },
      to: { path: "^src/components/" },
    },
    {
      name: "modules-only-through-index",
      comment: "A module is used by others only through its index.ts.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/([^/]+)/.+",
        pathNot: ["^src/modules/$1/", "^src/modules/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "outside-modules-only-through-index",
      comment:
        "Routes, components, the worker and db/ scripts use a module only through its index.ts.",
      severity: "error",
      from: { pathNot: "^src/modules/" },
      to: {
        path: "^src/modules/[^/]+/.+",
        pathNot: "^src/modules/[^/]+/index\\.ts$",
      },
    },
    {
      name: "domain-has-no-io",
      comment:
        "domain/ is pure: it imports only its own module's domain/ files, the pure libraries listed here " +
        "(add one when a step needs it), the language list and the time zones' clock in platform/i18n, " +
        "the digit conversion and the line tidying in platform/validation, the test runner in its tests, " +
        "and types from a module's index.ts.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/domain/" },
      // pnpm resolves a package to node_modules/.pnpm/<name>@<version>/node_modules/<name>/.
      to: {
        pathNot: [
          "^src/modules/$1/domain/",
          "^src/platform/i18n/language\\.ts$",
          "^src/platform/i18n/time-zone\\.ts$",
          "^src/platform/validation/digits\\.ts$",
          "^src/platform/validation/text\\.ts$",
          "(^|/)node_modules/zod/",
          // The ICU message parser, which checks a college's wording of a text (ADR-0029).
          "(^|/)node_modules/@formatjs/icu-messageformat-parser/",
          "(^|/)node_modules/vitest/",
          "^src/modules/[^/]+/index\\.ts$",
        ],
      },
    },
    {
      name: "domain-imports-only-types-from-modules",
      comment:
        "A module's index.ts also exports server code, so domain/ takes only types from it.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain/" },
      to: {
        path: "^src/modules/[^/]+/index\\.ts$",
        dependencyTypesNot: ["type-only"],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
