import { error } from "@/lib/onboarding/api.server";
import {
  activeCertificate,
  certificateFilename,
  isCertificateKind,
  isDeclined,
} from "@/lib/onboarding/certificates";
import { renderCertificatePdf } from "@/lib/onboarding/certificate-pdf.server";
import { resolveOffboarding } from "@/lib/onboarding/offboarding.server";

/**
 * The intern's certificate or letter, handed over at the end of offboarding:
 * only after the exit questions are answered, only if a founder approved it,
 * and never one a founder decided not to issue.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string; kind: string }> },
) {
  const { code, kind } = await params;
  if (!isCertificateKind(kind)) return error("Not found.", 404);

  const candidate = await resolveOffboarding(code);
  if (!candidate) return error("This offboarding link is not valid.", 404);
  if (!candidate.offboarding) return error("Answer the offboarding questions first.", 409);
  if (isDeclined(candidate, kind)) return error("Not found.", 404);

  const issued = activeCertificate(candidate, kind);
  if (!issued) return error("This document is still being prepared.", 404);

  const pdf = await renderCertificatePdf(issued);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${certificateFilename(kind, issued.text.recipientName)}"`,
      "cache-control": "private, no-store",
    },
  });
}
