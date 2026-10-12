import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { listCandidates } from "@/lib/onboarding/store.server";
import {
  describeWorkspaceFailure,
  linkWorkspaceAccount,
  workspaceConfigured,
} from "@/lib/onboarding/workspace.server";

/**
 * Gives every active person in the console without a Workspace login one:
 * people added before the two apps were connected, and anyone whose earlier
 * attempt failed — each run tries them again. Removed people are left out.
 *
 * Everyone is keyed on their record id, never their email. Two people with the
 * same invite address or mailbox are two people, and each gets their own login.
 *
 * Safe to run any number of times. Anyone already linked is skipped, and the
 * Workspace applies each person's creation event once — the event id comes
 * from their record id, and an event that failed before is applied afresh — so
 * a re-run never makes a second account or a second temporary password.
 */
export async function POST() {
  if (!(await isAdmin())) return error("Not authorised.", 401);
  if (!workspaceConfigured()) {
    return error(
      "The Workspace is not connected. Set FOCUS_REALM_WORKSPACE_URL and FOCUS_REALM_WORKSPACE_SECRET, then try again.",
      409,
    );
  }

  let synced = 0;
  let alreadyLinked = 0;
  let skipped = 0;
  const failed: { id: string; name: string; email: string; error: string }[] = [];
  let unreachable = false;

  // One at a time, oldest first, so employee IDs follow the order people joined.
  const candidates = (await listCandidates()).reverse();

  for (const candidate of candidates) {
    const name = candidate.details?.fullName ?? candidate.invitedName;
    const email = candidate.mailbox?.address ?? candidate.invitedEmail;

    if (candidate.workspace?.loginId) {
      alreadyLinked++;
      continue;
    }
    if (candidate.removal) {
      skipped++;
      continue;
    }
    if (unreachable) {
      failed.push({ id: candidate.id, name, email, error: "Not attempted — the Workspace could not be reached." });
      continue;
    }

    try {
      const login = await linkWorkspaceAccount(candidate);
      if (login) synced++;
      else failed.push({ id: candidate.id, name, email, error: "The Workspace did not return a login. Run the sync again." });
    } catch (cause) {
      console.error("Workspace sync failed for", candidate.id, cause);
      const failure = describeWorkspaceFailure(cause);
      failed.push({ id: candidate.id, name, email, error: failure.message });
      // A refusal is about this one person. No answer at all means the Workspace
      // is down: stop, rather than sit through every remaining timeout.
      if (!failure.answered) unreachable = true;
    }
  }

  return json({ synced, alreadyLinked, skipped, failed });
}
