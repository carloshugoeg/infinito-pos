// Keeps destructive seeds and the E2E suite away from the production database.
// Imported by prisma/*.ts (relative path, tsx-safe) and by e2e/global.setup.ts.
// MUST stay dependency-free (no app imports) so it is portable across runners.

const PROD_DB_MARKERS = ["supabase.com", "htlcnzlhuqvcovaggzos"] as const;

/** True when the connection string points at the production Supabase database. */
export function isProductionDatabase(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  const value = databaseUrl.toLowerCase();
  return PROD_DB_MARKERS.some((marker) => value.includes(marker));
}

/**
 * Throws if `DATABASE_URL` points at production, unless `ALLOW_PROD_SEED=true`.
 * `context` names the caller (e.g. "db:seed:demo") for a clear error message.
 */
export function assertNonProductionDatabase(context: string): void {
  if (!isProductionDatabase(process.env.DATABASE_URL)) return;
  if (process.env.ALLOW_PROD_SEED === "true") {
    console.warn(`[test-guard] ${context}: production database detected but ALLOW_PROD_SEED=true — proceeding.`);
    return;
  }
  throw new Error(
    `[test-guard] ${context}: refusing to run against the production database. ` +
      `This command writes test/demo data and must never touch the live client DB. ` +
      `If you truly intend this, set ALLOW_PROD_SEED=true.`
  );
}
