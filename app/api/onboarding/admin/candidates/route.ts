import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { createCandidate, listCandidates } from "@/lib/onboarding/store.server";
import { agreementReady, companiesOf, currentStage, endDateOf, retentionOf } from "@/lib/onboarding/stage";
import { ALL_COMPANIES, isCompany } from "@/lib/onboarding/content";
import { maskAadhaar } from "@/lib/onboarding/security.server";
import {
  CERTIFICATE_KINDS,
  activeCertificate,
  certificateWindow,
  certificatesAwaitingApproval,
} from "@/lib/onboarding/certificates";
import { offboardingState } from "@/lib/onboarding/offboarding";
import { linkWorkspaceAccount } from "@/lib/onboarding/workspace.server";
import {
  BUILT_IN_TRACKS,
  DEFAULT_TERM_MONTHS,
  MAX_TERM_MONTHS,
  MIN_TERM_MONTHS,
  trackIdFromLabel,
  trackOf,
} from "@/lib/onboarding/types";
import type { AgreementPlan, TrackDefinition } from "@/lib/onboarding/types";

/** Summary rows for the console. Full Aadhaar numbers never appear in the list. */
export async function GET() {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const candidates = await listCandidates();

  return json(
    candidates.map((c) => ({
      id: c.id,
      token: c.token,
      invitedName: c.invitedName,
      invitedEmail: c.invitedEmail,
      track: c.track,
      role: trackOf(c),
      startDate: c.startDate,
      endDate: endDateOf(c),
      termMonths: c.termMonths ?? DEFAULT_TERM_MONTHS,
      agreementKind: c.agreement?.kind ?? "standard",
      companies: companiesOf(c),
      agreementReady: agreementReady(c),
      removal: c.removal ? { leftOn: c.removal.leftOn, reason: c.removal.reason ?? null } : null,
      existing: Boolean(c.existing),
      retention: retentionOf(c),
      createdAt: c.createdAt,
      stage: currentStage(c),
      fullName: c.details?.fullName ?? null,
      aadhaarMasked: c.details ? maskAadhaar(c.details.aadhaarNumber) : null,
      signedAt: c.signature?.signedAt ?? null,
      contractVerifiedAt: c.contractVerifiedAt ?? null,
      emailRequestedAt: c.emailRequestedAt ?? null,
      mailbox: c.mailbox?.address ?? null,
      tests: c.tests,
      certificateWindow: certificateWindow(c),
      /** Documents drafted and waiting for a founder's approval. */
      certificatesAwaiting: certificatesAwaitingApproval(c),
      certificatesIssued: CERTIFICATE_KINDS.filter((kind) => activeCertificate(c, kind)),
      offboarding: offboardingState(c).status,
      offboardedAt: c.offboarding?.submittedAt ?? null,
    })),
  );
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const body = (await request.json().catch(() => null)) as {
    invitedName?: string;
    invitedEmail?: string;
    track?: string;
    startDate?: string;
    /** Sent instead of a built-in track id when the founders define a role. */
    customRole?: { label?: string; roleTitle?: string; duties?: string };
    termMonths?: number;
    /** "standard" issues the template; "bespoke" waits for an uploaded document. */
    agreementKind?: AgreementPlan["kind"];
    /** Which companies' handbooks, videos and tests this candidate gets. */
    companies?: unknown;
    /** Set to add someone already onboarded, instead of inviting them. */
    existing?: { companyEmail?: string; note?: string };
  } | null;

  const invitedName = body?.invitedName?.trim();
  const invitedEmail = body?.invitedEmail?.trim();
  const track = body?.track;
  const startDate = body?.startDate;

  if (!invitedName || !invitedEmail || !track || !startDate) {
    return error("Name, email, track and start date are all required.");
  }
  if (Number.isNaN(Date.parse(startDate))) return error("Start date is not a valid date.");

  /*
   * A role is either one of the built-in tracks or one the founders define
   * here. A custom role is frozen onto the candidate record at invite time, so
   * the agreement a candidate signs can never be rewritten by a later edit.
   */
  let customTrack: TrackDefinition | undefined;

  if (track === "custom") {
    const label = body?.customRole?.label?.trim();
    const roleTitle = body?.customRole?.roleTitle?.trim();
    const duties = body?.customRole?.duties?.trim();

    if (!label || !roleTitle || !duties) {
      return error(
        "A custom role needs a name, the role title for the agreement, and the duties clause.",
      );
    }
    if (label.length > 60 || roleTitle.length > 80 || duties.length > 600) {
      return error("That custom role is too long — shorten the name, title or duties.");
    }

    const id = trackIdFromLabel(label);
    if (BUILT_IN_TRACKS[id]) {
      return error(`"${label}" is already a standard track — pick it from the list instead.`);
    }
    customTrack = { id, label, roleTitle, duties };
  } else if (!BUILT_IN_TRACKS[track]) {
    return error("Unknown track.");
  }

  const termMonths = body?.termMonths ?? DEFAULT_TERM_MONTHS;
  if (
    !Number.isInteger(termMonths) ||
    termMonths < MIN_TERM_MONTHS ||
    termMonths > MAX_TERM_MONTHS
  ) {
    return error(
      `The term has to be a whole number of months between ${MIN_TERM_MONTHS} and ${MAX_TERM_MONTHS}.`,
    );
  }

  const agreementKind = body?.agreementKind ?? "standard";
  if (agreementKind !== "standard" && agreementKind !== "bespoke") {
    return error("Unknown agreement choice.");
  }

  const requested = Array.isArray(body?.companies) ? body.companies : ALL_COMPANIES;
  if (!requested.every(isCompany)) return error("Unknown company.");
  const companies = ALL_COMPANIES.filter((c) => requested.includes(c));
  if (companies.length === 0) {
    return error("Choose at least one company for the candidate to onboard into.");
  }

  /*
   * An existing employee is recorded as already onboarded. Their details,
   * assessments and agreement were handled outside the console, so none of
   * that is fabricated here — least of all a signature.
   */
  let existing: { addedAt: string; note?: string } | undefined;
  let mailbox: { address: string; provisionedAt: string } | undefined;

  if (body?.existing) {
    const now = new Date().toISOString();
    const note = body.existing.note?.trim() || undefined;
    if (note && note.length > 500) return error("Keep the note under 500 characters.");
    existing = { addedAt: now, note };

    const companyEmail = body.existing.companyEmail?.trim();
    if (companyEmail) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(companyEmail)) {
        return error("That company email address is not valid.");
      }
      mailbox = { address: companyEmail, provisionedAt: now };
    }
  }

  const candidate = await createCandidate({
    invitedName,
    invitedEmail,
    track: customTrack ? customTrack.id : track,
    customTrack,
    startDate: new Date(startDate).toISOString(),
    termMonths,
    agreement: { kind: existing ? "standard" : agreementKind },
    companies,
    existing,
    mailbox,
  });

  /*
   * Their Workspace login: an employee ID and a temporary password, sealed on
   * the record until it is collected. Creating the candidate never depends on
   * the Workspace — if it is down they are created all the same, and "Sync
   * everyone to the Workspace" picks them up later.
   */
  let workspace: { loginId: string } | null = null;
  try {
    workspace = await linkWorkspaceAccount(candidate);
  } catch (cause) {
    console.error("Workspace provisioning failed", cause);
  }

  // An existing employee's link opens their employee portal rather than onboarding.
  return json({ id: candidate.id, token: candidate.token, workspace }, 201);
}
