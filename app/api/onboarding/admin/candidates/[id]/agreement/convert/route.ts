import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { getCandidate, readUpload, updateCandidate } from "@/lib/onboarding/store.server";
import { convertAgreementText, extractAgreementText } from "@/lib/onboarding/agreement-import.server";
import { termClauseBody } from "@/lib/onboarding/contract";
import type { Candidate } from "@/lib/onboarding/types";

export const maxDuration = 60;

/**
 * Converts the agreement a founder uploaded for this intern into the console's
 * own editable agreement, under the platform's rules (agreement-import.server.ts):
 * parties, dates and signatures from the record, Aadhaar masked, the term
 * clause rewritten from the record, gaps flagged. From then on the intern
 * reads and signs it like the standard agreement, and founders can edit it.
 *
 * Refused once the intern has signed: edit the converted text instead, which
 * keeps the signature history straight.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return error("Not authorised.", 401);
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) return error("Not found.", 404);

  const plan = candidate.agreement;
  if (plan?.kind !== "bespoke" || !plan.document) return error("There is no uploaded agreement to convert.", 409);
  if (candidate.signature) return error("They have already signed the uploaded document.", 409);

  const bytes = await readUpload(plan.document.storedAs);
  if (!bytes) return error("The uploaded file could not be read.", 500);

  let converted;
  try {
    converted = convertAgreementText(await extractAgreementText(bytes, plan.document.mimeType));
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Could not read the document.", 422);
  }

  // Rule: the term the intern signs is the term on the record.
  const clauses = converted.clauses.map((c) =>
    /term|duration/i.test(c.heading) ? { ...c, body: termClauseBody(candidate) } : c,
  );
  const warnings = clauses.some((c, i) => c !== converted.clauses[i])
    ? ["The term clause was rewritten from the start date and term on the record.", ...converted.warnings]
    : converted.warnings;

  const now = new Date().toISOString();
  const document = plan.document;
  await updateCandidate(id, (c): Candidate => ({
    ...c,
    agreement: { kind: "standard" },
    contractEdits: {
      recitals: converted.recitals,
      clauses,
      editedAt: now,
      importedFrom: { originalName: document.originalName, storedAs: document.storedAs, importedAt: now, warnings },
    },
  }));

  return json({ ok: true, clauses: clauses.length, recitals: converted.recitals.length, warnings });
}
