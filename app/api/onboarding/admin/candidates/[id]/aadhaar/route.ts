import { clientIp, error, isAdmin } from "@/lib/onboarding/api.server";
import { getCandidate, readUpload, updateCandidate } from "@/lib/onboarding/store.server";

/** Kept bounded — the log is evidence of access, not an audit warehouse. */
const MAX_ACCESS_ENTRIES = 200;

/** Streams the uploaded Aadhaar copy. Never cached, admin session required. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const { id } = await params;
  const candidate = await getCandidate(id);
  const file = candidate?.details?.aadhaarFile;
  if (!file) return error("Not found.", 404);

  const bytes = await readUpload(file.storedAs);
  if (!bytes) return error("That file is missing from the server.", 404);

  /*
   * Every look at an Aadhaar copy is recorded against the candidate, so the
   * Company can show who accessed an identity document and when — and so the
   * candidate can be told, as the notice promises they will be.
   */
  await updateCandidate(id, (c) => ({
    ...c,
    aadhaarAccess: [
      ...(c.aadhaarAccess ?? []),
      { at: new Date().toISOString(), ip: clientIp(request) },
    ].slice(-MAX_ACCESS_ENTRIES),
  }));

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": file.mimeType,
      "content-disposition": `inline; filename="aadhaar-${id}"`,
      "cache-control": "private, no-store",
    },
  });
}
