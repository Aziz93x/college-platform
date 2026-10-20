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
      comment: "platform/ is the bottom layer.",
      severity: "error",
      from: { path: "^src/platform/" },
      to: { path: "^src/(modules|app)/" },
    },
    {
      name: "modules-not-to-app",
      comment: "modules/ never import routes.",
      severity: "error",
      from: { path: "^src/modules/" },
      to: { path: "^src/app/" },
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
      comment: "domain/ is pure: no platform and no server or UI code.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain/" },
      to: { path: ["^src/platform/", "^src/modules/[^/]+/(server|ui)/"] },
    },
    {
      name: "domain-has-no-node-builtins",
      comment: "domain/ is pure: no Node built-ins such as fs or net.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain/" },
      to: { dependencyTypes: ["core"] },
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
