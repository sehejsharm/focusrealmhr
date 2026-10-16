import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { copyUploadsToR2 } from "@/lib/onboarding/store.server";

// Each batch downloads and uploads files; give it room.
export const maxDuration = 300;

/**
 * Founders only. Copies the older uploaded files (Aadhaar copies, agreements)
 * from the Supabase bucket to R2, one batch per call. The console calls it
 * again until nothing remains. Safe to repeat; it never deletes anything.
 */
export async function POST() {
  if (!(await isAdmin())) return error("Not authorised.", 401);
  try {
    return json(await copyUploadsToR2());
  } catch (cause) {
    console.error("Copy to R2 failed", cause);
    return error(cause instanceof Error ? cause.message : "Could not copy the files.", 500);
  }
}
