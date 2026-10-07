"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Upload } from "lucide-react";
import {
  AADHAAR_SAFEGUARDS,
  CONSENT_ITEMS,
  DATA_FIDUCIARY,
  PURPOSES,
  RETENTION,
} from "@/lib/onboarding/compliance";
import type { CandidateView } from "@/lib/onboarding/types";
import { Button, Card, Field, Notice, SectionTitle, inputClass, inputStyle } from "./ui";

/**
 * Step one: the details the internship agreement is generated from. Nothing
 * else in the flow opens until this is submitted.
 */
export default function DetailsStage({
  token,
  candidate,
  onSaved,
}: {
  token: string;
  candidate: CandidateView;
  onSaved: (next: CandidateView) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (candidate.details) {
    const { details } = candidate;
    return (
      <Card>
        <SectionTitle
          eyebrow="Step 1 · Submitted"
          title="Your details are with us"
          lead="These are the details your internship agreement is drawn up from. If anything is wrong, tell your point of contact — they can send it back for correction."
        />
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Full name" value={details.fullName} />
          <Detail label="Son / daughter of" value={details.parentName} />
          <Detail label="Aadhaar number" value={`XXXX XXXX ${details.aadhaarLast4}`} />
          <Detail label="Phone" value={details.phone} />
          <Detail label="Email" value={details.personalEmail} />
          <Detail label="Aadhaar copy" value={details.aadhaarFile?.originalName ?? "—"} />
          <div className="sm:col-span-2">
            <Detail label="Address" value={details.address} />
          </div>
        </dl>

        {candidate.consent && (
          <div
            className="mt-6 rounded-xl border p-4"
            style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
          >
            <p className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fr-gold)" }}>
              Consent recorded
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
              You gave {candidate.consent.acceptedItems.length} consents on{" "}
              {new Date(candidate.consent.at).toLocaleString("en-IN")} against privacy
              notice version {candidate.consent.noticeVersion}. You can withdraw your
              consent, or ask for your data to be corrected or erased, at any time by
              writing to {DATA_FIDUCIARY.grievanceEmail} — see the{" "}
              <Link href="/hr/privacy" className="underline">
                privacy notice
              </Link>
              .
            </p>
          </div>
        )}
      </Card>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/onboarding/session/${token}/details`, {
      method: "POST",
      body: form,
    });
    const data = await response.json();

    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Something went wrong.");
      return;
    }
    onSaved(data as CandidateView);
  }

  return (
    <Card>
      <SectionTitle
        eyebrow="Step 1 of 6"
        title="Your details"
        lead="We need these to draw up your internship agreement. They go to the founders only, and are used for the contract and nothing else."
      />

      <div
        className="mb-6 rounded-xl border p-4 sm:p-5"
        style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
      >
        <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "var(--fr-gold)" }}>
          Before you fill this in
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fr-paper)" }}>
          {DATA_FIDUCIARY.name}, {DATA_FIDUCIARY.place}, is the data fiduciary for the
          personal data you are about to give. It is collected only for these purposes:
        </p>
        <ul className="mt-3 space-y-1.5">
          {PURPOSES.map((purpose) => (
            <li key={purpose} className="flex gap-2 text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
              <span style={{ color: "var(--fr-gold)" }} aria-hidden>
                ·
              </span>
              {purpose}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
          {RETENTION.summary} You can withdraw your consent, or ask to see, correct or
          erase your data, at any time by writing to {DATA_FIDUCIARY.grievanceEmail}.{" "}
          <Link href="/hr/privacy" className="underline" style={{ color: "var(--fr-gold-soft)" }}>
            Read the full privacy notice
          </Link>
          .
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" hint="Exactly as it appears on your Aadhaar card.">
            <input name="fullName" required maxLength={120} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Son / daughter of" hint="Parent's full name, for the agreement.">
            <input name="parentName" required maxLength={120} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Aadhaar number" hint="12 digits. Spaces are fine.">
            <input
              name="aadhaarNumber"
              required
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Phone">
            <input name="phone" required type="tel" maxLength={32} className={inputClass} style={inputStyle} />
          </Field>
        </div>

        <Field label="Personal email" hint="Where we reach you until your company mailbox exists.">
          <input name="personalEmail" required type="email" className={inputClass} style={inputStyle} />
        </Field>

        <Field label="Full postal address" hint="Including city, state and PIN code.">
          <textarea
            name="address"
            required
            rows={3}
            maxLength={600}
            className={`${inputClass} resize-y`}
            style={inputStyle}
          />
        </Field>

        <Field label="Copy of your Aadhaar card" hint="JPG, PNG, WebP or PDF, up to 8 MB.">
          <div
            className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-4"
            style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
          >
            <Upload className="size-5 shrink-0" style={{ color: "var(--fr-gold)" }} aria-hidden />
            <input
              name="aadhaarFile"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--fr-navy-soft)] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[var(--fr-paper)]"
            />
          </div>
        </Field>

        <div
          className="rounded-xl px-4 py-4"
          style={{ backgroundColor: "rgba(201,162,39,0.10)" }}
        >
          <p className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--fr-gold-soft)" }}>
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            How your Aadhaar is handled
          </p>
          <ul className="mt-2.5 space-y-2">
            {AADHAAR_SAFEGUARDS.map((point) => (
              <li key={point} className="flex gap-2 text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
                <span style={{ color: "var(--fr-gold)" }} aria-hidden>
                  ·
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <fieldset
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
        >
          <legend className="px-1 text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "var(--fr-gold)" }}>
            Your consent
          </legend>
          <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
            Nothing here is pre-ticked, and each one is a separate consent. Tick only what
            you agree to — if you would rather not give one of them, speak to your point of
            contact before submitting.
          </p>

          <div className="space-y-3">
            {CONSENT_ITEMS.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="consent"
                  value={item.id}
                  required
                  className="mt-0.5 size-4 shrink-0 accent-[var(--fr-gold)]"
                />
                <span className="min-w-0">
                  <span className="block text-xs leading-relaxed">{item.label}</span>
                  {item.detail && (
                    <span className="mt-1 block text-[11px] leading-relaxed" style={{ color: "var(--fr-muted)" }}>
                      {item.detail}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {message && <Notice tone="bad">{message}</Notice>}

        <Button type="submit" disabled={busy}>
          {busy ? "Submitting…" : "Submit details"}
        </Button>
      </form>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fr-muted)" }}>
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-snug break-words">{value}</dd>
    </div>
  );
}
