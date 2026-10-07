import { companyLabel } from "./content";
import { formatLongDate } from "./contract";
import { companiesOf, endDateOf, hasPassed, requiredTestIds } from "./stage";
import type {
  Candidate,
  CertificateKind,
  CertificateText,
  CertificateWindow,
  IssuedCertificate,
} from "./types";
import { DEFAULT_TERM_MONTHS, trackOf } from "./types";

/**
 * End-of-internship documents: a certificate of completion and a letter of
 * recommendation.
 *
 * Both are drafted automatically from the record once the intern is in the
 * last days of their term, but neither exists until a founder approves it —
 * each document, for each intern, on its own — and a founder can decide not
 * to issue one at all. Approval freezes the exact text (see
 * `CertificateText`), which is what the PDF is always rendered from. The
 * intern collects them at the end of offboarding (see offboarding.ts).
 *
 * Safe to import from the browser: the console renders its live preview with
 * the same `draftCertificate` the server freezes on approval.
 */

/** Documents can be prepared from this many days before the term ends. */
export const CERTIFICATE_WINDOW_DAYS = 10;

export const CERTIFICATE_KINDS: CertificateKind[] = ["completion", "recommendation"];

export const CERTIFICATE_LABEL: Record<CertificateKind, string> = {
  completion: "Internship completion certificate",
  recommendation: "Letter of recommendation",
};

const TITLE: Record<CertificateKind, string> = {
  completion: "Certificate of Internship Completion",
  recommendation: "Letter of Recommendation",
};

export function isCertificateKind(value: unknown): value is CertificateKind {
  return value === "completion" || value === "recommendation";
}

/** The day the documents can first be prepared: the start of the last ten days. */
export function certificateWindowOpens(candidate: Candidate): Date {
  const opens = new Date(endDateOf(candidate));
  opens.setUTCDate(opens.getUTCDate() - CERTIFICATE_WINDOW_DAYS);
  return opens;
}

/**
 * Whether this intern's documents can be prepared yet. Someone who left early
 * has no completion to certify, and an internship whose agreement was never
 * executed never formally began.
 */
export function certificateWindow(candidate: Candidate, now = new Date()): CertificateWindow {
  if (candidate.removal) {
    return {
      status: "not-eligible",
      reason: "They left before the end of their term, so there is no completion to certify.",
    };
  }
  if (!candidate.existing && !candidate.contractVerifiedAt) {
    return {
      status: "not-eligible",
      reason: "The internship agreement has not been executed yet.",
    };
  }

  const opens = certificateWindowOpens(candidate);
  return now.getTime() >= opens.getTime()
    ? { status: "open", opensOn: opens.toISOString() }
    : { status: "not-yet", opensOn: opens.toISOString() };
}

/** The current document of this kind — the latest one not withdrawn. */
export function activeCertificate(
  candidate: Pick<Candidate, "certificates">,
  kind: CertificateKind,
): IssuedCertificate | null {
  const issued = candidate.certificates ?? [];
  for (let i = issued.length - 1; i >= 0; i--) {
    if (issued[i].kind === kind && !issued[i].withdrawn) return issued[i];
  }
  return null;
}

/** Whether a founder has decided this intern will not receive this document. */
export function isDeclined(candidate: Pick<Candidate, "declinedCertificates">, kind: CertificateKind): boolean {
  return (candidate.declinedCertificates ?? []).includes(kind);
}

/** The documents this intern is to receive — both, unless a founder said otherwise. */
export function plannedCertificates(candidate: Pick<Candidate, "declinedCertificates">): CertificateKind[] {
  return CERTIFICATE_KINDS.filter((kind) => !isDeclined(candidate, kind));
}

/** Documents a founder still has to approve, now that the window is open. */
export function certificatesAwaitingApproval(candidate: Candidate, now = new Date()): CertificateKind[] {
  if (certificateWindow(candidate, now).status !== "open") return [];
  return plannedCertificates(candidate).filter((kind) => !activeCertificate(candidate, kind));
}

export function recipientName(candidate: Candidate): string {
  return candidate.details?.fullName ?? candidate.invitedName;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/** "and Recharga Chargine" phrasing for interns who worked on more than Focus Realm. */
function workedAcross(candidate: Candidate): string {
  const companies = companiesOf(candidate);
  if (!companies.includes("recharga")) return "";
  return companies.includes("focus-realm")
    ? `, across ${companies.map(companyLabel).join(" and ")}`
    : `, on ${companyLabel("recharga")}`;
}

export interface DraftOptions {
  signatory: { name: string; designation: string; contactEmail?: string };
  /** Optional words from the founder, printed as their own paragraph of the letter. */
  highlights?: string;
  issuedOn: string;
  serial: string;
}

/** The full text of one document, generated from the record. */
export function draftCertificate(
  candidate: Candidate,
  kind: CertificateKind,
  options: DraftOptions,
): CertificateText {
  const role = trackOf(candidate);
  const name = recipientName(candidate);
  const first = firstName(name);
  const termMonths = candidate.termMonths || DEFAULT_TERM_MONTHS;
  const start = formatLongDate(new Date(candidate.startDate));
  const end = formatLongDate(new Date(endDateOf(candidate)));
  const across = workedAcross(candidate);
  const organisations = companiesOf(candidate).map(companyLabel).join(" and ");

  const base = {
    kind,
    title: TITLE[kind],
    recipientName: name,
    roleTitle: role.roleTitle,
    organisations,
    startDate: candidate.startDate,
    endDate: endDateOf(candidate),
    signatory: options.signatory,
    issuedOn: options.issuedOn,
    serial: options.serial,
  };

  if (kind === "completion") {
    return {
      ...base,
      paragraphs: [
        `has successfully completed a ${termMonths}-month internship with Focus Realm as ${role.roleTitle}, from ${start} to ${end}.`,
        `During the internship, ${first} worked on ${role.duties}${across}.`,
        `We are grateful for ${first}'s contribution and wish ${first} every success in the future.`,
      ],
    };
  }

  // Only claimed where the record shows it: someone added directly as an
  // existing employee never went through the console's programme.
  const passedProgramme =
    !candidate.existing && requiredTestIds(candidate).every((id) => hasPassed(candidate, id));

  const highlights = options.highlights?.trim();
  const contact = options.signatory.contactEmail?.trim();

  return {
    ...base,
    salutation: "To whom it may concern,",
    paragraphs: [
      `I am pleased to recommend ${name}, who completed a ${termMonths}-month internship with Focus Realm as ${role.roleTitle}, from ${start} to ${end}.`,
      `In this role, ${first} worked on ${role.duties}${across}.${
        passedProgramme
          ? ` Before starting, ${first} completed our structured onboarding programme and passed each of its assessments.`
          : ""
      }`,
      ...(highlights ? [highlights] : []),
      `Throughout the internship, ${first} brought professionalism and a real willingness to learn to the work. I am happy to recommend ${first} for future academic and professional opportunities.`,
      contact
        ? `Please feel free to contact me at ${contact} for any further information.`
        : "Please feel free to contact Focus Realm for any further information.",
    ],
    closing: "Sincerely,",
  };
}

/** `Internship-Completion-Certificate-Priya-Nair.pdf` */
export function certificateFilename(kind: CertificateKind, fullName: string): string {
  const slug = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const prefix = kind === "completion" ? "Internship-Completion-Certificate" : "Letter-of-Recommendation";
  return `${prefix}-${slug || "Intern"}.pdf`;
}
