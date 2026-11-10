import { randomBytes } from "node:crypto";
import { error, json } from "@/lib/onboarding/api.server";
import { getCandidateByToken, updateCandidate } from "@/lib/onboarding/store.server";
import { currentStage } from "@/lib/onboarding/stage";
import { toCandidateView } from "@/lib/onboarding/view";

const MAX_OPEN = 20;

/**
 * An intern asks for a change to their agreement before signing — about one
 * clause or the whole. The founders see it on the intern's record, may edit the
 * agreement, and answer it; the intern sees the answer here.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  if (candidate.existing) return error("There are no onboarding steps on this record.", 409);
  if (candidate.signature) return error("You have already signed. Ask the founders directly for any change.", 409);
  if (currentStage(candidate) !== "contract") return error("Your agreement isn't open for comments yet.", 409);

  const body = (await request.json().catch(() => null)) as { text?: string; clause?: string } | null;
  const text = body?.text?.trim();
  if (!text) return error("Write the change you'd like.");
  if (text.length > 2000) return error("Keep it under 2,000 characters.");
  const clause = body?.clause?.trim().slice(0, 200) || undefined;

  if ((candidate.contractSuggestions ?? []).filter((s) => s.status === "open").length >= MAX_OPEN) {
    return error("You have many suggestions waiting already. Wait for the founders to answer them.", 409);
  }

  const updated = await updateCandidate(candidate.id, (c) => ({
    ...c,
    contractSuggestions: [
      ...(c.contractSuggestions ?? []),
      { id: randomBytes(8).toString("hex"), clause, text, at: new Date().toISOString(), status: "open" as const },
    ],
  }));
  if (!updated) return error("Could not save your suggestion.", 500);
  return json(toCandidateView(updated));
}
