import { error, isAdmin } from "@/lib/onboarding/api.server";
import { getCandidate } from "@/lib/onboarding/store.server";
import { buildContract } from "@/lib/onboarding/contract";
import { contractFilename, renderContractPdf } from "@/lib/onboarding/pdf.server";

/** The company's copy, for filing or emailing to the intern. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) return error("Not found.", 404);

  // Bespoke roles sign an uploaded document, not the generated template —
  // serving them this PDF would hand them the wrong agreement.
  if (candidate.agreement?.kind === "bespoke") {
    return error("This role signs its own agreement document, not the standard template.", 409);
  }

  const contract = buildContract(candidate);
  if (!contract) return error("This candidate has not submitted their details yet.", 409);

  const pdf = await renderContractPdf(contract, candidate.signature, candidate.companySignature);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${contractFilename(contract.fields.fullName)}"`,
      "cache-control": "private, no-store",
    },
  });
}
