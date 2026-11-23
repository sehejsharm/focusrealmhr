import { error } from "@/lib/onboarding/api.server";
import { getCandidateByToken } from "@/lib/onboarding/store.server";
import { activeCertificate, certificateFilename } from "@/lib/onboarding/certificates";
import { renderCertificatePdf } from "@/lib/onboarding/certificate-pdf.server";

/**
 * The intern's own copy of their offer letter, from their onboarding link —
 * only once a founder has approved one on request. End-of-internship
 * documents are handed over at offboarding instead.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; kind: string }> },
) {
  const { token, kind } = await params;
  if (kind !== "offer-letter") return error("Not found.", 404);

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);

  const issued = activeCertificate(candidate, "offer-letter");
  if (!issued) return error("Your offer letter has not been issued.", 404);

  const pdf = await renderCertificatePdf(issued);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${certificateFilename("offer-letter", issued.text.recipientName)}"`,
      "cache-control": "private, no-store",
    },
  });
}
