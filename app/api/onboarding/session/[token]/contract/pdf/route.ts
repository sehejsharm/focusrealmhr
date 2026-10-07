import { error } from "@/lib/onboarding/api.server";
import { getCandidateByToken } from "@/lib/onboarding/store.server";
import { buildContract } from "@/lib/onboarding/contract";
import { currentStage, requiredTestIds } from "@/lib/onboarding/stage";
import { assessmentsPassedPhrase } from "@/lib/onboarding/content";
import { contractFilename, renderContractPdf } from "@/lib/onboarding/pdf.server";

/** The candidate's own copy, to keep or forward. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  if (candidate.existing) return error("There is no agreement on file here — ask the founders for your copy.", 409);

  const stage = currentStage(candidate);
  if (stage === "details" || stage === "learning" || stage === "tests") {
    return error(`Your agreement is prepared once ${assessmentsPassedPhrase(requiredTestIds(candidate).length)}.`, 409);
  }

  // Bespoke roles sign an uploaded document, not the generated template —
  // serving them this PDF would hand them the wrong agreement.
  if (candidate.agreement?.kind === "bespoke") {
    return error("This role signs its own agreement document, not the standard template.", 409);
  }

  const contract = buildContract(candidate);
  if (!contract) return error("Could not prepare the agreement.", 500);

  const pdf = await renderContractPdf(contract, candidate.signature, candidate.companySignature);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${contractFilename(contract.fields.fullName)}"`,
      "cache-control": "private, no-store",
    },
  });
}
