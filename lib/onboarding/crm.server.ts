import {
  crmConfigured,
  isSalesRole,
  offboardCrmAccount,
  provisionCrmAccount,
  restoreCrmAccount,
  updateCrmAccount,
  type CrmCandidate,
  type CrmCredentials,
} from "./crm-sync.server";
import { consentCoversCrm } from "./compliance";
import { formatLongDate } from "./contract";
import { lastDayOf } from "./offboarding";
import { seal, unseal } from "./security.server";
import { listCandidates, updateCandidate } from "./store.server";
import { trackOf, type Candidate, type CrmLogin } from "./types";
import { lastDayOver, workspaceConfigured } from "./workspace.server";

/**
 * The HR console's side of the Focus Realm Sales CRM connection. SERVER ONLY.
 *
 * The CRM twin of workspace.server.ts. crm-sync.server.ts is the CRM's own
 * client, copied verbatim from the CRM repository; this file decides who gets
 * a CRM login (sales people only), records what comes back on the candidate,
 * and seals the temporary password exactly like the Workspace and mailbox
 * ones — encrypted at rest, shown once, then destroyed.
 *
 * With FOCUS_REALM_CRM_URL or FOCUS_REALM_CRM_SECRET unset, nothing is sent and
 * everything here is a no-op. A CRM call never blocks or fails an HR action.
 */

export { crmConfigured };

/**
 * Exactly what of a sales person may leave for the CRM: the same as for the
 * Workspace. Never the Aadhaar number or copy, the address, the parent's name,
 * the agreement or assessment results — and the phone number only for someone
 * who consented under a privacy notice that covers the CRM.
 */
function forCrm(candidate: Candidate): CrmCandidate {
  const { details } = candidate;
  const track = trackOf(candidate);

  return {
    id: candidate.id,
    invitedName: candidate.invitedName,
    invitedEmail: candidate.invitedEmail,
    startDate: candidate.startDate,
    mailbox: candidate.mailbox ? { address: candidate.mailbox.address } : null,
    role: { id: track.id, label: track.label, roleTitle: track.roleTitle },
    workspaceLoginId: candidate.workspace?.loginId ?? null,
    // Never crmAccess: only the sales department gets a CRM login, so there is
    // no per-person override to send.
    details: details
      ? {
          fullName: details.fullName,
          ...(consentCoversCrm(details.consent) ? { phone: details.phone } : {}),
        }
      : null,
  };
}

/**
 * Whether they should have a CRM login. ONLY the sales department does —
 * Business Development or another sales role. Never Marketing, the Founder's
 * Office or any other department, and there is deliberately no override.
 */
export function wantsCrm(candidate: Candidate): boolean {
  return isSalesRole(forCrm(candidate));
}

/**
 * While the Workspace is connected, the CRM login waits for the Workspace one,
 * so both use the same employee ID. Without it the CRM would issue its own
 * (FRS-0001…) and the person would have two.
 */
export function crmWaitsForWorkspace(candidate: Candidate): boolean {
  return workspaceConfigured() && !candidate.workspace?.loginId;
}

/** Where people sign in to the CRM, or null while the connection is off. */
export function crmLoginUrl(): string | null {
  const url = process.env.FOCUS_REALM_CRM_URL?.replace(/\/$/, "");
  return url && process.env.FOCUS_REALM_CRM_SECRET ? `${url}/login` : null;
}

/** Same wording rules as describeWorkspaceFailure: "CRM rejected …" (4xx) / "CRM error …" (5xx). */
export function describeCrmFailure(cause: unknown): { message: string; answered: boolean } {
  if (cause instanceof Error && /^CRM (rejected|error)\b/.test(cause.message)) {
    return { message: cause.message, answered: true };
  }
  return { message: "The CRM could not be reached.", answered: false };
}

/**
 * Records a login the CRM handed back. A new temporary password is sealed
 * before it reaches storage; a reply without one never wipes a password still
 * waiting to be collected.
 */
export async function recordCrmLogin(id: string, login: CrmCredentials): Promise<Candidate | null> {
  const sealedPassword = login.temporaryPassword ? seal(login.temporaryPassword) : undefined;
  const now = new Date().toISOString();

  return updateCandidate(id, (c) => {
    const kept = c.crm?.loginId === login.loginId ? c.crm : undefined;
    return {
      ...c,
      crm: {
        loginId: login.loginId,
        provisionedAt: kept?.provisionedAt ?? now,
        crmRole: login.crmRole ?? kept?.crmRole,
        viewedAt: sealedPassword ? undefined : kept?.viewedAt,
        sealedPassword: sealedPassword ?? kept?.sealedPassword,
        offboarded: kept?.offboarded,
      },
    };
  });
}

/**
 * Creates a sales person's CRM login and records it. Run again, it gets back
 * the same login: the event id comes from the candidate id.
 *
 * Null when they are not in sales, the connection is off, or their Workspace
 * login does not exist yet (crmWaitsForWorkspace). Throws when the CRM refuses,
 * cannot be reached — or skips someone this console counts as sales, which
 * means the CRM's own department list (Settings → HR console) leaves them out.
 */
