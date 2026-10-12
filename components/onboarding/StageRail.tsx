"use client";

import { Check } from "lucide-react";
import type { Stage } from "@/lib/onboarding/types";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/onboarding/types";

/** Horizontal progress rail. Scrolls inside itself on narrow screens. */
export default function StageRail({ stage }: { stage: Stage }) {
  const current = STAGE_ORDER.indexOf(stage);
  // "complete" is an end state rather than a step of its own.
  const steps = STAGE_ORDER.filter((s) => s !== "complete");

  return (
    <nav aria-label="Onboarding progress" className="-mx-4 overflow-x-auto px-4 no-scrollbar">
      <ol className="flex w-max items-center gap-2">
        {steps.map((step, index) => {
          const position = STAGE_ORDER.indexOf(step);
          const done = position < current;
          const active = position === current;

          return (
            <li key={step} className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 rounded-full px-3 py-2"
                style={{
                  backgroundColor: active
                    ? "var(--brand)"
                    : done
                      ? "var(--brand-soft)"
                      : "var(--surface)",
                  color: active ? "var(--surface-sunken)" : done ? "var(--brand-soft-fg)" : "var(--fg-muted)",
                  border: active ? "1px solid var(--brand)" : "1px solid var(--line)",
                }}
                aria-current={active ? "step" : undefined}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black">
                  {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : index + 1}
                </span>
                <span className="text-xs font-bold whitespace-nowrap">{STAGE_LABEL[step]}</span>
              </div>
              {index < steps.length - 1 && (
                <span className="h-px w-4 shrink-0" style={{ backgroundColor: "var(--line)" }} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
