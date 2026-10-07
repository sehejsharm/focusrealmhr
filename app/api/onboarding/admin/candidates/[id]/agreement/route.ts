import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { getCandidate, readUpload, saveUpload, updateCandidate } from "@/lib/onboarding/store.server";
import type { StoredFile } from "@/lib/onboarding/types";

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

  const updated = await updateCandidate(id, (c) => ({
    ...c,
    agreement: { kind: "bespoke", document, uploadedAt: new Date().toISOString() },
  }));
  if (!updated) return error("Could not save the agreement.", 500);

  return json({ document: { originalName: document.originalName, bytes: document.bytes } });
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
