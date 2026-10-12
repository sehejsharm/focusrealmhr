import {
  offboardWorkspaceAccount,
  provisionWorkspaceAccount,
  restoreWorkspaceAccount,
  updateWorkspaceAccount,
  type WorkspaceCandidate,
  type WorkspaceCredentials,
} from "./workspace-sync.server";
import { consentCoversWorkspace } from "./compliance";
import { formatLongDate } from "./contract";
import { lastDayOf, offboardingOpensAt } from "./offboarding";
import { seal, unseal } from "./security.server";
import { listCandidates, updateCandidate } from "./store.server";
import { trackOf, type Candidate, type WorkspaceLogin } from "./types";

/**
 * The HR console's side of the Focus Realm Workspace connection. SERVER ONLY.
 *
 * workspace-sync.server.ts is the Workspace's own client, copied verbatim from
 * the Workspace repository so it can be replaced wholesale; nothing here
 * changes what it sends. This file records what comes back: the login ID on
 * the candidate, and the temporary password sealed exactly like the mailbox
 * one — encrypted at rest, shown once, then destroyed.
 *
 * With FOCUS_REALM_WORKSPACE_URL or FOCUS_REALM_WORKSPACE_SECRET unset, the
 * client sends nothing and returns null, and everything here follows suit.
 */

/**
 * Exactly what of a candidate may leave for the Workspace. Never the Aadhaar
 * number or copy, the address or the parent's name — and the phone number only
 * for someone who consented under a privacy notice that covers the Workspace.
 */
function forWorkspace(candidate: Candidate): WorkspaceCandidate {
  const { details } = candidate;
  const track = trackOf(candidate);

  return {
    id: candidate.id,
    invitedName: candidate.invitedName,
    invitedEmail: candidate.invitedEmail,
    startDate: candidate.startDate,
    mailbox: candidate.mailbox ? { address: candidate.mailbox.address } : null,
    role: { roleTitle: track.roleTitle, label: track.label },
    details: details
      ? {
          fullName: details.fullName,
          ...(consentCoversWorkspace(details.consent) ? { phone: details.phone } : {}),
        }
      : null,
  };
}

/** The client's own "is it configured" check, which it does not export. */
function workspaceUrl(): string | null {
  const url = process.env.FOCUS_REALM_WORKSPACE_URL?.replace(/\/$/, "");
  return url && process.env.FOCUS_REALM_WORKSPACE_SECRET ? url : null;
}

export function workspaceConfigured(): boolean {
  return workspaceUrl() !== null;
}

/** Where people sign in to the Workspace, or null while the connection is off. */
export function workspaceLoginUrl(): string | null {
  const url = workspaceUrl();
  return url ? `${url}/login` : null;
}

/**
 * Records a login the Workspace handed back. A new temporary password is
 * sealed before it reaches storage. A reply without one — a retried event, or
 * an account the Workspace already had — never wipes a password that is still
 * waiting to be collected.
 */
export async function recordWorkspaceLogin(
  id: string,
  login: WorkspaceCredentials,
): Promise<Candidate | null> {
  const sealedPassword = login.temporaryPassword ? seal(login.temporaryPassword) : undefined;
  const now = new Date().toISOString();

  return updateCandidate(id, (c) => {
    // The same login keeps its history; a different one starts afresh.
    const kept = c.workspace?.loginId === login.loginId ? c.workspace : undefined;
    return {
      ...c,
      workspace: {
        loginId: login.loginId,
        provisionedAt: kept?.provisionedAt ?? now,
        // A new password has not been seen by anyone yet.
        viewedAt: sealedPassword ? undefined : kept?.viewedAt,
        sealedPassword: sealedPassword ?? kept?.sealedPassword,
        // A new password (a reset) does not undo leaving.
        offboarded: kept?.offboarded,
      },
    };
  });
}

/**
 * Creates the candidate's Workspace login and records it. Run again, it gets
 * back the login already made: the event id is derived from the candidate id,
 * so the Workspace never makes a second account or a second password.
 *
 * Null while the connection is off. Throws when the Workspace refuses or
 * cannot be reached — the caller decides whether that matters.
 */
export async function linkWorkspaceAccount(
  candidate: Candidate,
): Promise<{ loginId: string } | null> {
  const login = await provisionWorkspaceAccount(forWorkspace(candidate));
  if (!login) return null;

  await recordWorkspaceLogin(candidate.id, login);
  return { loginId: login.loginId };
}

/**
 * Sends the candidate's current name, email, role and phone to the Workspace.
 * If it had never seen them — they were added before the two apps were
 * connected, say — the Workspace creates their account there and then, and
 * that login is recorded here like any other rather than lost.
 */
export async function refreshWorkspaceAccount(candidate: Candidate): Promise<void> {
  const login = await updateWorkspaceAccount(forWorkspace(candidate));
  if (!login) return;

  if (login.temporaryPassword || login.loginId !== candidate.workspace?.loginId) {
    await recordWorkspaceLogin(candidate.id, login);
  }
}

