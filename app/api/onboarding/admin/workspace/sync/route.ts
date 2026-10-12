import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { listCandidates } from "@/lib/onboarding/store.server";
import {
  describeWorkspaceFailure,
  linkWorkspaceAccount,
  workspaceConfigured,
} from "@/lib/onboarding/workspace.server";

/**
 * Gives everyone already in the console a Workspace login: people added before
 * the two apps were connected, or whose login could not be created at the
 * time. Removed people are left out.
 *
 * Safe to run any number of times. Anyone already linked is skipped, and the
 * Workspace applies each person's creation event once — the event id comes
 * from their record id — so a re-run never makes a second account or a second
 * temporary password.
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
  const failed: { id: string; name: string; error: string }[] = [];
  let unreachable = false;

  // One at a time, oldest first, so employee IDs follow the order people joined.
  const candidates = (await listCandidates()).reverse();

  for (const candidate of candidates) {
    const name = candidate.details?.fullName ?? candidate.invitedName;

    if (candidate.workspace?.loginId) {
      alreadyLinked++;
      continue;
    }
    if (candidate.removal) {
      skipped++;
      continue;
    }
    if (unreachable) {
      failed.push({ id: candidate.id, name, error: "Not attempted — the Workspace could not be reached." });
      continue;
    }

    try {
      const login = await linkWorkspaceAccount(candidate);
      if (login) synced++;
      else failed.push({ id: candidate.id, name, error: "The Workspace did not return a login. Run the sync again." });
    } catch (cause) {
      console.error("Workspace sync failed for", candidate.id, cause);
      const failure = describeWorkspaceFailure(cause);
      failed.push({ id: candidate.id, name, error: failure.message });
      // A refusal is about this one person. No answer at all means the Workspace
      // is down: stop, rather than sit through every remaining timeout.
      if (!failure.answered) unreachable = true;
    }
  }

  return json({ synced, alreadyLinked, skipped, failed });
}
