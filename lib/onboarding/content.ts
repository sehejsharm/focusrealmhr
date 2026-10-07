/**
 * The onboarding material a candidate works through, and the mail settings
 * they receive at the end. Everything an operator would realistically want to
 * change lives here rather than being scattered through components.
 */

import type { Company } from "./types";

export type ResourceKind = "handbook" | "video";

export interface Resource {
  id: string;
  kind: ResourceKind;
  /** The company this material belongs to. */
  company: Company;
  title: string;
  subtitle: string;
  /** What the candidate should take away — shown under the title. */
  summary: string;
  meta: string;
  /** Handbooks stream through the token-gated API; videos link out to Drive. */
  file?: string;
  url?: string;
  /**
   * True when `url` points at the shared Drive folder rather than this specific
   * video. Replace with the per-video link and clear the flag.
   */
  linkPending?: boolean;
}

/** Shared Drive folder holding both onboarding videos. */
export const VIDEO_FOLDER_URL =
  "https://drive.google.com/drive/folders/1bU9QEMiRfBWFcopX-8IgDoBV1VV9wRZs";

export const RESOURCES: Resource[] = [
  {
    id: "handbook-focus-realm",
    company: "focus-realm",
    kind: "handbook",
    title: "Intern Onboarding & Company Handbook",
    subtitle: "Focus Realm",
    summary:
      "The company, both product lines, how we sell, and the language rules that are non-negotiable. Read it start to finish before you attempt the assessment.",
    meta: "PDF · 22 pages · 17 sections",
    file: "handbooks/focus-realm-handbook.pdf",
  },
  {
    id: "handbook-recharga",
    company: "recharga",
    kind: "handbook",
    title: "Complete Company & Product Onboarding Guide",
    subtitle: "Recharga Chargine",
    summary:
      "The RADAX generator platform, where the technology actually stands, the licensing business model, and the six ground rules.",
    meta: "PDF · 28 pages · 16 sections",
    file: "handbooks/recharga-chargine-guide.pdf",
  },
  {
    id: "video-focus-realm",
    company: "focus-realm",
    kind: "video",
    title: "Focus Realm — company walkthrough",
    subtitle: "Video briefing",
    summary:
      "Watch alongside the Focus Realm handbook. Covers the two verticals and the positioning rules in narrated form.",
    meta: "Google Drive",
    url: "https://drive.google.com/file/d/1E5hAJHwy69YFktA9gtyDekW4j3kop5FJ/view",
  },
  {
    id: "video-recharga",
    company: "recharga",
    kind: "video",
    title: "Recharga Chargine — product walkthrough",
    subtitle: "Video briefing",
    summary:
      "Watch alongside the Recharga guide. Covers the generator problem, RADAX, and where the technology stands today.",
    meta: "Google Drive",
    url: VIDEO_FOLDER_URL,
    linkPending: true,
  },
];

export interface CompanyDefinition {
  id: Company;
  label: string;
  /** The assessment covering this company's handbook. */
  testId: string;
}

export const COMPANIES: CompanyDefinition[] = [
  { id: "focus-realm", label: "Focus Realm", testId: "test-focus-realm" },
  { id: "recharga", label: "Recharga Chargine", testId: "test-recharga" },
];

export const ALL_COMPANIES: Company[] = COMPANIES.map((c) => c.id);

export function isCompany(value: unknown): value is Company {
  return ALL_COMPANIES.includes(value as Company);
}

export function companyLabel(id: Company): string {
  return COMPANIES.find((c) => c.id === id)?.label ?? id;
}

/** The handbooks and videos for the chosen companies, in canonical order. */
export function resourcesFor(companies: Company[]): Resource[] {
  return RESOURCES.filter((r) => companies.includes(r.company));
}

/** The assessments for the chosen companies, in canonical order. */
export function testIdsFor(companies: Company[]): string[] {
  return COMPANIES.filter((c) => companies.includes(c.id)).map((c) => c.testId);
}

export function getResource(id: string): Resource | undefined {
  return RESOURCES.find((r) => r.id === id);
}

/**
 * SpaceMail client settings, per Spaceship's knowledge base. Confirm against
 * Spacemail Manager (⋯ next to the mailbox → IMAP/POP3/SMTP) if a candidate
 * reports a connection failure.
 */
export const MAIL_SETTINGS = {
  provider: "SpaceMail",
  webmail: "https://spacemail.com",
  incoming: {
    protocol: "IMAP",
    host: "mail.spacemail.com",
    port: 993,
    security: "SSL/TLS",
  },
  outgoing: {
    protocol: "SMTP",
    host: "mail.spacemail.com",
    port: 465,
    security: "SSL/TLS",
  },
} as const;

/** The one thing candidates get wrong, called out on the credentials screen. */
export const OUTLOOK_STEPS = [
  "Open Outlook and go to File → Add Account. Type the full Focus Realm address, then choose Advanced options → Let me set up my account manually.",
  "Pick IMAP as the account type. Do not pick Outlook.com, Office 365, or Exchange — those will fail, because this mailbox is hosted on SpaceMail, not Microsoft.",
  `Incoming mail: ${MAIL_SETTINGS.incoming.host}, port ${MAIL_SETTINGS.incoming.port}, encryption ${MAIL_SETTINGS.incoming.security}.`,
  `Outgoing mail: ${MAIL_SETTINGS.outgoing.host}, port ${MAIL_SETTINGS.outgoing.port}, encryption ${MAIL_SETTINGS.outgoing.security}.`,
  "The username is the full email address — not just the part before the @. Enter the temporary password from this page.",
  "Finish, then send yourself a test message to confirm both directions work. Change your password in webmail once you are in.",
];

/** "both assessments are passed" / "your assessment is passed" — copy that counts. */
export function assessmentsPassedPhrase(count: number): string {
  return count === 1 ? "your assessment is passed" : "both assessments are passed";
}