/**
 * Hands out the temporary password exactly once and destroys the stored copy,
 * as the mailbox does. The claim is made inside the write, so of two requests
 * at the same moment only the one whose write lands receives it.
 */
export async function claimWorkspacePassword(id: string): Promise<string | null> {
  const claim: { sealed?: string } = {};
  const viewedAt = new Date().toISOString();

  await updateCandidate(id, (c) => {
    claim.sealed = c.workspace?.sealedPassword;
    if (!c.workspace || !claim.sealed) return c;
    return {
      ...c,
      workspace: {
        loginId: c.workspace.loginId,
        provisionedAt: c.workspace.provisionedAt,
        viewedAt,
        offboarded: c.workspace.offboarded,
      },
    };
  });

  return claim.sealed ? unseal(claim.sealed) : null;
}

/**
 * What to tell a founder about a failed Workspace call, and whether the
 * Workspace answered at all. The client words the errors it raises from a
 * response "Workspace rejected …" (a 4xx) or "Workspace error …" (a 5xx);
 * anything else is the network or a timeout. Never carries credentials.
 */
export function describeWorkspaceFailure(cause: unknown): { message: string; answered: boolean } {
  if (cause instanceof Error && /^Workspace (rejected|error)\b/.test(cause.message)) {
    return { message: cause.message, answered: true };
  }
  return { message: "The Workspace could not be reached.", answered: false };
}

/* -------------------------------------------------------------------------- */
/* Leaving                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Whether their last day is over: midnight in India at the end of it, the
 * moment their offboarding link opens. They keep the Workspace through the
 * whole of their last day.
 */
export function lastDayOver(candidate: Candidate, now = new Date()): boolean {
  return now.getTime() >= offboardingOpensAt(candidate).getTime();
}

/** Why someone should be a former employee in the Workspace, or null if they should not. */
function leavingCause(candidate: Candidate, now: Date): NonNullable<WorkspaceLogin["offboarded"]>["cause"] | null {
  if (candidate.removal) return "removed";
  return lastDayOver(candidate, now) ? "term-ended" : null;
}

/**
 * Makes them a former employee in the Workspace — every session there is
 * signed out and their login stops working — and records that it was done.
 * Throws when the Workspace refuses or cannot be reached; nothing is recorded
 * then, so the next sweep tries again.
 */
export async function offboardFromWorkspace(
  candidate: Candidate,
  cause: NonNullable<WorkspaceLogin["offboarded"]>["cause"],
  reason?: string,
): Promise<boolean> {
  if (!candidate.workspace) return false;

  const why =
    reason ??
    (cause === "term-ended"
      ? `Term ended — last day ${formatLongDate(new Date(lastDayOf(candidate)))}`
      : candidate.removal?.reason);
  const done = await offboardWorkspaceAccount(candidate.id, why);
  if (!done) return false;

  const at = new Date().toISOString();
  await updateCandidate(candidate.id, (c) =>
    c.workspace ? { ...c, workspace: { ...c.workspace, offboarded: { at, cause } } } : c,
  );
  return true;
}

/** Undoes offboardFromWorkspace: active again in the Workspace, and the record says so. */
export async function restoreInWorkspace(candidate: Candidate): Promise<boolean> {
  if (!candidate.workspace) return false;
  if (!(await restoreWorkspaceAccount(candidate.id))) return false;

  await updateCandidate(candidate.id, (c) =>
    c.workspace ? { ...c, workspace: { ...c.workspace, offboarded: undefined } } : c,
  );
  return true;
}

export interface LeaverSweep {
  offboarded: { id: string; name: string; cause: "term-ended" | "removed" }[];
  failed: { id: string; name: string; email: string; error: string }[];
}

/**
 * Everyone whose last day is over, or who was removed, and who is still an
 * active employee in the Workspace, is made a former employee there and
 * signed out everywhere. Run daily just after midnight in India by the cron
 * route, and on every "Sync everyone to the Workspace".
 *
 * Safe to run any number of times: anyone already offboarded is skipped, and
 * a failure is recorded nowhere, so the next run tries them again.
 */
export async function offboardLeavers(now = new Date()): Promise<LeaverSweep> {
  const result: LeaverSweep = { offboarded: [], failed: [] };
  if (!workspaceConfigured()) return result;

  for (const candidate of await listCandidates()) {
    if (!candidate.workspace?.loginId || candidate.workspace.offboarded) continue;
    const cause = leavingCause(candidate, now);
    if (!cause) continue;

    const name = candidate.details?.fullName ?? candidate.invitedName;
    try {
      if (await offboardFromWorkspace(candidate, cause)) {
        result.offboarded.push({ id: candidate.id, name, cause });
      }
    } catch (failure) {
      console.error("Workspace offboarding failed for", candidate.id, failure);
      result.failed.push({
        id: candidate.id,
        name,
        email: candidate.mailbox?.address ?? candidate.invitedEmail,
        error: describeWorkspaceFailure(failure).message,
      });
    }
  }
  return result;
}
