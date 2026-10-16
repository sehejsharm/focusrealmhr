/**
 * Consent, notice and retention for the onboarding module.
 *
 * India-specific, and deliberately in one file so the notice a candidate is
 * shown, the consent the server insists on, and the text stored against their
 * record can never drift apart.
 *
 * The framework this is written against:
 *
 *   - Digital Personal Data Protection Act, 2023 — notice before collection,
 *     free, specific, informed and unambiguous consent given by a clear
 *     affirmative action, purpose limitation, and the right to withdraw.
 *   - Aadhaar Act, 2016 (s. 4(3), s. 8A, s. 29) and the Aadhaar (Sharing of
 *     Information) Regulations, 2016 — an Aadhaar copy may be accepted as
 *     voluntary proof of identity, must not be published or displayed in full,
 *     and the number must be redacted wherever it is shown. An entity that
 *     checks an Aadhaar without authenticating it must not collect or store
 *     the number (s. 8A(4)), and UIDAI's direction is to keep only a masked
 *     copy — so the portal asks for the last four digits and a masked copy.
 *   - Indian Contract Act, 1872 (s. 11) — someone under 18 cannot contract, so
 *     the candidate declares they are 18 or older.
 *   - Information Technology Act, 2000 (s. 10A) — an agreement concluded
 *     electronically; and the Bharatiya Sakshya Adhiniyam, 2023 (s. 63, which
 *     replaced s. 65B of the Evidence Act) — the electronic record kept of it.
 *
 * NOT LEGAL ADVICE. Have counsel review this notice, the retention period and
 * the agreement itself before the module is used with real candidates.
 */

/**
 * 2026-10-16.1: names the Focus Realm Sales CRM as a recipient for people in
 * sales (see CRM_NOTICE_VERSION).
 * 2026-10-12.1: the last four digits of an Aadhaar and a masked copy instead of
 * the full number, an 18-or-older declaration, and a reply period for requests.
 */
export const PRIVACY_NOTICE_VERSION = "2026-10-16.1";

/**
 * The first notice to cover the Focus Realm Workspace, the team's own app.
 * Someone who consented under an earlier version never agreed to their data
 * going there, so the phone number they gave stays out of it; their name,
 * email, role and start date still go, because a login cannot exist without
 * them. See lib/onboarding/workspace.server.ts.
 */
export const WORKSPACE_NOTICE_VERSION = "2026-10-10.1";

/**
 * The first notice to cover the Focus Realm Sales CRM. As with the Workspace,
 * a sales person who consented earlier keeps their phone number out of it;
 * their name, email, role and start date still go, because a CRM login cannot
 * exist without them. See lib/onboarding/crm.server.ts.
 */
export const CRM_NOTICE_VERSION = "2026-10-16.1";

/** Whether a consent was given under `minimum` or a later notice. */
function consentFrom(consent: { noticeVersion: string } | null | undefined, minimum: string): boolean {
  const version = consent?.noticeVersion ?? "";
  // Versions are "<date it took effect>.<revision that day>", so they sort naturally.
  return (
    /^\d{4}-\d{2}-\d{2}\.\d+$/.test(version) &&
    version.localeCompare(minimum, "en", { numeric: true }) >= 0
  );
}

/** Whether a consent was given under a notice that covers the Workspace. */
export function consentCoversWorkspace(consent: { noticeVersion: string } | null | undefined): boolean {
  return consentFrom(consent, WORKSPACE_NOTICE_VERSION);
}

/** Whether a consent was given under a notice that covers the Sales CRM. */
export function consentCoversCrm(consent: { noticeVersion: string } | null | undefined): boolean {
  return consentFrom(consent, CRM_NOTICE_VERSION);
}

/** Overridable per deployment — these appear in the notice the candidate reads. */
export const DATA_FIDUCIARY = {
  name: "FocusRealm (to be incorporated)",
  place: "Pune, Maharashtra, India",
  grievanceOfficer: "The Founders, FocusRealm",
  grievanceEmail: process.env.NEXT_PUBLIC_ONBOARDING_PRIVACY_EMAIL ?? "privacy@focusrealm.in",
} as const;

/** Why each piece of personal data is collected. Nothing else is a valid use. */
export const PURPOSES = [
  "To prepare, issue and evidence your internship agreement.",
  "To verify that you are the person the internship was offered to.",
  "To run and record your onboarding — the handbooks, briefings and assessments.",
  "To create your company mailbox once your agreement is verified.",
  "To give you a login to the Focus Realm Workspace, the team's own app, and keep your name, role and contact details there up to date.",
  "If you join the sales department, to give you a login to the Focus Realm Sales CRM, where the sales team manages its prospects and calls, and keep your name, role and contact details there up to date.",
  "To keep the records the Company is required to keep about its engagements.",
] as const;

