import { ALL_COMPANIES, isCompany, resourcesFor, testIdsFor } from "./content";
import type { Candidate, Company, Stage } from "./types";
import { DEFAULT_TERM_MONTHS, STAGE_ORDER } from "./types";

/**
 * The companies this candidate is onboarding into. A record with no choice on
 * it predates the choice existing, and was onboarded under both — so that is
 * what it resolves to, and nobody mid-flow has their requirements changed.
 */
export function companiesOf(candidate: Pick<Candidate, "companies">): Company[] {
  const chosen = (candidate.companies ?? []).filter(isCompany);
  return chosen.length > 0 ? ALL_COMPANIES.filter((c) => chosen.includes(c)) : ALL_COMPANIES;
}

/** The handbooks and videos this candidate is required to work through. */
export function requiredResources(candidate: Candidate) {
  return resourcesFor(companiesOf(candidate));
}

/** The assessments this candidate is required to pass. */
export function requiredTestIds(candidate: Candidate): string[] {
  return testIdsFor(companiesOf(candidate));
}

export function hasPassed(candidate: Candidate, testId: string): boolean {
  return (candidate.tests[testId] ?? []).some((a) => a.passed);
}

export function bestScore(candidate: Candidate, testId: string): number | null {
  const attempts = candidate.tests[testId] ?? [];
  return attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
}

/** How many of this candidate's own required resources are marked done. */
export function resourcesDone(candidate: Candidate): number {
  return requiredResources(candidate).filter((r) => candidate.resources[r.id]).length;
}

export function learningComplete(candidate: Candidate): boolean {
  return requiredResources(candidate).every((r) => candidate.resources[r.id]);
}

/** When the engagement ends — start date plus the agreed term. */
export function endDateOf(candidate: Candidate): string {
  const end = new Date(candidate.startDate);
  end.setUTCMonth(end.getUTCMonth() + (candidate.termMonths || DEFAULT_TERM_MONTHS));
  return end.toISOString();
}

/**
 * An agreement a candidate can actually sign: either the standard template,
 * or a bespoke document the founders have uploaded for this role.
 */
export function agreementReady(candidate: Candidate): boolean {
  const plan = candidate.agreement ?? { kind: "standard" as const };
  return plan.kind === "standard" || Boolean(plan.document);
}

/**
 * The single source of truth for where a candidate is. Derived rather than
 * stored, so a record can never drift out of sync with its own contents.
 */
export function currentStage(candidate: Candidate): Stage {
  // Onboarded before the console existed — there are no steps left to take.
  if (candidate.existing) return "complete";
  if (!candidate.details) return "details";
  if (!learningComplete(candidate)) return "learning";
  if (!requiredTestIds(candidate).every((id) => hasPassed(candidate, id))) return "tests";
  if (!candidate.signature) return "contract";
  if (!candidate.contractVerifiedAt) return "verification";
  if (!candidate.mailbox) return "email";
  return "complete";
}

export function stageIndex(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function isStageDone(candidate: Candidate, stage: Stage): boolean {
  return stageIndex(currentStage(candidate)) > stageIndex(stage);
}

/** Retention periods, as promised in the privacy notice (compliance.ts). */
const KEEP_AFTER_END_YEARS = 3;
const ERASE_IF_NOT_STARTED_DAYS = 90;

export interface RetentionPlan {
  /** "keep" once the internship went ahead; "erase" if it never began. */
  kind: "keep" | "erase";
  /** Keep until, or erase by, this date. */
  until: string;
}

/**
 * What the notice commits the Company to for a removed intern. An internship
 * "went ahead" once the agreement was executed — before that, nothing began.
 */
export function retentionOf(candidate: Candidate): RetentionPlan | null {
  if (!candidate.removal) return null;

  const left = new Date(candidate.removal.leftOn);
  // An existing employee was working, so their engagement went ahead too.
  if (candidate.contractVerifiedAt || candidate.existing) {
    const until = new Date(left);
    until.setUTCFullYear(until.getUTCFullYear() + KEEP_AFTER_END_YEARS);
    return { kind: "keep", until: until.toISOString() };
  }

  const until = new Date(left);
  until.setUTCDate(until.getUTCDate() + ERASE_IF_NOT_STARTED_DAYS);
  return { kind: "erase", until: until.toISOString() };
}
