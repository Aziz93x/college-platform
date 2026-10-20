// Shared by the global setup and the test files; it must not import vitest, which globalSetup cannot load.
export const TEMPLATE_DATABASE = "template_app";

export function databaseUrl(adminUrl: string, database: string) {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  return url.toString();
}
