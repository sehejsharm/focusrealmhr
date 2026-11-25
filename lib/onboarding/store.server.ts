import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgreementPlan, Candidate, Company, ExistingMember, Mailbox, TrackDefinition } from "./types";
import { DEFAULT_TERM_MONTHS } from "./types";
import { createId, createToken } from "./security.server";
import { r2 } from "./r2.server";
import { d1, D1_SCHEMA, type D1 } from "./d1.server";

/**
 * Persistence for the onboarding module. SERVER ONLY.
 *
 * Records live in `onboarding_candidates` on Cloudflare D1 when RECORDS_STORE=d1
 * (d1.server.ts), otherwise in `public.onboarding_candidates` on Supabase. Uploaded files —
 * Aadhaar copies and bespoke agreements — live in a private Cloudflare R2
 * bucket (r2.server.ts) once it is configured; until then, and for files from
 * before the move, in the private Supabase `onboarding-aadhaar` bucket. The
 * Supabase table and bucket have RLS enabled with no policies, so the
 * service-role key used here is the only thing that can reach them. Neither
 * that key nor the R2 keys may ever reach the browser.
 *
 * Nothing outside this file touches storage.
 */

const TABLE = "onboarding_candidates";
const BUCKET = "onboarding-aadhaar";

/** How many times a conflicting update is retried against fresh state. */
const MAX_WRITE_ATTEMPTS = 5;

interface Row {
  record: Candidate;
  version: number;
}

let cached: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. The onboarding module stores Aadhaar data and refuses to run without them.",
    );
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

