"use client";

import { useState } from "react";
import { BookOpen, Check, ExternalLink, PlayCircle } from "lucide-react";
import { resourcesFor } from "@/lib/onboarding/content";
import type { CandidateView } from "@/lib/onboarding/types";
import { Button, Card, Notice, SectionTitle } from "./ui";

/**
 * Step two: the handbook and video briefing for each company the candidate is
 * onboarding into. Handbooks open through a token-gated route — they are
 * internal documents, not public files.
 */
export default function LearningStage({
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
  const [busy, setBusy] = useState<string | null>(null);
  const resources = resourcesFor(candidate.companies);
  const single = candidate.companies.length === 1;
  const done = resources.filter((r) => candidate.resources[r.id]).length;

  async function markDone(resourceId: string) {
    setBusy(resourceId);
    const response = await fetch(`/api/onboarding/session/${token}/resource/${resourceId}`, {
      method: "POST",
    });
    setBusy(null);
    if (response.ok) onSaved((await response.json()) as CandidateView);
  }

  return (
    <Card>
      <SectionTitle
        eyebrow={`Step 2 of 6 · ${done} of ${resources.length} done`}
        title={single ? "Handbook and video" : "Handbooks and videos"}
        lead={
          single
            ? "Read the handbook end to end and watch the briefing. The assessment comes straight out of them, and it unlocks once both are marked done."
            : "Read both handbooks end to end and watch both briefings. The assessments come straight out of them, and they unlock once all four are marked done."
        }
      />

      {locked && (
        <div className="mb-5">
          <Notice tone="warn">Submit your details first — this opens straight after.</Notice>
        </div>
      )}

      <ul className="space-y-3">
        {resources.map((resource) => {
          const completedAt = candidate.resources[resource.id];
          const isHandbook = resource.kind === "handbook";
          const href = isHandbook
            ? `/api/onboarding/session/${token}/resource/${resource.id}`
            : resource.url;

          return (
            <li
              key={resource.id}
              className="rounded-xl border p-4"
              style={{
                borderColor: completedAt ? "rgba(201,162,39,0.45)" : "var(--fr-line)",
                backgroundColor: "var(--fr-navy-deep)",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: completedAt ? "var(--fr-gold)" : "var(--fr-navy-soft)",
                    color: completedAt ? "var(--fr-navy-deep)" : "var(--fr-gold)",
                  }}
                  aria-hidden
                >
                  {completedAt ? (
                    <Check className="size-5" strokeWidth={3} />
                  ) : isHandbook ? (
                    <BookOpen className="size-5" />
                  ) : (
                    <PlayCircle className="size-5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fr-muted)" }}>
                    {resource.subtitle} · {resource.meta}
                  </p>
                  <h3 className="mt-0.5 text-base leading-snug font-bold text-balance">
                    {resource.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-pretty" style={{ color: "var(--fr-muted)" }}>
                    {resource.summary}
                  </p>

                  {resource.linkPending && (
                    <p className="mt-2 text-xs" style={{ color: "var(--fr-gold-soft)" }}>
                      Opens the shared Drive folder — pick this briefing from inside it.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a
                      href={locked ? undefined : href}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={locked}
                      className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold ${
                        locked ? "pointer-events-none opacity-45" : ""
                      }`}
                      style={{
                        backgroundColor: "var(--fr-navy-soft)",
                        border: "1px solid var(--fr-line)",
                        color: "var(--fr-paper)",
                      }}
                    >
                      {isHandbook ? "Open handbook" : "Watch briefing"}
                      <ExternalLink className="size-4" aria-hidden />
                    </a>

                    {completedAt ? (
                      <span className="text-xs font-bold" style={{ color: "var(--fr-gold-soft)" }}>
                        Marked done
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={locked || busy === resource.id}
                        onClick={() => markDone(resource.id)}
                      >
                        {busy === resource.id ? "Saving…" : "Mark as done"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
