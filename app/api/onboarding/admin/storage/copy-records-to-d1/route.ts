import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { copyRecordsToD1 } from "@/lib/onboarding/store.server";

export const maxDuration = 300;

/**
 * Founders only. Copies every candidate record from Supabase to Cloudflare D1
 * and verifies each copy. Deletes nothing; safe to repeat.
 */
export async function POST() {
  if (!(await isAdmin())) return error("Not authorised.", 401);
  try {
    return json(await copyRecordsToD1());
  } catch (cause) {
    console.error("Copy records to D1 failed", cause);
    return error(cause instanceof Error ? cause.message : "Could not copy the records.", 500);
  }
}