/** Columns kept alongside the document, so lookups can use an index. */
function columns(record: Candidate) {
  return {
    id: record.id,
    token: record.token,
    archived_at: record.archivedAt ?? null,
    record,
  };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Where records live                                                         */
/* -------------------------------------------------------------------------- */

/**
 * RECORDS_STORE=d1 moves every record read and write to Cloudflare D1. Unset,
 * records stay on Supabase. Set it ONLY after "Copy records to Cloudflare"
 * reports every record copied and matching. With it set but D1 not configured,
 * the console refuses to run rather than quietly writing to Supabase.
 */
function onD1(): D1 | null {
  if (process.env.RECORDS_STORE !== "d1") return null;
  const store = d1();
  if (!store) {
    throw new Error("RECORDS_STORE is d1, but R2_ACCOUNT_ID, D1_DATABASE_ID and D1_API_TOKEN are not all set.");
  }
  return store;
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function parse(row: { record: string } | undefined): Candidate | null {
  return row ? (JSON.parse(row.record) as Candidate) : null;
}

/**
 * The smallest possible database read. The nightly job calls it so a free
 * Supabase project never counts as idle (it is paused after ~7 quiet days).
 * Nothing to do once records are on D1, which is never paused.
 */
export async function keepDatabaseAwake(): Promise<void> {
  if (onD1() || !supabaseConfigured()) return;
  const { error } = await db().from(TABLE).select("id").limit(1);
  if (error) throw new Error(`Supabase keep-alive failed: ${error.message}`);
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function listCandidates(): Promise<Candidate[]> {
  const cf = onD1();
  if (cf) {
    const { rows } = await cf.query<{ record: string }>(`SELECT record FROM ${TABLE} ORDER BY created_at DESC`);
    return rows.map((row) => JSON.parse(row.record) as Candidate);
  }

  const { data, error } = await db()
    .from(TABLE)
    .select("record")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not list candidates: ${error.message}`);
  return (data ?? []).map((row) => row.record as Candidate);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const cf = onD1();
  if (cf) {
    const { rows } = await cf.query<{ record: string }>(`SELECT record FROM ${TABLE} WHERE id = ?`, [id]);
    return parse(rows[0]);
  }

  const { data } = await db().from(TABLE).select("record").eq("id", id).maybeSingle();
  return (data?.record as Candidate) ?? null;
}

export async function getCandidateByToken(token: string): Promise<Candidate | null> {
  const cf = onD1();
  if (cf) {
    const { rows } = await cf.query<{ record: string }>(
      `SELECT record FROM ${TABLE} WHERE token = ? AND archived_at IS NULL`,
      [token],
    );
    return parse(rows[0]);
  }

  const { data } = await db()
    .from(TABLE)
    .select("record")
    .eq("token", token)
    .is("archived_at", null)
    .maybeSingle();

  // Existing employees use theirs as the link to the employee portal.
  return (data?.record as Candidate) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createCandidate(input: {
  invitedName: string;
  invitedEmail: string;
  track: Candidate["track"];
  /** Only for roles outside the built-in tracks. */
  customTrack?: TrackDefinition;
  startDate: string;
  termMonths?: number;
  agreement?: AgreementPlan;
  companies: Company[];
  /** Present when adding someone onboarded before the console existed. */
  existing?: ExistingMember;
  /** Their company address, if they already have one. */
  mailbox?: Mailbox;
}): Promise<Candidate> {
  const candidate: Candidate = {
    id: createId(),
    token: createToken(),
    track: input.track,
    ...(input.customTrack ? { customTrack: input.customTrack } : {}),
    invitedName: input.invitedName,
    invitedEmail: input.invitedEmail,
    startDate: input.startDate,
    termMonths: input.termMonths ?? DEFAULT_TERM_MONTHS,
    agreement: input.agreement ?? { kind: "standard" },
    companies: input.companies,
    ...(input.existing ? { existing: input.existing } : {}),
    ...(input.mailbox ? { mailbox: input.mailbox } : {}),
    createdAt: new Date().toISOString(),
    resources: {},
    tests: {},
  };

  const cf = onD1();
  if (cf) {
    await cf
      .query(
        `INSERT INTO ${TABLE} (id, token, archived_at, created_at, version, record) VALUES (?, ?, ?, ?, 0, ?)`,
        [candidate.id, candidate.token, null, candidate.createdAt, JSON.stringify(candidate)],
      )
      .catch((cause: Error) => {
        throw new Error(`Could not create candidate: ${cause.message}`);
      });
    return candidate;
  }

  const { error } = await db().from(TABLE).insert(columns(candidate));
  if (error) throw new Error(`Could not create candidate: ${error.message}`);

  return candidate;
}

/**
 * Applies `mutate` to one candidate and persists the result.
 *
 * The mutation always runs against freshly-read state, and the write only
 * lands if the row has not moved since that read — otherwise it retries. So
 * two requests arriving together (a candidate ticking resources quickly, say)
 * cannot silently overwrite one another. The same holds on D1 and Supabase.
 */
export async function updateCandidate(
  id: string,
  mutate: (candidate: Candidate) => Candidate,
): Promise<Candidate | null> {
  const cf = onD1();
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    if (cf) {
      const { rows } = await cf.query<{ record: string; version: number }>(
        `SELECT record, version FROM ${TABLE} WHERE id = ?`,
        [id],
      );
      const row = rows[0];
      if (!row) return null;

      const next = mutate(JSON.parse(row.record) as Candidate);
      const { changes } = await cf
        .query(
          `UPDATE ${TABLE} SET token = ?, archived_at = ?, record = ?, version = ? WHERE id = ? AND version = ?`,
          [next.token, next.archivedAt ?? null, JSON.stringify(next), row.version + 1, id, row.version],
        )
        .catch((cause: Error) => {
          throw new Error(`Could not update candidate: ${cause.message}`);
        });
      if (changes === 1) return next;
      continue; // Someone else wrote first — re-read and reapply.
    }

    const { data } = await db()
      .from(TABLE)
      .select("record, version")
      .eq("id", id)
      .maybeSingle<Row>();

    if (!data) return null;

    const next = mutate(data.record);
    const { data: written, error } = await db()
      .from(TABLE)
      .update({ ...columns(next), version: data.version + 1 })
      .eq("id", id)
      .eq("version", data.version)
      .select("record")
      .maybeSingle();

    if (error) throw new Error(`Could not update candidate: ${error.message}`);
    if (written) return written.record as Candidate;
    // Zero rows means someone else wrote first — re-read and reapply.
  }

  throw new Error("Could not update candidate: too many concurrent writes.");
}

/* -------------------------------------------------------------------------- */
/* Moving records to Cloudflare D1                                            */
/* -------------------------------------------------------------------------- */

export interface RecordCopyReport {
  /** Records on Supabase. */
  total: number;
  /** Newly written, or brought up to date, on D1 this run. */
  copied: number;
  /** Already on D1 and identical. */
  alreadyThere: number;
  /** On D1 but not on Supabase (created after a switch, or a stray). */
  onlyOnD1: number;
  /** Every Supabase record is on D1, with identical contents and version. */
  verified: boolean;
  mismatched: { id: string; name: string; problem: string }[];
  /** Whether the console is reading from D1 right now. */
  usingD1: boolean;
}

/**
 * Copies every record from Supabase to D1 (creating the table first), then
 * reads each one back from D1 and compares it with Supabase field by field.
 * Deletes nothing anywhere. Safe to run any number of times: a D1 record is
 * only overwritten by a Supabase one with a higher version, so it can be run
 * again right before switching to pick up last-minute changes.
 */
export async function copyRecordsToD1(): Promise<RecordCopyReport> {
  const cf = d1();
  if (!cf) throw new Error("D1 is not configured: set R2_ACCOUNT_ID, D1_DATABASE_ID and D1_API_TOKEN.");
  if (!supabaseConfigured()) throw new Error("Supabase is not configured, so there is nothing to copy from.");

  for (const statement of D1_SCHEMA) await cf.query(statement);

  const { data, error } = await db()
    .from(TABLE)
    .select("id, token, archived_at, created_at, version, record")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not read the records on Supabase: ${error.message}`);
  const source = (data ?? []) as {
    id: string;
    token: string;
    archived_at: string | null;
    created_at: string;
    version: number;
    record: Candidate;
  }[];

  const { rows: before } = await cf.query<{ id: string; version: number; record: string }>(
    `SELECT id, version, record FROM ${TABLE}`,
  );
  const existing = new Map(before.map((r) => [r.id, r]));

  let copied = 0;
  let alreadyThere = 0;
  for (const row of source) {
    const json = JSON.stringify(row.record);
    const there = existing.get(row.id);
    if (there && there.version === row.version && sameJson(there.record, json)) {
      alreadyThere++;
      continue;
    }
    const { changes } = await cf.query(
      `INSERT INTO ${TABLE} (id, token, archived_at, created_at, version, record) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET token = excluded.token, archived_at = excluded.archived_at,
         created_at = excluded.created_at, version = excluded.version, record = excluded.record
       WHERE excluded.version > ${TABLE}.version`,
      [row.id, row.token, row.archived_at, new Date(row.created_at).toISOString(), row.version, json],
    );
    if (changes > 0) copied++;
  }

  // Verify: read everything back from D1 and compare with Supabase.
  const { rows: after } = await cf.query<{ id: string; token: string; archived_at: string | null; version: number; record: string }>(
    `SELECT id, token, archived_at, version, record FROM ${TABLE}`,
  );
  const copiedRows = new Map(after.map((r) => [r.id, r]));
  const mismatched: RecordCopyReport["mismatched"] = [];
  for (const row of source) {
    const name = row.record.details?.fullName ?? row.record.invitedName;
    const there = copiedRows.get(row.id);
    if (!there) mismatched.push({ id: row.id, name, problem: "missing on D1" });
    else if (there.version > row.version) mismatched.push({ id: row.id, name, problem: "newer on D1 than on Supabase (changed after a switch?)" });
    else if (there.version !== row.version || there.token !== row.token || (there.archived_at ?? null) !== (row.archived_at ?? null) || !sameJson(there.record, JSON.stringify(row.record))) {
      mismatched.push({ id: row.id, name, problem: "contents differ" });
    }
  }
  const sourceIds = new Set(source.map((r) => r.id));

  return {
    total: source.length,
    copied,
    alreadyThere,
    onlyOnD1: after.filter((r) => !sourceIds.has(r.id)).length,
    verified: mismatched.length === 0,
    mismatched,
    usingD1: process.env.RECORDS_STORE === "d1",
  };
}

/** Same JSON regardless of key order (Postgres jsonb reorders keys). */
function sameJson(a: string, b: string): boolean {
  return canonical(JSON.parse(a)) === canonical(JSON.parse(b));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/* -------------------------------------------------------------------------- */
/* Uploaded files: Aadhaar copies and agreements                              */
/* -------------------------------------------------------------------------- */

/**
 * Stores an upload under a fresh random name: in R2 when it is configured,
 * otherwise in the Supabase bucket. The name is the same kind either way, so a
 * record never needs to know where its file lives.
 */
export async function saveUpload(
  file: File,
): Promise<{ storedAs: string; bytes: number }> {
  const storedAs = randomBytes(16).toString("hex");
  const bytes = Buffer.from(await file.arrayBuffer());

  const bucket = r2();
  if (bucket) {
    await bucket.put(storedAs, bytes, file.type).catch((cause: Error) => {
      throw new Error(`Could not store the upload: ${cause.message}`);
    });
    return { storedAs, bytes: bytes.byteLength };
  }

  if (!supabaseConfigured()) throw new Error("Could not store the upload: neither R2 nor Supabase is configured.");
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(storedAs, bytes, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Could not store the upload: ${error.message}`);

  return { storedAs, bytes: bytes.byteLength };
}

export async function readUpload(storedAs: string): Promise<Buffer | null> {
  // Stored names are always plain hex — anything else is not ours.
  if (!/^[a-f0-9]{32}$/.test(storedAs)) return null;

  // R2 first. A file it does not have predates the move (or was stored before
  // R2 was configured) and is still in the Supabase bucket.
  const bucket = r2();
  if (bucket) {
    const found = await bucket.get(storedAs);
    if (found) return found;
  }

  if (!supabaseConfigured()) return null;
  const { data, error } = await db().storage.from(BUCKET).download(storedAs);
  if (error || !data) return null;

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Copies files from the Supabase bucket to R2 under the same name, a batch at
 * a time so each call fits in one serverless request. Skips anything already
 * in R2 at the same size, checks every copy's size, and deletes nothing.
 * `remaining` counts files still to look at after this batch.
 */
export async function copyUploadsToR2(
  batch = 20,
): Promise<{ total: number; copied: number; alreadyThere: number; remaining: number; failed: { name: string; error: string }[] }> {
  const bucket = r2();
  if (!bucket) throw new Error("R2 is not configured.");

  const files: { name: string; size: number | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db().storage.from(BUCKET).list("", { limit: 1000, offset });
    if (error) throw new Error(`Could not list the Supabase bucket: ${error.message}`);
    for (const o of data) {
      if (!/^[a-f0-9]{32}$/.test(o.name)) continue;
      const size = Number((o.metadata as { size?: number } | null)?.size);
      files.push({ name: o.name, size: Number.isFinite(size) ? size : null });
    }
    if (data.length < 1000) break;
  }

  let copied = 0;
  let alreadyThere = 0;
  let worked = 0;
  const failed: { name: string; error: string }[] = [];

  for (const { name, size } of files) {
    try {
      // Already copied: compare sizes without downloading again.
      if (size !== null && (await bucket.size(name)) === size) {
        alreadyThere++;
        continue;
      }
      if (worked >= batch) continue;

      const { data, error } = await db().storage.from(BUCKET).download(name);
      if (error || !data) throw new Error(error?.message ?? "download failed");
      const bytes = Buffer.from(await data.arrayBuffer());

      const existing = await bucket.size(name);
      if (existing === bytes.byteLength) {
        alreadyThere++;
        continue;
      }
      worked++;
      if (existing !== null) throw new Error(`already in R2 with a different size (${existing} vs ${bytes.byteLength})`);
      await bucket.put(name, bytes, data.type);
      if ((await bucket.size(name)) !== bytes.byteLength) throw new Error("size in R2 does not match after copying");
      copied++;
    } catch (cause) {
      failed.push({ name, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  const remaining = Math.max(0, files.length - alreadyThere - copied - failed.length);
  return { total: files.length, copied, alreadyThere, remaining, failed };
}

/**
 * Frees space on Supabase: deletes each file from the Supabase bucket ONLY when
 * R2 already holds a copy of exactly the same size. Anything not yet in R2, or
 * in R2 at a different size, is kept. A batch per call; `remaining` counts
 * files still on Supabase afterwards.
 */
export async function deleteSupabaseCopies(
  batch = 100,
): Promise<{ deleted: number; keptNotInR2: number; remaining: number; failed: { name: string; error: string }[] }> {
  const bucket = r2();
  if (!bucket) throw new Error("R2 is not configured.");

  const { data, error } = await db().storage.from(BUCKET).list("", { limit: 1000 });
  if (error) throw new Error(`Could not list the Supabase bucket: ${error.message}`);
  const files = data.filter((o) => /^[a-f0-9]{32}$/.test(o.name));

  const safe: string[] = [];
  let keptNotInR2 = 0;
  const failed: { name: string; error: string }[] = [];

  for (const o of files) {
    if (safe.length >= batch) break;
    const size = Number((o.metadata as { size?: number } | null)?.size);
    try {
      const inR2 = await bucket.size(o.name);
      if (Number.isFinite(size) && inR2 === size) safe.push(o.name);
      else keptNotInR2++;
    } catch (cause) {
      failed.push({ name: o.name, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  let deleted = 0;
  if (safe.length > 0) {
    const { error: removeError } = await db().storage.from(BUCKET).remove(safe);
    if (removeError) throw new Error(`Could not delete from Supabase: ${removeError.message}`);
    deleted = safe.length;
  }
  return { deleted, keptNotInR2, remaining: files.length - deleted, failed };
}
