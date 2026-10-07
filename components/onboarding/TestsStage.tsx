"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { ClientTest } from "@/lib/onboarding/tests.server";
import type { CandidateView, TestAttempt } from "@/lib/onboarding/types";
import { assessmentsPassedPhrase, testIdsFor } from "@/lib/onboarding/content";
import { Button, Card, Notice, SectionTitle, formatDateTime } from "./ui";

const TEST_META: Record<string, { title: string; subtitle: string }> = {
  "test-focus-realm": {
    title: "Focus Realm assessment",
    subtitle: "Company, products, and the language rules",
  },
  "test-recharga": {
    title: "Recharga Chargine assessment",
    subtitle: "Company, RADAX, and the business model",
  },
};

const PASS_MARK = 75;

interface SubmitResult {
  attempt: TestAttempt;
  passMark: number;
  missedReferences: string[];
  candidate: CandidateView;
}

/**
 * Step three: one assessment per company the candidate is onboarding into,
 * each passed on its own at 75%. Answers are scored on the server, so the key
 * never reaches the browser.
 */
export default function TestsStage({
  token,
  candidate,
  onSaved,
  locked,
}: {
  token: string;
  candidate: CandidateView;
  onSaved: (next: CandidateView) => void;
  locked: boolean;
}) {
  const [openTest, setOpenTest] = useState<ClientTest | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function openRunner(testId: string) {
    setLoading(testId);
    const response = await fetch(`/api/onboarding/session/${token}/test/${testId}`);
    setLoading(null);
    if (response.ok) setOpenTest((await response.json()) as ClientTest);
  }

  if (openTest) {
    return (
      <TestRunner
        token={token}
        test={openTest}
        onClose={() => setOpenTest(null)}
        onSaved={onSaved}
      />
    );
  }

  const testIds = testIdsFor(candidate.companies);
  const single = testIds.length === 1;
  const passedCount = testIds.filter((id) =>
    (candidate.tests[id] ?? []).some((a) => a.passed),
  ).length;

  return (
    <Card>
      <SectionTitle
        eyebrow={`Step 3 of 6 · ${passedCount} of ${testIds.length} passed`}
        title={single ? "Assessment" : "Assessments"}
        lead={
          single
            ? `Twelve questions, drawn from the handbook. You need ${PASS_MARK}% — nine of twelve. Retakes are unlimited, and a failed attempt tells you which sections to reread.`
            : `Twelve questions each, drawn from the handbooks. You need ${PASS_MARK}% on each one separately — nine of twelve. Retakes are unlimited, and a failed attempt tells you which sections to reread.`
        }
      />

      {locked && (
        <div className="mb-5">
          <Notice tone="warn">
            {single
              ? "Mark your handbook and video as done first — the assessment opens straight after."
              : "Mark both handbooks and both videos as done first — the assessments open straight after."}
          </Notice>
        </div>
      )}

      <ul className="space-y-3">
        {testIds.map((testId) => {
          const attempts = candidate.tests[testId] ?? [];
          const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
          const passed = attempts.some((a) => a.passed);
          const meta = TEST_META[testId];

          return (
            <li
              key={testId}
              className="rounded-xl border p-4"
              style={{
                borderColor: passed ? "rgba(201,162,39,0.45)" : "var(--fr-line)",
                backgroundColor: "var(--fr-navy-deep)",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base leading-snug font-bold text-balance">{meta.title}</h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--fr-muted)" }}>
                    {meta.subtitle}
                  </p>

                  {attempts.length > 0 && (
                    <p className="mt-2 text-xs" style={{ color: "var(--fr-muted)" }}>
                      {attempts.length} attempt{attempts.length === 1 ? "" : "s"} · best {best}% ·
                      last {formatDateTime(attempts[attempts.length - 1].at)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {passed && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black"
                      style={{ backgroundColor: "var(--fr-gold)", color: "var(--fr-navy-deep)" }}
                    >
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      Passed {best}%
                    </span>
                  )}
                  <Button
                    variant={passed ? "ghost" : "primary"}
                    disabled={locked || loading === testId}
                    onClick={() => openRunner(testId)}
                  >
                    {loading === testId
                      ? "Loading…"
                      : passed
                        ? "Review"
                        : attempts.length
                          ? "Retake"
                          : "Start"}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TestRunner({
  token,
  test,
  onClose,
  onSaved,
}: {
  token: string;
  test: ClientTest;
  onClose: () => void;
  onSaved: (next: CandidateView) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const answered = Object.keys(answers).length;

  async function submit() {
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/onboarding/session/${token}/test/${test.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not submit.");
      return;
    }

    setResult(data as SubmitResult);
    onSaved((data as SubmitResult).candidate);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) {
    const { attempt, missedReferences } = result;
    return (
      <Card>
        <SectionTitle
          eyebrow={attempt.passed ? "Passed" : "Not passed"}
          title={`${attempt.score}% — ${attempt.correct} of ${attempt.total} correct`}
          lead={
            attempt.passed
              ? `That clears the bar. Your internship agreement is prepared once ${assessmentsPassedPhrase(result.candidate.companies.length)}.`
              : `You need ${result.passMark}% to pass. Reread the sections below and take it again — there is no limit on attempts.`
          }
        />

        {!attempt.passed && missedReferences.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-sm font-bold">Go back over:</p>
            <ul className="space-y-1.5">
              {missedReferences.map((reference) => (
                <li key={reference} className="flex items-start gap-2 text-sm" style={{ color: "var(--fr-muted)" }}>
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--fr-gold)" }}
                    aria-hidden
                  />
                  {reference}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!attempt.passed && (
            <Button
              onClick={() => {
                setAnswers({});
                setResult(null);
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              Take it again
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Back to assessments
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        eyebrow={`${answered} of ${test.questions.length} answered`}
        title={test.title}
        lead={`${test.subtitle}. Pass mark ${test.passMark}%.`}
      />

      <ol className="space-y-6">
        {test.questions.map((question, index) => (
          <li key={question.id}>
            <p className="mb-3 text-sm leading-snug font-bold text-pretty">
              <span style={{ color: "var(--fr-gold)" }}>{index + 1}.</span> {question.prompt}
            </p>
            <div className="space-y-2">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3"
                    style={{
                      borderColor: selected ? "var(--fr-gold)" : "var(--fr-line)",
                      backgroundColor: selected ? "rgba(201,162,39,0.12)" : "var(--fr-navy-deep)",
                    }}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={selected}
                      onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                      className="mt-1 size-4 shrink-0 accent-[var(--fr-gold)]"
                    />
                    <span className="text-sm leading-snug text-pretty">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {message && (
        <div className="mt-5">
          <Notice tone="bad">{message}</Notice>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button disabled={busy || answered < test.questions.length} onClick={submit}>
          {busy ? "Submitting…" : "Submit answers"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
