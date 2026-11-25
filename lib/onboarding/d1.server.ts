/**
 * Cloudflare D1 (SQLite), through Cloudflare's HTTP API. SERVER ONLY — the
 * token can read every record. Used by store.server.ts and nothing else.
 *
 *   R2_ACCOUNT_ID    the Cloudflare account id (the same one R2 uses)
 *   D1_DATABASE_ID   the D1 database's id
 *   D1_API_TOKEN     an API token with only "D1: Edit" on this account
 *
 * With any of them unset, d1() returns null.
 */

export interface D1 {
  /** Runs one statement; returns its rows and how many rows it changed. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; changes: number }>;
}

let cached: D1 | null | undefined;

export function d1(): D1 | null {
  if (cached !== undefined) return cached;
  const account = process.env.R2_ACCOUNT_ID;
  const database = process.env.D1_DATABASE_ID;
  const token = process.env.D1_API_TOKEN;
  if (!account || !database || !token) return (cached = null);

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(database)}/query`;

  cached = {
    async query<T>(sql: string, params: unknown[] = []) {
      let last: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ sql, params }),
          cache: "no-store",
        });
        const body = (await res.json().catch(() => null)) as {
          success?: boolean;
          errors?: { message: string }[];
          result?: { results?: T[]; meta?: { changes?: number } }[];
        } | null;
        if (res.ok && body?.success) {
          const first = body.result?.[0];
          return { rows: first?.results ?? [], changes: first?.meta?.changes ?? 0 };
        }
        last = new Error(`D1 refused the query (${res.status}): ${body?.errors?.map((e) => e.message).join("; ") ?? "no details"}`);
        // Only retry what might be passing: rate limits and server errors.
        if (res.status !== 429 && res.status < 500) break;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
      throw last ?? new Error("D1 could not be reached.");
    },
  };
  return cached;
}

/** The table, the same shape as Supabase's: the record as JSON plus indexed columns. */
export const D1_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS onboarding_candidates (
     id TEXT PRIMARY KEY,
     token TEXT NOT NULL UNIQUE,
     archived_at TEXT,
     created_at TEXT NOT NULL,
     version INTEGER NOT NULL DEFAULT 0,
     record TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS onboarding_candidates_created ON onboarding_candidates (created_at)`,
];
