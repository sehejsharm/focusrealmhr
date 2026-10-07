import { clientIp, error, json } from "@/lib/onboarding/api.server";
import { updateCandidate } from "@/lib/onboarding/store.server";
import { recipientName } from "@/lib/onboarding/certificates";
import {
  EXIT_QUESTIONS,
  lastDayOf,
  offboardingDocuments,
  offboardingOpensAt,
  offboardingState,
  validateExitAnswers,
} from "@/lib/onboarding/offboarding";
import { resolveOffboarding } from "@/lib/onboarding/offboarding.server";
import { trackOf, type Candidate } from "@/lib/onboarding/types";

/** What the offboarding page needs — never the Aadhaar number or anything else sensitive. */
function view(candidate: Candidate) {
  const state = offboardingState(candidate);
  const done = state.status === "done";

  return {
    name: recipientName(candidate),
    roleTitle: trackOf(candidate).roleTitle,
    startDate: candidate.startDate,
    lastDay: lastDayOf(candidate),
    opensAt: offboardingOpensAt(candidate).toISOString(),
    status: done ? "done" : state.status === "open" ? "open" : "not-yet",
    submittedAt: candidate.offboarding?.submittedAt ?? null,
    questions: done ? [] : EXIT_QUESTIONS,
    // Documents only once the questions are answered.
    documents: done ? offboardingDocuments(candidate) : [],
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const candidate = await resolveOffboarding(code);
  if (!candidate) return error("This offboarding link is not valid.", 404);

  return json(view(candidate));
}

/** The exit questions. Answered once; after that the link leads to the documents. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const candidate = await resolveOffboarding(code);
  if (!candidate) return error("This offboarding link is not valid.", 404);

  const state = offboardingState(candidate);
  if (state.status === "done") return error("You have already completed offboarding.", 409);
  if (state.status !== "open") {
    return error("Offboarding opens the day after your last day. Come back to this link then.", 409);
  }

  const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
  const result = validateExitAnswers(body?.answers);
  if ("error" in result) return error(result.error);

  const submittedAt = new Date().toISOString();
  const updated = await updateCandidate(candidate.id, (c) =>
    // Re-checked on fresh state, so a double submit cannot overwrite answers.
    c.offboarding
      ? c
      : {
          ...c,
          offboarding: {
            submittedAt,
            answers: result.answers,
            ip: clientIp(request),
            userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
          },
        },
  );
  if (!updated) return error("Could not save your answers.", 500);

  return json(view(updated));
}
