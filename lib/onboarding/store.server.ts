import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgreementPlan, Candidate, Company, ExistingMember, Mailbox, TrackDefinition } from "./types";
import { DEFAULT_TERM_MONTHS } from "./types";
import { createId, createToken } from "./security.server";
import { r2 } from "./r2.server";

/**
 * Persistence for the onboarding module. SERVER ONLY.
 *
 * Records live in `public.onboarding_candidates` on Supabase. Uploaded files —
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

export async function listCandidates(): Promise<Candidate[]> {
  const { data, error } = await db()
    .from(TABLE)
    .select("record")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not list candidates: ${error.message}`);
  return (data ?? []).map((row) => row.record as Candidate);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const { data } = await db().from(TABLE).select("record").eq("id", id).maybeSingle();
  return (data?.record as Candidate) ?? null;
}

export async function getCandidateByToken(token: string): Promise<Candidate | null> {
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
 * cannot silently overwrite one another.
 */
export async function updateCandidate(
  id: string,
  mutate: (candidate: Candidate) => Candidate,
): Promise<Candidate | null> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
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