export const DATA_COLLECTED = [
  "Your name, your parent's name, postal address, phone number and personal email.",
  "The last four digits of your Aadhaar number, and the masked copy of your Aadhaar card you upload.",
  "Your progress through the handbooks, briefings and assessments, including scores.",
  "The agreement you sign, the name you type as your signature, and the date, time, IP address and browser recorded at signing.",
] as const;

/** How the Aadhaar copy is handled. Shown verbatim next to the upload field. */
export const AADHAAR_SAFEGUARDS = [
  "Giving your Aadhaar is voluntary. If you would rather not, tell your point of contact — another government photo ID (PAN, passport, driving licence or voter ID) can be accepted instead.",
  "No UIDAI authentication, e-KYC or Aadhaar verification is performed. The copy is used only to confirm your identity and to fill in your agreement.",
  "We never ask for your full Aadhaar number — only its last four digits, and a masked copy of your card that shows no more than that. Download a masked Aadhaar from myAadhaar, or cover the first eight digits on a photo of your card.",
  "The copy is held in private storage that the portal itself cannot read, is never published, shared with any third party, or used for any other purpose.",
  "Every time a founder opens your Aadhaar copy, that access is recorded against your record.",
] as const;

export const RETENTION = {
  summary:
    "Your onboarding record and your Aadhaar copy are kept for the duration of your internship and for three years after it ends, after which they are erased.",
  detail:
    "Three years is the period the Company keeps engagement records for, so that it can answer questions about an internship it has issued — for example a reference request or a tax query. If your internship does not go ahead, your record and your Aadhaar copy are erased within 90 days of that decision.",
} as const;

/** DPDP Act rights, in the words a candidate can act on. */
export const RIGHTS = [
  {
    title: "See what we hold",
    body: "Ask for a summary of the personal data held about you and who it has been shared with.",
  },
  {
    title: "Correct it",
    body: "Ask for anything inaccurate, incomplete or out of date to be corrected or completed.",
  },
  {
    title: "Have it erased",
    body: "Ask for your data to be erased once it is no longer needed for the purposes above, or where the law does not require it to be kept.",
  },
  {
    title: "Withdraw your consent",
    body: "Withdraw consent at any time, as easily as you gave it. Onboarding cannot continue without it, and anything already done on the strength of your earlier consent stays valid.",
  },
  {
    title: "Raise a grievance",
    body: `Write to ${DATA_FIDUCIARY.grievanceOfficer} at ${DATA_FIDUCIARY.grievanceEmail}. We answer every request and grievance within 30 days of receiving it. If the answer does not resolve it, you may complain to the Data Protection Board of India.`,
  },
] as const;

export interface ConsentItem {
  id: string;
  /** The sentence beside the checkbox — what the candidate is agreeing to. */
  label: string;
  detail?: string;
}

/**
 * Every one of these must be ticked before details can be submitted. Each is a
 * separate, specific consent — never pre-ticked, and never bundled.
 */
export const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: "processing",
    label:
      "I have read the privacy notice, and I consent to Focus Realm collecting and processing the personal data listed in it for the purposes listed in it.",
    detail: "Digital Personal Data Protection Act, 2023.",
  },
  {
    id: "aadhaar",
    label:
      "I am submitting the last four digits of my Aadhaar number and a masked copy of my Aadhaar card voluntarily, as proof of identity for my internship agreement.",
    detail:
      "I understand no Aadhaar authentication or e-KYC is carried out, that my full Aadhaar number is never asked for or stored, and that I could have offered another government photo ID instead.",
  },
  {
    id: "retention",
    label: `I understand my record is kept for the duration of my internship and three years after it ends, and that I can ask for it to be corrected or erased, or withdraw my consent, by writing to ${DATA_FIDUCIARY.grievanceEmail}.`,
  },
  {
    id: "age",
    label: "I am 18 years of age or older.",
    detail:
      "If you are under 18, do not submit this form — tell your point of contact. An agreement with someone under 18, and consent to this processing, need a parent or guardian.",
  },
  {
    id: "accuracy",
    label:
      "The details I am submitting are true and correct, and match the identity document I am uploading.",
  },
];

/** Ticked at signing, in addition to the affirmation on the agreement itself. */
export const SIGNING_CONSENT: ConsentItem = {
  id: "electronic-signature",
  label:
    "I have read the agreement in full, I intend to be legally bound by it, and I consent to signing it electronically.",
  detail:
    "An electronic contract is valid under section 10A of the Information Technology Act, 2000. You may take independent legal advice before signing, and you can ask for a signed copy at any time.",
};

export const REQUIRED_CONSENT_IDS = CONSENT_ITEMS.map((item) => item.id);

export function missingConsents(accepted: string[]): string[] {
  return REQUIRED_CONSENT_IDS.filter((id) => !accepted.includes(id));
}
