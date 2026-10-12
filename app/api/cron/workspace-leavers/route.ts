import { timingSafeEqual } from "node:crypto";
import { error, json } from "@/lib/onboarding/api.server";
import { offboardLeavers, workspaceConfigured } from "@/lib/onboarding/workspace.server";

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set. */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Runs daily at 00:35 in India (19:05 UTC, vercel.json; on the Hobby plan Vercel may fire any time in that hour, still after midnight there). Everyone whose last
 * day has just ended — or who was removed while the Workspace was down — is
 * made a former employee in the Workspace and signed out everywhere.
 * Idempotent: run it as often as you like.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return error("Not authorised.", 401);
  if (!workspaceConfigured()) return json({ ok: true, skipped: "The Workspace is not connected." });

  const result = await offboardLeavers();
  if (result.failed.length > 0) console.error("Workspace offboarding failures", result.failed);
  return json({ ok: result.failed.length === 0, ...result, at: new Date().toISOString() });
}
