import { error, isAdmin, json } from "@/lib/onboarding/api.server";
import { deleteSupabaseCopies } from "@/lib/onboarding/store.server";

export const maxDuration = 300;

/**
 * Founders only. Deletes files from the Supabase bucket that R2 already holds
 * at exactly the same size, one batch per call. Never deletes a file R2 lacks.
 */
export async function POST() {
  if (!(await isAdmin())) return error("Not authorised.", 401);
  try {
    return json(await deleteSupabaseCopies());
  } catch (cause) {
    console.error("Freeing Supabase space failed", cause);
    return error(cause instanceof Error ? cause.message : "Could not free the space.", 500);
  }
}
