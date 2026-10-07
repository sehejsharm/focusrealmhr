import { error } from "@/lib/onboarding/api.server";
import { getCandidateByToken, readUpload } from "@/lib/onboarding/store.server";
import { currentStage, requiredTestIds } from "@/lib/onboarding/stage";
import { assessmentsPassedPhrase } from "@/lib/onboarding/content";

/**
 * The uploaded agreement, for a candidate whose role does not use the standard
 * template. Behind their own token, and only once the agreement stage is open.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);

  const stage = currentStage(candidate);
  if (stage === "details" || stage === "learning" || stage === "tests") {
    return error(`Your agreement opens once ${assessmentsPassedPhrase(requiredTestIds(candidate).length)}.`, 409);
  }

  const plan = candidate.agreement;
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
