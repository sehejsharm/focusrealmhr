import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgreementPlan, Candidate, Company, ExistingMember, Mailbox, TrackDefinition } from "./types";
import { DEFAULT_TERM_MONTHS } from "./types";
import { createId, createToken } from "./security.server";

/**
 * Persistence for the onboarding module. SERVER ONLY.
 *
 * Records live in `public.onboarding_candidates`, Aadhaar copies in the private
 * `onboarding-aadhaar` bucket. Both have RLS enabled with no policies, so the
 * service-role key used here is the only thing that can reach them — never
 * expose it to the browser.
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
/* Aadhaar copies                                                             */
/* -------------------------------------------------------------------------- */

export async function saveUpload(
  file: File,
): Promise<{ storedAs: string; bytes: number }> {
  const storedAs = randomBytes(16).toString("hex");
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await db()
    .storage.from(BUCKET)
    .upload(storedAs, bytes, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Could not store the upload: ${error.message}`);

  return { storedAs, bytes: bytes.byteLength };
}

export async function readUpload(storedAs: string): Promise<Buffer | null> {
  // Stored names are always plain hex — anything else is not ours.
  if (!/^[a-f0-9]{32}$/.test(storedAs)) return null;

  const { data, error } = await db().storage.from(BUCKET).download(storedAs);
  if (error || !data) return null;

  return Buffer.from(await data.arrayBuffer());
}
