import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { listCandidates } from "@/lib/onboarding/store.server";
import {
  describeWorkspaceFailure,
  lastDayOver,
  linkWorkspaceAccount,
  offboardLeavers,
  workspaceConfigured,
} from "@/lib/onboarding/workspace.server";
import {
  crmConfigured,
  crmWaitsForWorkspace,
  describeCrmFailure,
  linkCrmAccount,
  offboardCrmLeavers,
  wantsCrm,
} from "@/lib/onboarding/crm.server";

type Failure = { id: string; name: string; email: string; error: string; system: "Workspace" | "Sales CRM" };

/**
 * Gives every active person in the console without a Workspace login one:
 * people added before the two apps were connected, and anyone whose earlier
 * attempt failed — each run tries them again. Removed people, and anyone whose
 * last day is over, are left out. Then it makes everyone who has left — last
 * day over, or removed — a former employee in the Workspace, as the daily
 * cron does, so a founder never has to wait for it.
 *
 * Everyone is keyed on their record id, never their email. Two people with the
 * same invite address or mailbox are two people, and each gets their own login.
 *
 * Safe to run any number of times. Anyone already linked is skipped, and the
 * Workspace applies each person's creation event once — the event id comes
 * from their record id, and an event that failed before is applied afresh — so
 * a re-run never makes a second account or a second temporary password.
 *
 * The Sales CRM gets the same treatment, for sales people only, after the
 * Workspace pass so their CRM login reuses the Workspace employee ID.
 */
/** Which connections are on, so the console can label the sync button. */
export async function GET() {
  if (!(await isAdmin())) return error("Not authorised.", 401);
  return json({ workspace: workspaceConfigured(), crm: crmConfigured() });
}

export async function POST() {
  if (!(await isAdmin())) return error("Not authorised.", 401);
  if (!workspaceConfigured() && !crmConfigured()) {
    return error(
      "Neither the Workspace nor the Sales CRM is connected. Set FOCUS_REALM_WORKSPACE_URL and FOCUS_REALM_WORKSPACE_SECRET (and, for sales, FOCUS_REALM_CRM_URL and FOCUS_REALM_CRM_SECRET), then try again.",
      409,
    );
  }

  let synced = 0;
  let alreadyLinked = 0;
  let skipped = 0;
  const failed: Failure[] = [];
  let unreachable = false;

  // One at a time, oldest first, so employee IDs follow the order people joined.
  const candidates = (await listCandidates()).reverse();

  for (const candidate of workspaceConfigured() ? candidates : []) {
    const name = candidate.details?.fullName ?? candidate.invitedName;
    const email = candidate.mailbox?.address ?? candidate.invitedEmail;

    if (candidate.workspace?.loginId) {
      alreadyLinked++;
      continue;
    }
    if (candidate.removal || lastDayOver(candidate)) {
      skipped++;
      continue;
    }
    if (unreachable) {
      failed.push({ system: "Workspace", id: candidate.id, name, email, error: "Not attempted — the Workspace could not be reached." });
      continue;
    }

    try {
      const login = await linkWorkspaceAccount(candidate);
      if (login) synced++;
      else failed.push({ system: "Workspace", id: candidate.id, name, email, error: "The Workspace did not return a login. Run the sync again." });
    } catch (cause) {
      console.error("Workspace sync failed for", candidate.id, cause);
      const failure = describeWorkspaceFailure(cause);
      failed.push({ system: "Workspace", id: candidate.id, name, email, error: failure.message });
      // A refusal is about this one person. No answer at all means the Workspace
      // is down: stop, rather than sit through every remaining timeout.
      if (!failure.answered) unreachable = true;
    }
  }

  // Leavers too — skipped while the Workspace is not answering.
  const leavers = unreachable || !workspaceConfigured() ? { offboarded: [], failed: [] } : await offboardLeavers();
  for (const failure of leavers.failed) {
    failed.push({ ...failure, system: "Workspace", error: `Could not make them a former employee: ${failure.error}` });
  }

  // The Sales CRM: every active sales person without a login, read afresh so
  // the Workspace IDs just issued are reused.
  const crm = { synced: 0, alreadyLinked: 0, offboarded: 0 };
  if (crmConfigured()) {
    let crmUnreachable = false;
    for (const candidate of (await listCandidates()).reverse()) {
      if (candidate.removal || lastDayOver(candidate) || !wantsCrm(candidate)) continue;
      if (candidate.crm) {
        crm.alreadyLinked++;
        continue;
      }
      const name = candidate.details?.fullName ?? candidate.invitedName;
      const email = candidate.mailbox?.address ?? candidate.invitedEmail;
      const fail = (error: string) => failed.push({ system: "Sales CRM", id: candidate.id, name, email, error });

      if (crmWaitsForWorkspace(candidate)) {
        fail("Waiting for their Workspace login, so both use the same employee ID.");
        continue;
      }
      if (crmUnreachable) {
        fail("Not attempted — the CRM could not be reached.");
        continue;
      }
      try {
        if (await linkCrmAccount(candidate)) crm.synced++;
      } catch (cause) {
        console.error("CRM sync failed for", candidate.id, cause);
        const failure = describeCrmFailure(cause);
        fail(failure.message);
        if (!failure.answered) crmUnreachable = true;
      }
    }

    if (!crmUnreachable) {
      const crmLeavers = await offboardCrmLeavers();
      crm.offboarded = crmLeavers.offboarded.length;
      for (const failure of crmLeavers.failed) {
        failed.push({ ...failure, system: "Sales CRM", error: `Could not switch off their CRM login: ${failure.error}` });
      }
    }
  }

  return json({
    synced,
    alreadyLinked,
    skipped,
    offboarded: leavers.offboarded.length,
    crm: crmConfigured() ? crm : null,
    failed,
  });
}
