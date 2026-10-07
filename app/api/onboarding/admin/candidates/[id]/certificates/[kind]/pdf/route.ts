import { error, isAdmin } from "@/lib/onboarding/api.server";
import { getCandidate } from "@/lib/onboarding/store.server";
import { activeCertificate, certificateFilename, isCertificateKind } from "@/lib/onboarding/certificates";
import { renderCertificatePdf } from "@/lib/onboarding/certificate-pdf.server";

/** The founders' copy of an issued document, exactly as the intern receives it. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const { id, kind } = await params;
  if (!isCertificateKind(kind)) return error("Not found.", 404);

  const candidate = await getCandidate(id);
  if (!candidate) return error("Not found.", 404);

  const issued = activeCertificate(candidate, kind);
  if (!issued) return error("This document has not been issued.", 404);

  const pdf = await renderCertificatePdf(issued);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${certificateFilename(kind, issued.text.recipientName)}"`,
      "cache-control": "private, no-store",
    },
  });
}
