import { companiesOf, currentStage, endDateOf } from "./stage";
import type { Candidate, CandidateView } from "./types";
import { DEFAULT_TERM_MONTHS, trackOf } from "./types";

/** Strips Aadhaar number and sealed credentials for the candidate's own view. */
export function toCandidateView(candidate: Candidate): CandidateView {
  const { details } = candidate;
  const termMonths = candidate.termMonths || DEFAULT_TERM_MONTHS;

  return {
    track: candidate.track,
    role: trackOf(candidate),
    termMonths,
    endDate: endDateOf(candidate),
    agreementKind: candidate.agreement?.kind ?? "standard",
    companies: companiesOf(candidate),
    agreementDocumentName:
      candidate.agreement?.kind === "bespoke"
        ? (candidate.agreement.document?.originalName ?? null)
        : null,
    invitedName: candidate.invitedName,
    startDate: candidate.startDate,
    stage: currentStage(candidate),
    details: details
      ? {
          fullName: details.fullName,
          parentName: details.parentName,
          address: details.address,
          personalEmail: details.personalEmail,
          phone: details.phone,
          aadhaarFile: details.aadhaarFile,
          submittedAt: details.submittedAt,
          consent: details.consent,
          aadhaarLast4: details.aadhaarNumber.slice(-4),
        }
      : null,
    consent: candidate.details?.consent ?? null,
    resources: candidate.resources,
    tests: candidate.tests,
    signedAt: candidate.signature?.signedAt ?? null,
    companySignature: candidate.companySignature ?? null,
    contractVerifiedAt: candidate.contractVerifiedAt ?? null,
    contractRejection: candidate.contractRejection ?? null,
    emailRequestedAt: candidate.emailRequestedAt ?? null,
    mailbox: candidate.mailbox
      ? {
          address: candidate.mailbox.address,
          // No sealed password means there is nothing left to collect — either
          // it was viewed, or the mailbox predates this console.
          viewed: Boolean(candidate.mailbox.viewedAt) || !candidate.mailbox.sealedPassword,
        }
      : null,
    existing: Boolean(candidate.existing),
  };
}
