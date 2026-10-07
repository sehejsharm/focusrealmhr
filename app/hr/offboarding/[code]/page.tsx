"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Award, CalendarClock, Check, Download, Hourglass, Send } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Notice,
  SectionTitle,
  Wordmark,
  formatDate,
  inputClass,
  inputStyle,
} from "@/components/onboarding/ui";
import { CERTIFICATE_LABEL } from "@/lib/onboarding/certificates";
import type { ExitQuestion, OffboardingDocument } from "@/lib/onboarding/offboarding";

interface OffboardingView {
  name: string;
  roleTitle: string;
  startDate: string;
  lastDay: string;
  opensAt: string;
  status: "not-yet" | "open" | "done";
  submittedAt: string | null;
  questions: ExitQuestion[];
  documents: OffboardingDocument[];
}

/**
 * An intern's way out: a few exit questions, then the documents the founders
 * approved. Reached only through the personal link the founders send.
 */
export default function OffboardingPage() {
  const { code } = useParams<{ code: string }>();
  const [view, setView] = useState<OffboardingView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/onboarding/offboarding/${code}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState("invalid");
          return;
        }
        setView((await response.json()) as OffboardingView);
        setState("ready");
      })
      .catch(() => !cancelled && setState("invalid"));
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state === "loading") {
    return (
      <Shell>
        <p style={{ color: "var(--fr-muted)" }}>Loading…</p>
      </Shell>
    );
  }

  if (state === "invalid" || !view) {
    return (
      <Shell>
        <Card>
          <SectionTitle
            title="This offboarding link is not valid"
            lead="Check that you copied the whole link from the message the founders sent. If it still does not work, reply to that message and they will sort it out."
          />
        </Card>
      </Shell>
    );
  }

  const first = view.name.trim().split(/\s+/)[0];

  return (
    <Shell>
      <header className="mb-6">
        <h1 className="text-2xl leading-tight font-bold text-balance sm:text-3xl">
          {view.status === "done" ? `Thank you, ${first}.` : `Offboarding, ${first}`}
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fr-muted)" }}>
          {view.roleTitle} · {formatDate(view.startDate)} → {formatDate(view.lastDay)}
        </p>
      </header>

      {view.status === "not-yet" && (
        <Card>
          <div className="flex items-start gap-4">
            <CalendarClock className="size-7 shrink-0" style={{ color: "var(--fr-gold)" }} aria-hidden />
            <div>
              <h2 className="text-lg font-bold">Your offboarding opens on {formatDate(view.opensAt)}</h2>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--fr-muted)" }}>
                That is the day after your last day. Keep this link and come back to it then: you
                will answer a few short questions about your internship, and then download your
                documents.
              </p>
            </div>
          </div>
        </Card>
      )}

      {view.status === "open" && (
        <ExitForm code={code} questions={view.questions} onDone={setView} />
      )}

      {view.status === "done" && <Documents code={code} documents={view.documents} />}

      <footer className="mt-10 border-t pt-6 fr-rule">
        <Notice>
          Anything not right? Reply to the message this link came in — Ali or Sehej will sort it out.
        </Notice>
      </footer>
    </Shell>
  );
}

function ExitForm({
  code,
  questions,
  onDone,
}: {
  code: string;
  questions: ExitQuestion[];
  onDone: (view: OffboardingView) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const complete = questions.every((q) => !q.required || answers[q.id]?.trim());
  const set = (id: string, value: string) => setAnswers((current) => ({ ...current, [id]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/onboarding/offboarding/${code}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setBusy(false);

    if (!response?.ok) {
      setMessage(data.error ?? "Could not send your answers. Try again.");
      return;
    }
    onDone(data as OffboardingView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Card>
      <SectionTitle
        eyebrow={`${questions.length} questions`}
        title="Before you go"
        lead="A few questions about your time with us. Your answers go to the founders only, and they are how the next intern gets a better internship. Your documents are on the next screen."
      />

      <form onSubmit={submit} className="space-y-6">
        {questions.map((question, index) => (
          <fieldset key={question.id} className="space-y-2">
            {question.kind === "text" ? (
              <Field label={`${index + 1}. ${question.label}`} hint={question.hint}>
                <textarea
                  value={answers[question.id] ?? ""}
                  onChange={(e) => set(question.id, e.target.value)}
                  rows={4}
                  maxLength={question.maxLength}
                  required={question.required}
                  className={`${inputClass} resize-y`}
                  style={inputStyle}
                />
              </Field>
            ) : (
              <>
                <legend className="text-sm font-bold">
                  {index + 1}. {question.label}
                </legend>
                {question.hint && (
                  <p className="text-xs" style={{ color: "var(--fr-muted)" }}>
                    {question.hint}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {question.options?.map((option) => {
                    const chosen = answers[question.id] === option;
                    return (
                      <label
                        key={option}
                        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-4 text-sm font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--fr-gold-soft)]"
                        style={{
                          backgroundColor: chosen ? "var(--fr-gold)" : "var(--fr-navy-deep)",
                          color: chosen ? "var(--fr-navy-deep)" : "var(--fr-paper)",
                          borderColor: chosen ? "var(--fr-gold)" : "var(--fr-line)",
                        }}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={chosen}
                          onChange={() => set(question.id, option)}
                          className="sr-only"
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </fieldset>
        ))}

        {message && <Notice tone="bad">{message}</Notice>}

        <Button type="submit" disabled={!complete || busy}>
          <Send className="size-4" aria-hidden />
          {busy ? "Sending…" : "Send and get my documents"}
        </Button>
      </form>
    </Card>
  );
}

function Documents({ code, documents }: { code: string; documents: OffboardingDocument[] }) {
  const pending = documents.some((d) => !d.ready);

  return (
    <Card>
      <SectionTitle
        title="Your documents"
        lead={
          documents.length === 0
            ? "Your offboarding is complete. The founders have not set any documents for you here — reply to their message if you expected one."
            : "Download and keep these. This link keeps working, so you can come back for them."
        }
      />

      <ul className="space-y-3">
        {documents.map((doc) => (
          <li
            key={doc.kind}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
          >
            <div className="flex min-w-0 items-start gap-3">
              {doc.ready ? (
                <Award className="mt-0.5 size-5 shrink-0" style={{ color: "var(--fr-gold)" }} aria-hidden />
              ) : (
                <Hourglass className="mt-0.5 size-5 shrink-0" style={{ color: "var(--fr-muted)" }} aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold">{CERTIFICATE_LABEL[doc.kind]}</p>
                <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--fr-muted)" }}>
                  {doc.ready && doc.issuedAt
                    ? `Issued ${formatDate(doc.issuedAt)} · ${doc.serial}`
                    : "Being finalised by the founders — come back to this link shortly."}
                </p>
              </div>
            </div>
            {doc.ready && (
              <a
                href={`/api/onboarding/offboarding/${code}/certificates/${doc.kind}/pdf`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold"
                style={{ backgroundColor: "var(--fr-gold)", color: "var(--fr-navy-deep)" }}
              >
                <Download className="size-4" aria-hidden />
                Download PDF
              </a>
            )}
          </li>
        ))}
      </ul>

      {!pending && documents.length > 0 && (
        <p className="mt-5 flex items-center gap-2 text-sm" style={{ color: "var(--fr-gold-soft)" }}>
          <Check className="size-4" aria-hidden />
          All done. Thank you for your time at Focus Realm — and good luck with what comes next.
        </p>
      )}
    </Card>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8">
        <Wordmark subtitle="Offboarding" href="/hr" />
      </div>
      {children}
    </div>
  );
}
