import { companyLabel } from "./content";
import { formatLongDate, spellMonths } from "./contract";
import { LETTERHEAD } from "./letterhead";
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
 * End-of-internship documents: the framed certificate of completion, a formal
 * completion letter on the letterhead (what a background check asks for), and
 * a letter of recommendation, also on the letterhead.
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

export const CERTIFICATE_KINDS: CertificateKind[] = ["completion", "completion-letter", "recommendation"];

export const CERTIFICATE_LABEL: Record<CertificateKind, string> = {
  completion: "Certificate of internship completion",
  "completion-letter": "Internship completion letter",
  recommendation: "Letter of recommendation",
};

/** "certificate" or "letter", for buttons and sentences. */
export function documentNoun(kind: CertificateKind): string {
  return kind === "completion" ? "certificate" : "letter";
}

const TITLE: Record<CertificateKind, string> = {
  completion: "Certificate of Internship Completion",
  "completion-letter": "Internship Completion Letter",
  recommendation: "Letter of Recommendation",
};

/**
 * The current wording. Documents drafted before it (no `template`) keep their
 * frozen text; the console offers to withdraw and reissue them.
 */
export const CERTIFICATE_TEMPLATE = 2;

export function isCertificateKind(value: unknown): value is CertificateKind {
  return value === "completion" || value === "completion-letter" || value === "recommendation";
}

/** Whether an issued document was drafted with an earlier wording than today's. */
export function hasEarlierWording(text: CertificateText): boolean {
  return (text.template ?? 1) < CERTIFICATE_TEMPLATE;
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
  /**
   * Who signs. On the letters, contactEmail and contactPhone are how a referee
   * or a background check reaches them; left out, the letterhead's are used.
   */
  signatory: { name: string; designation: string; contactEmail?: string; contactPhone?: string };
  /** Optional words from the founder, printed as their own paragraph of the recommendation. */
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
  const months = spellMonths(candidate.termMonths || DEFAULT_TERM_MONTHS);
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
    issuedOn: options.issuedOn,
    serial: options.serial,
    template: CERTIFICATE_TEMPLATE,
  };

  if (kind === "completion") {
    return {
      ...base,
      signatory: { name: options.signatory.name, designation: options.signatory.designation },
      paragraphs: [
        `has successfully completed an internship of ${months} months with Focus Realm as ${role.roleTitle}, from ${start} to ${end}.`,
        `During the internship, ${first} worked on ${role.duties}${across}.`,
        `We thank ${first} for the contribution made to Focus Realm and wish ${first} every success in the future.`,
      ],
    };
  }

  // Letters say how to reach the signatory: a referee writing back, or a
  // background check verifying the letter.
  const signatory = {
    name: options.signatory.name,
    designation: options.signatory.designation,
    contactEmail: options.signatory.contactEmail?.trim() || LETTERHEAD.email,
    contactPhone: options.signatory.contactPhone?.trim() || LETTERHEAD.phone,
  };
  const letter = { ...base, signatory, salutation: "To Whom It May Concern", closing: "Yours faithfully," };

  if (kind === "completion-letter") {
    return {
      ...letter,
      subject: `Completion of internship by ${name}`,
      paragraphs: [
        `This is to certify that ${name} has successfully completed an internship with Focus Realm as ${role.roleTitle}. The internship ran for ${months} months, from ${start} to ${end}${across}.`,
        `During this period, ${first} was responsible for ${role.duties}.`,
        `Throughout the internship, ${first}'s conduct was professional and in keeping with the standards expected at Focus Realm.`,
        "This letter is issued upon the successful completion of the internship, for whatever purpose it may serve.",
        `For verification of this letter, or for any background check, please contact ${signatory.name}, ${signatory.designation}, Focus Realm, at ${signatory.contactPhone} or ${signatory.contactEmail}, quoting reference number ${options.serial}.`,
      ],
    };
  }

  // Only claimed where the record shows it: someone added directly as an
  // existing employee never went through the console's programme.
  const passedProgramme =
    !candidate.existing && requiredTestIds(candidate).every((id) => hasPassed(candidate, id));
  const highlights = options.highlights?.trim();

  return {
    ...letter,
    subject: `Letter of recommendation for ${name}`,
    paragraphs: [
      `It is my pleasure to recommend ${name}, who completed an internship of ${months} months with Focus Realm as ${role.roleTitle}, from ${start} to ${end}${across}.`,
      `During the internship, ${first} was responsible for ${role.duties}.${
        passedProgramme
          ? ` Before taking up these responsibilities, ${first} completed our structured onboarding programme and passed each of its assessments.`
          : ""
      }`,
      ...(highlights ? [highlights] : []),
      `Throughout the engagement, ${first} demonstrated professionalism, diligence and a genuine willingness to learn, and carried out the work with integrity. I recommend ${first} without reservation for further academic and professional opportunities, and I am confident that ${first} will be an asset to any organisation.`,
      `Should you require any further information, please contact me at ${signatory.contactPhone} or ${signatory.contactEmail}. This letter may be verified with Focus Realm by quoting reference number ${options.serial}.`,
    ],
  };
}

/** `Internship-Completion-Letter-Priya-Nair.pdf` */
export function certificateFilename(kind: CertificateKind, fullName: string): string {
  const slug = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const prefix: Record<CertificateKind, string> = {
    completion: "Internship-Completion-Certificate",
    "completion-letter": "Internship-Completion-Letter",
    recommendation: "Letter-of-Recommendation",
  };
  return `${prefix[kind]}-${slug || "Intern"}.pdf`;
}
