import { activeCertificate, certificateWindow, plannedCertificates } from "./certificates";
import { endDateOf } from "./stage";
import type { Candidate, CertificateKind } from "./types";

/**
 * Offboarding: how an intern leaves, and how they collect their documents.
 *
 * Two days before the term ends, the founders' console shows a personal
 * offboarding link to send to the intern. It opens the day after their last
 * day. The intern answers a few questions about their time here, then
 * downloads whichever of their completion certificate and recommendation
 * letter the founders have approved. No password is involved — the link is
 * the key, as the onboarding link was.
 *
 * Safe to import from the browser. Dates are judged in Indian time.
 */

/** The link appears for founders this many days before the last day. */
export const OFFBOARDING_LINK_DAYS_BEFORE_END = 2;

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** Midnight in India at the start of the day `days` after the date in `iso`. */
function istMidnight(iso: string, days: number): Date {
  const date = new Date(iso);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days) - IST_OFFSET_MS,
  );
}

/** The last day of the internship — the end date shown everywhere else. */
export function lastDayOf(candidate: Candidate): string {
  return endDateOf(candidate);
}

/** When founders can first see and send the link. */
export function offboardingLinkFrom(candidate: Candidate): Date {
  return istMidnight(lastDayOf(candidate), -OFFBOARDING_LINK_DAYS_BEFORE_END);
}

/** When the intern can first use it: the day after their last day. */
export function offboardingOpensAt(candidate: Candidate): Date {
  return istMidnight(lastDayOf(candidate), 1);
}

export type OffboardingState =
  | { status: "not-eligible"; reason: string }
  /** Too early for the link to exist yet. */
  | { status: "not-yet"; linkFrom: string; opensAt: string }
  /** The link exists and can be sent; the intern cannot use it until opensAt. */
  | { status: "link-ready"; opensAt: string }
  /** The intern can offboard now. */
  | { status: "open"; opensAt: string }
  | { status: "done"; submittedAt: string };

export function offboardingState(candidate: Candidate, now = new Date()): OffboardingState {
  if (candidate.offboarding) return { status: "done", submittedAt: candidate.offboarding.submittedAt };

  // Same rule as the documents: someone who left early, or whose agreement
  // was never executed, has no completed internship to leave.
  const eligibility = certificateWindow(candidate, now);
  if (eligibility.status === "not-eligible") return eligibility;

  const linkFrom = offboardingLinkFrom(candidate);
  const opensAt = offboardingOpensAt(candidate);
  if (now.getTime() < linkFrom.getTime()) {
    return { status: "not-yet", linkFrom: linkFrom.toISOString(), opensAt: opensAt.toISOString() };
  }
  return now.getTime() < opensAt.getTime()
    ? { status: "link-ready", opensAt: opensAt.toISOString() }
    : { status: "open", opensAt: opensAt.toISOString() };
}

/** Whether founders should see (and can send) the link. */
export function offboardingLinkAvailable(state: OffboardingState): boolean {
  return state.status === "link-ready" || state.status === "open" || state.status === "done";
}

/** Days left until `iso`, rounded up — for "opens in 2 days". */
export function daysUntil(iso: string, now = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS);
}

/* -------------------------------------------------------------------------- */
/* Exit questions                                                             */
/* -------------------------------------------------------------------------- */

export interface ExitQuestion {
  id: string;
  label: string;
  hint?: string;
  kind: "scale" | "choice" | "text";
  options?: string[];
  required: boolean;
  maxLength?: number;
}

export const EXIT_QUESTIONS: ExitQuestion[] = [
  {
    id: "rating",
    label: "Overall, how would you rate your internship?",
    hint: "1 is poor, 5 is excellent.",
    kind: "scale",
    options: ["1", "2", "3", "4", "5"],
    required: true,
  },
  {
    id: "highlight",
    label: "What was the most valuable thing you learned or worked on?",
    kind: "text",
    required: true,
    maxLength: 1500,
  },
  {
    id: "improve",
    label: "What could we have done better to support you during your term?",
    hint: "Be candid — this is how the next intern gets a better internship.",
    kind: "text",
    required: true,
    maxLength: 1500,
  },
  {
    id: "recommend",
    label: "Would you recommend a Focus Realm internship to a friend?",
    kind: "choice",
    options: ["Yes", "Maybe", "No"],
    required: true,
  },
  {
    id: "anything",
    label: "Anything else you would like the founders to know?",
    hint: "Optional.",
    kind: "text",
    required: false,
    maxLength: 1500,
  },
];

/** Checks submitted answers against the questions. Unknown keys are dropped. */
export function validateExitAnswers(
  input: unknown,
): { answers: Record<string, string> } | { error: string } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const answers: Record<string, string> = {};

  for (const question of EXIT_QUESTIONS) {
    const value = typeof raw[question.id] === "string" ? (raw[question.id] as string).trim() : "";

    if (!value) {
      if (question.required) return { error: `Please answer: "${question.label}"` };
      continue;
    }
    if (question.options && !question.options.includes(value)) {
      return { error: `Choose one of the options for: "${question.label}"` };
    }
    if (question.maxLength && value.length > question.maxLength) {
      return { error: `Keep your answer to "${question.label}" under ${question.maxLength} characters.` };
    }
    answers[question.id] = value;
  }

  return { answers };
}

/* -------------------------------------------------------------------------- */
/* Documents handed over at the end                                           */
/* -------------------------------------------------------------------------- */

export interface OffboardingDocument {
  kind: CertificateKind;
  /** Approved by a founder and ready to download. */
  ready: boolean;
  serial: string | null;
  issuedAt: string | null;
}

/** The documents this intern leaves with, as the founders decided. */
export function offboardingDocuments(candidate: Candidate): OffboardingDocument[] {
  return plannedCertificates(candidate).map((kind) => {
    const issued = activeCertificate(candidate, kind);
    return {
      kind,
      ready: Boolean(issued),
      serial: issued?.serial ?? null,
      issuedAt: issued?.issuedAt ?? null,
    };
  });
}
