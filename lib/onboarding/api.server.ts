import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "./security.server";
import { getCandidateByToken } from "./store.server";
import type { Candidate } from "./types";

/** Shared plumbing for the onboarding route handlers. SERVER ONLY. */

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    // Candidate records are per-token and change as they progress.
    headers: { "cache-control": "no-store" },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
}

/** 404 rather than 403 for a bad token — don't confirm which tokens exist. */
export async function resolveCandidate(token: string): Promise<Candidate | null> {
  return getCandidateByToken(token);
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

export function requiredString(value: FormDataEntryValue | null, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}
