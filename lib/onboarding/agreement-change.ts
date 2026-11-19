import type { Candidate } from "./types";

/**
 * What happens to an intern's record whenever their agreement changes — new
 * wording, new dates, or a newly uploaded agreement.
 *
 * Signed: a signature only ever covers the text that was signed, so it (and
 * any countersignature) moves to supersededSignatures with the exact text it
 * covered, and the intern is asked to sign the new version.
 * Not signed yet: the intern is told the founders updated it — usually in
 * answer to changes they suggested — so they read it again before signing.
 */
export function applyAgreementChange(next: Candidate, reason: string): Candidate {
  const now = new Date().toISOString();
  if (!next.signature) {
    return { ...next, contractUpdate: { note: reason, at: now } };
  }
  return {
    ...next,
    supersededSignatures: [
      ...(next.supersededSignatures ?? []),
      {
        signature: next.signature,
        companySignature: next.companySignature,
        contractVerifiedAt: next.contractVerifiedAt,
        supersededAt: now,
        reason,
      },
    ],
    signature: undefined,
    companySignature: undefined,
    contractVerifiedAt: undefined,
    contractUpdate: undefined,
    // Shown to the intern on their agreement step.
    contractRejection: { note: `${reason} Please read the new version and sign it again.`, at: now },
  };
}
