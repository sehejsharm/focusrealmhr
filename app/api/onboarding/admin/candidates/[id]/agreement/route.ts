import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { getCandidate, readUpload, saveUpload, updateCandidate } from "@/lib/onboarding/store.server";
import { convertAgreementText, extractAgreementText } from "@/lib/onboarding/agreement-import.server";
import { termClauseBody } from "@/lib/onboarding/contract";
import type { Candidate, StoredFile } from "@/lib/onboarding/types";

export const maxDuration = 60;

/**
 * The agreement document for a role the standard template does not cover.
 *
 * Only the Founder's Office agreement ships with the repository. Where a
 * candidate's role needs a document of its own, the founders upload it here
 * and the candidate cannot reach a signature until they have.
 */

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) return error("Not found.", 404);
  if (candidate.removal) {
    return error("This person has been removed. Restore them before making changes.", 409);
  }
  if (candidate.signature) {
    return error("This candidate has already signed — the agreement cannot be replaced.", 409);
  }

  const form = await request.formData();
  const file = form.get("document");

  if (!(file instanceof File) || file.size === 0) {
    return error("Attach the agreement document.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return error("That file is larger than 12 MB.");
  }
  if (!ACCEPTED.includes(file.type)) {
    return error("Attach a PDF or a Word document.");
  }

  const { storedAs, bytes } = await saveUpload(file);
  const document: StoredFile = {
    originalName: file.name,
    mimeType: file.type,
    bytes,
    storedAs,
  };

  /*
   * Every upload is converted straight into the console's own agreement, so it
   * keeps the standard's fixed parts — the parties ("FocusRealm (to be
   * incorporated)", represented by its authorised signatory), the effective
   * date, the term from the record and the signature blocks — and only its
   * recitals and clauses come from the file. The intern then reads and signs it
   * like the standard agreement, and founders can keep editing it. Only if the
   * file cannot be read does the raw upload stand in, with a warning.
   */
  const now = new Date().toISOString();
  try {
    const converted = convertAgreementText(await extractAgreementText(Buffer.from(await file.arrayBuffer()), file.type));
    const clauses = converted.clauses.map((c) =>
      /term|duration/i.test(c.heading) ? { ...c, body: termClauseBody(candidate) } : c,
    );
    const warnings = clauses.some((c, i) => c !== converted.clauses[i])
      ? ["The term clause was rewritten from the start date and term on the record.", ...converted.warnings]
      : converted.warnings;
    const updated = await updateCandidate(id, (c): Candidate => ({
      ...c,
      agreement: { kind: "standard" },
      contractEdits: {
        recitals: converted.recitals,
        clauses,
        editedAt: now,
        importedFrom: { originalName: document.originalName, storedAs, importedAt: now, warnings },
      },
    }));
    if (!updated) return error("Could not save the agreement.", 500);
    return json({ document: { originalName: document.originalName, bytes: document.bytes }, converted: true, warnings });
  } catch (cause) {
    const updated = await updateCandidate(id, (c) => ({
      ...c,
      agreement: { kind: "bespoke", document, uploadedAt: now },
    }));
    if (!updated) return error("Could not save the agreement.", 500);
    return json({
      document: { originalName: document.originalName, bytes: document.bytes },
      converted: false,
      warnings: [
        `It could not be put into the standard format (${cause instanceof Error ? cause.message : "unreadable file"}), so the intern will see the file exactly as uploaded. Upload a Word copy to have it converted.`,
      ],
    });
  }
}

/** Streams the uploaded document back to the console. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const { id } = await params;
  const candidate = await getCandidate(id);
  const plan = candidate?.agreement;
  const document = plan?.kind === "bespoke" ? plan.document : undefined;
  if (!document) return error("Not found.", 404);

  const bytes = await readUpload(document.storedAs);
  if (!bytes) return error("That file is missing from the server.", 404);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": document.mimeType,
      "content-disposition": `inline; filename="${document.originalName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
