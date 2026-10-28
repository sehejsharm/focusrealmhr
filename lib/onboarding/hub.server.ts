import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The single Focus Realm website. SERVER ONLY.
 *
 * The Workspace is the front door: everyone signs in there, and the HR console
 * is served on the same address under /hr (the Workspace routes those paths
 * here). A founder reaches the console from the Workspace's app switcher,
 * which sends them to /hr/admin?launch=<ticket>. The ticket is signed by the
 * Workspace with FOCUS_REALM_HUB_SECRET and lives two minutes.
 *
 *   FOCUS_REALM_HUB_URL     the website's address, e.g. https://employee-management.vercel.app
 *   FOCUS_REALM_HUB_SECRET  shared with the Workspace (and the CRM)
 *
 * Ticket: base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, that first part)).
 * Payload: { v: 1, app: "hr", sub: "FR-0001", name, role: "FOUNDER", iat, exp } — seconds.
 */

const MAX_TICKET_SECONDS = 120;

export function hubUrl(): string | null {
  const url = process.env.FOCUS_REALM_HUB_URL?.replace(/\/$/, "");
  return url && process.env.FOCUS_REALM_HUB_SECRET ? url : null;
}

export interface Launch {
  employeeCode: string;
  name: string;
}

/** The founder a launch ticket names, or null if it is not a valid, current HR ticket for a founder. */
export function verifyLaunch(ticket: string | null | undefined): Launch | null {
  const secret = process.env.FOCUS_REALM_HUB_SECRET;
  if (!secret || !ticket) return null;

  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let payload: { v?: number; app?: string; sub?: string; name?: string; role?: string; iat?: number; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.v !== 1 || payload.app !== "hr" || payload.role !== "FOUNDER") return null;
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") return null;
  if (payload.exp <= now || payload.iat > now + 30 || payload.exp - payload.iat > MAX_TICKET_SECONDS) return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;

  return { employeeCode: payload.sub, name: payload.name ?? payload.sub };
}
