import { error, json } from "@/lib/onboarding/api.server";
import { getCandidateByToken, updateCandidate } from "@/lib/onboarding/store.server";
import { getTest, scoreTest, toClientTest } from "@/lib/onboarding/tests.server";
import { learningComplete, requiredTestIds } from "@/lib/onboarding/stage";
import { toCandidateView } from "@/lib/onboarding/view";
import type { TestAttempt } from "@/lib/onboarding/types";

/** Serves the questions without the answer key. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; testId: string }> },
) {
  const { token, testId } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  // Added directly as an existing employee: there is no onboarding to do.
  if (candidate.existing) return error("There are no onboarding steps on this record.", 409);

  // A test outside the candidate's chosen companies is treated as not existing.
  const test = requiredTestIds(candidate).includes(testId) ? getTest(testId) : undefined;
  if (!test) return error("Not found.", 404);

  return json(toClientTest(test));
}

/** Scores an attempt server-side — the browser never sees the answer key. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; testId: string }> },
) {
  const { token, testId } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  // Added directly as an existing employee: there is no onboarding to do.
  if (candidate.existing) return error("There are no onboarding steps on this record.", 409);
  const test = requiredTestIds(candidate).includes(testId) ? getTest(testId) : undefined;
  if (!test) return error("Not found.", 404);

  if (!learningComplete(candidate)) {
    return error("Work through your handbooks and videos first.", 409);
  }

  const body = (await request.json().catch(() => null)) as { answers?: Record<string, string> } | null;
  const answers = body?.answers;
  if (!answers || typeof answers !== "object") return error("No answers submitted.");

  const unanswered = test.questions.filter((q) => !answers[q.id]);
  if (unanswered.length > 0) {
    return error(`${unanswered.length} question${unanswered.length === 1 ? "" : "s"} still unanswered.`);
  }

  const result = scoreTest(test, answers);
  const previous = candidate.tests[testId] ?? [];
  const attempt: TestAttempt = {
    attempt: previous.length + 1,
    score: result.score,
    correct: result.correct,
    total: result.total,
    passed: result.passed,
    at: new Date().toISOString(),
  };

  const updated = await updateCandidate(candidate.id, (c) => ({
    ...c,
    tests: { ...c.tests, [testId]: [...(c.tests[testId] ?? []), attempt] },
  }));
  if (!updated) return error("Could not record your attempt.", 500);

  return json({
    attempt,
    passMark: test.passMark,
    // Only revealed on a failure, so a wrong run is still a teaching moment.
    missedReferences: result.passed ? [] : result.missedReferences,
    candidate: toCandidateView(updated),
  });
}
