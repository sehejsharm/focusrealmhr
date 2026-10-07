import { getCandidate } from "./store.server";
import { verifyOffboardingCode } from "./security.server";
import { offboardingState } from "./offboarding";
import type { Candidate } from "./types";

/**
 * The record behind an offboarding link, or null if the link is not genuine,
 * the person was removed, or they were never eligible. SERVER ONLY.
 */
export async function resolveOffboarding(code: string): Promise<Candidate | null> {
  const id = verifyOffboardingCode(code);
  if (!id) return null;

  const candidate = await getCandidate(id);
  if (!candidate || candidate.archivedAt) return null;
  if (offboardingState(candidate).status === "not-eligible") return null;

  return candidate;
}
