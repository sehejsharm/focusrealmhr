import {
  provisionWorkspaceAccount,
  updateWorkspaceAccount,
  type WorkspaceCandidate,
  type WorkspaceCredentials,
} from "./workspace-sync.server";
import { consentCoversWorkspace } from "./compliance";
import { seal, unseal } from "./security.server";
import { updateCandidate } from "./store.server";
import { trackOf, type Candidate } from "./types";

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
      workspace: { loginId: c.workspace.loginId, provisionedAt: c.workspace.provisionedAt, viewedAt },
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
