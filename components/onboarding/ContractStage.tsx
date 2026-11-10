"use client";

import { useEffect, useState } from "react";
import { Clock, Download, ExternalLink, FileSignature } from "lucide-react";
import type { Contract } from "@/lib/onboarding/contract";
import type { CandidateView, CompanySignature, Signature } from "@/lib/onboarding/types";
import ContractDocument from "./ContractDocument";
import { SIGNING_CONSENT } from "@/lib/onboarding/compliance";
import { assessmentsPassedPhrase } from "@/lib/onboarding/content";
import { Button, Card, Field, Notice, SectionTitle, formatDateTime, inputClass, inputStyle } from "./ui";

/** Steps four and five: review and sign, then wait for the founders to verify. */
export default function ContractStage({
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
  const [contract, setContract] = useState<Contract | null>(null);
  const [document, setDocument] = useState<{ originalName: string; bytes: number } | null>(
    null,
  );
  const [notReady, setNotReady] = useState(false);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [companySignature, setCompanySignature] = useState<CompanySignature | null>(null);
  const [typedName, setTypedName] = useState("");
  const [affirmed, setAffirmed] = useState(false);
  const [signingConsent, setSigningConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (locked) return;

    let cancelled = false;
    fetch(`/api/onboarding/session/${token}/contract`)
      .then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json() }))
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        if (!ok) {
          // 409 means the founders are still preparing this role's agreement.
          setNotReady(status === 409);
          return;
        }
        setNotReady(false);
        setContract((data.contract as Contract) ?? null);
        setDocument(data.kind === "bespoke" ? data.document : null);
        setSignature(data.signature as Signature | null);
        setCompanySignature(data.companySignature as CompanySignature | null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token, locked, candidate.signedAt]);

  if (locked) {
    return (
      <Card>
        <SectionTitle
          eyebrow="Step 4 of 6"
          title="Internship agreement"
          lead={`Your agreement is drawn up automatically from the details you submitted, and opens as soon as ${assessmentsPassedPhrase(candidate.companies.length)}.`}
        />
        <Notice tone="warn">Your agreement unlocks once {assessmentsPassedPhrase(candidate.companies.length)}.</Notice>
      </Card>
    );
  }

  async function sign() {
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/onboarding/session/${token}/contract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        typedName,
        affirmed,
        electronicSignatureConsent: signingConsent,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not sign.");
      return;
    }
    onSaved(data as CandidateView);
  }

  const isSigned = Boolean(candidate.signedAt);
  const isVerified = Boolean(candidate.contractVerifiedAt);

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle
          eyebrow={isSigned ? (isVerified ? "Step 4 · Verified" : "Step 5 · Under review") : "Step 4 of 6"}
          title="Internship agreement"
          lead={
            isVerified
              ? "Signed and verified by the founders. Your copy is below — print or save it for your records."
              : isSigned
                ? "Signed. The founders verify it from their side, usually within a working day. You will be able to request your company email once they do."
                : "Generated from the details you submitted. Read it in full. If you'd like anything changed, suggest it below before signing; otherwise sign at the bottom."
          }
        />

        {candidate.contractRejection && (
          <div className="mb-5">
            <Notice tone="bad">
              Sent back on {formatDateTime(candidate.contractRejection.at)}:{" "}
              {candidate.contractRejection.note}
            </Notice>
          </div>
        )}

        {isSigned && !isVerified && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--brand-soft)" }}>
            <Clock className="size-5 shrink-0" style={{ color: "var(--brand)" }} aria-hidden />
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              Signed {candidate.signedAt ? formatDateTime(candidate.signedAt) : ""} — awaiting
              verification.
            </p>
          </div>
        )}

        {isSigned && contract && (
          <a
            href={`/api/onboarding/session/${token}/contract/pdf`}
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold"
            style={{
              backgroundColor: "var(--surface-hover)",
              border: "1px solid var(--line)",
              color: "var(--fg)",
            }}
          >
            <Download className="size-4" aria-hidden />
            Download agreement (PDF)
          </a>
        )}
      </Card>

      {notReady && (
        <Card>
          <Notice tone="warn">
            The agreement for your role is being prepared. Your point of contact will let
            you know the moment it is ready to sign — nothing else is needed from you until
            then.
          </Notice>
        </Card>
      )}

      {document && (
        <Card>
          <SectionTitle
            title="Your agreement"
            lead="Your role has its own agreement rather than the standard one. Open it and read it in full before signing."
          />
          <a
            href={`/api/onboarding/session/${token}/agreement`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold"
            style={{
              backgroundColor: "var(--surface-hover)",
              border: "1px solid var(--line)",
              color: "var(--fg)",
            }}
          >
            Open {document.originalName}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </Card>
      )}

      {contract && (
        <ContractDocument
          contract={contract}
          signature={signature}
          companySignature={companySignature}
        />
      )}

      {(contract || document) && !isSigned && (
        <SuggestChanges
          token={token}
          clauses={contract?.clauses.map((c) => c.heading) ?? []}
          suggestions={candidate.contractSuggestions}
          onSaved={onSaved}
        />
      )}

      {(contract || document) && !isSigned && (
        <Card>
          <SectionTitle
            title="Sign the agreement"
            lead="Typing your name below is your electronic signature. It is recorded with the time and your IP address."
          />

          <div className="space-y-5">
            <Field label="Type your full name" hint={
                contract
                  ? `Must match "${contract.fields.fullName}".`
                  : "Must match the full name you submitted."
              }>
              <input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className={inputClass}
                style={inputStyle}
                autoComplete="off"
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={affirmed}
                onChange={(e) => setAffirmed(e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
              />
              <span className="text-sm leading-snug text-pretty">
                I have read this agreement in full, the details in it are mine and correct, and I
                accept its terms.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={signingConsent}
                onChange={(e) => setSigningConsent(e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
              />
              <span className="min-w-0">
                <span className="block text-sm leading-snug text-pretty">
                  {SIGNING_CONSENT.label}
                </span>
                {SIGNING_CONSENT.detail && (
                  <span
                    className="mt-1 block text-xs leading-relaxed"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {SIGNING_CONSENT.detail}
                  </span>
                )}
              </span>
            </label>

            {message && <Notice tone="bad">{message}</Notice>}

            <Button
              disabled={busy || !typedName.trim() || !affirmed || !signingConsent}
              onClick={sign}
            >
              <FileSignature className="size-4" aria-hidden />
              {busy ? "Signing…" : "Sign agreement"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

const STATUS_LABEL = { open: "Waiting for the founders", accepted: "Accepted", declined: "Not changed" } as const;

/**
 * Before signing, an intern can send the founders changes they'd like — about
 * one clause or the whole agreement — and see each answer here. If the
 * founders change the agreement, the new text shows above.
 */
function SuggestChanges({
  token,
  clauses,
  suggestions,
  onSaved,
}: {
  token: string;
  clauses: string[];
  suggestions: CandidateView["contractSuggestions"];
  onSaved: (next: CandidateView) => void;
}) {
  const [clause, setClause] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/onboarding/session/${token}/contract/suggestions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clause: clause || undefined, text }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Could not send your suggestion.");
      return;
    }
    setText("");
    setClause("");
    onSaved(data as CandidateView);
  }

  return (
    <Card>
      <SectionTitle
        title="Suggest changes"
        lead="Something you'd like worded differently, or a question about a clause? Send it to the founders before you sign. They'll answer here, and if they change the agreement you'll see the new version above."
      />

      {suggestions.length > 0 && (
        <ul className="mb-5 space-y-3">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border p-3 text-sm"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-sunken)" }}
            >
              <span className="block text-xs font-bold" style={{ color: "var(--fg-muted)" }}>
                {s.clause ?? "The whole agreement"} · {formatDateTime(s.at)} · {STATUS_LABEL[s.status]}
              </span>
              <span className="mt-1 block whitespace-pre-wrap">{s.text}</span>
              {s.reply && (
                <span className="mt-2 block border-l-2 pl-3" style={{ borderColor: "var(--brand)" }}>
                  <span className="font-bold">Founders:</span> {s.reply}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4">
        <Field label="About">
          <select value={clause} onChange={(e) => setClause(e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">The whole agreement</option>
            {clauses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your suggestion">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={4}
            className={inputClass}
            style={inputStyle}
            placeholder="e.g. Could the working hours in clause 5 be 10 to 6 instead?"
          />
        </Field>
        {message && <Notice tone="bad">{message}</Notice>}
        <Button disabled={busy || !text.trim()} onClick={send}>
          {busy ? "Sending…" : "Send to the founders"}
        </Button>
      </div>
    </Card>
  );
}