export async function linkCrmAccount(candidate: Candidate): Promise<{ loginId: string } | null> {
  if (!crmConfigured() || !wantsCrm(candidate) || crmWaitsForWorkspace(candidate)) return null;

  const login = await provisionCrmAccount(forCrm(candidate));
  if (!login) {
    throw new Error(
      `CRM rejected employee.created: it skipped ${trackOf(candidate).label} — add that department in the CRM's Settings → HR console.`,
    );
  }
  await recordCrmLogin(candidate.id, login);
  return { loginId: login.loginId };
}

/**
 * Sends their current name, email, role and phone. Someone now in sales without
 * a login gets one (recorded, with its password); someone who left sales has
 * theirs switched off by the CRM, which keeps their history. Removed people
 * are left alone — removal already switched their login off.
 */
export async function refreshCrmAccount(candidate: Candidate): Promise<void> {
  if (!crmConfigured() || candidate.removal) return;

  const wants = wantsCrm(candidate);
  const active = candidate.crm && !candidate.crm.offboarded;
  const leftSales = candidate.crm?.offboarded?.cause === "left-sales";

  if (wants) {
    if (crmWaitsForWorkspace(candidate)) return;
    if (candidate.crm && !active && !leftSales) return; // switched off for leaving, not for the role
    const login = await updateCrmAccount(forCrm(candidate), { hadCrmLogin: Boolean(candidate.crm) });
    if (!login) return;
    await recordCrmLogin(candidate.id, login);
    // Back in sales: the CRM switched them on again.
    if (leftSales) await markCrm(candidate.id, undefined);
    return;
  }

  if (active) {
    // Moved out of sales: the CRM switches the login off on this update.
    await updateCrmAccount(forCrm(candidate), { hadCrmLogin: true });
    await markCrm(candidate.id, { at: new Date().toISOString(), cause: "left-sales" });
  }
}

async function markCrm(id: string, offboarded: CrmLogin["offboarded"]) {
  await updateCandidate(id, (c) => (c.crm ? { ...c, crm: { ...c.crm, offboarded } } : c));
}

/** One-time reveal, as claimWorkspacePassword: the claim is made inside the write. */
export async function claimCrmPassword(id: string): Promise<string | null> {
  const claim: { sealed?: string } = {};
  const viewedAt = new Date().toISOString();

  await updateCandidate(id, (c) => {
    claim.sealed = c.crm?.sealedPassword;
    if (!c.crm || !claim.sealed) return c;
    const { sealedPassword: _destroyed, ...rest } = c.crm;
    void _destroyed;
    return { ...c, crm: { ...rest, viewedAt } };
  });

  return claim.sealed ? unseal(claim.sealed) : null;
}

/**
 * Switches their CRM login off — signed out everywhere — and records that the
 * CRM confirmed it. Throws on failure; nothing is recorded then, so the next
 * nightly run or sync tries again.
 */
export async function offboardFromCrm(
  candidate: Candidate,
  cause: "term-ended" | "removed",
  reason?: string,
): Promise<boolean> {
  if (!candidate.crm || candidate.crm.offboarded) return false;

  const why =
    reason ??
    (cause === "term-ended"
      ? `Term ended — last day ${formatLongDate(new Date(lastDayOf(candidate)))}`
      : candidate.removal?.reason);
  if (!(await offboardCrmAccount(candidate.id, why))) return false;

  await markCrm(candidate.id, { at: new Date().toISOString(), cause });
  return true;
}

/** Undoes a removal in the CRM — only for someone still in sales. */
export async function restoreInCrm(candidate: Candidate): Promise<boolean> {
  const off = candidate.crm?.offboarded;
  if (!off || off.cause === "left-sales" || !wantsCrm(candidate)) return false;
  if (!(await restoreCrmAccount(candidate.id))) return false;

  await markCrm(candidate.id, undefined);
  return true;
}

export interface CrmLeaverSweep {
  offboarded: { id: string; name: string }[];
  failed: { id: string; name: string; email: string; error: string }[];
}

/**
 * The CRM half of the nightly leavers run: everyone whose last day is over, or
 * who was removed, and whose CRM login is still on, is switched off there.
 * Safe to run any number of times.
 */
export async function offboardCrmLeavers(now = new Date()): Promise<CrmLeaverSweep> {
  const result: CrmLeaverSweep = { offboarded: [], failed: [] };
  if (!crmConfigured()) return result;

  for (const candidate of await listCandidates()) {
    if (!candidate.crm || candidate.crm.offboarded) continue;
    const cause = candidate.removal ? "removed" : lastDayOver(candidate, now) ? "term-ended" : null;
    if (!cause) continue;

    const name = candidate.details?.fullName ?? candidate.invitedName;
    try {
      if (await offboardFromCrm(candidate, cause)) result.offboarded.push({ id: candidate.id, name });
    } catch (failure) {
      console.error("CRM offboarding failed for", candidate.id, failure);
      result.failed.push({
        id: candidate.id,
        name,
        email: candidate.mailbox?.address ?? candidate.invitedEmail,
        error: describeCrmFailure(failure).message,
      });
    }
  }
  return result;
}
