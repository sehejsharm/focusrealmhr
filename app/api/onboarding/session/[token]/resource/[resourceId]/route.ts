import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { error, json } from "@/lib/onboarding/api.server";
import { getCandidateByToken, updateCandidate } from "@/lib/onboarding/store.server";
import { requiredResources } from "@/lib/onboarding/stage";
import { toCandidateView } from "@/lib/onboarding/view";

/**
 * Handbooks are internal documents, so they stream through this token-gated
 * route rather than sitting in public/.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; resourceId: string }> },
) {
  const { token, resourceId } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  // Added directly as an existing employee: there is no onboarding to do.
  if (candidate.existing) return error("There are no onboarding steps on this record.", 409);

  // Another company's handbook is confidential to that company's interns —
  // it does not exist as far as this candidate is concerned.
  const resource = requiredResources(candidate).find((r) => r.id === resourceId);
  if (!resource?.file) return error("Not found.", 404);

  try {
    const bytes = await readFile(join(process.cwd(), "content", "onboarding", resource.file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${resource.id}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return error("That document is missing from the server.", 500);
  }
}

/** Marks a handbook read or a video watched. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string; resourceId: string }> },
) {
  const { token, resourceId } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  // Added directly as an existing employee: there is no onboarding to do.
  if (candidate.existing) return error("There are no onboarding steps on this record.", 409);
  if (!requiredResources(candidate).some((r) => r.id === resourceId)) {
    return error("Not found.", 404);
  }

  const updated = await updateCandidate(candidate.id, (c) => ({
    ...c,
    resources: { ...c.resources, [resourceId]: new Date().toISOString() },
  }));
  if (!updated) return error("Could not save your progress.", 500);

  return json(toCandidateView(updated));
}
