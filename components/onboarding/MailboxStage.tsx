"use client";

import { useState } from "react";
import { AtSign, Copy, Eye, Mail } from "lucide-react";
import { MAIL_SETTINGS } from "@/lib/onboarding/content";
import type { CandidateView } from "@/lib/onboarding/types";
import { Button, Card, Notice, SectionTitle } from "./ui";

interface Credentials {
  address: string;
  password: string | null;
  alreadyViewed: boolean;
  settings: typeof MAIL_SETTINGS;
  outlookSteps: string[];
}

/** Step six: request a company mailbox, then collect the credentials once. */
export default function MailboxStage({
  token,
  candidate,
  onSaved,
  locked,
  inPortal = false,
}: {
  token: string;
  candidate: CandidateView;
  onSaved: (next: CandidateView) => void;
  locked: boolean;
  /** Shown on the employee portal, where it is no longer a numbered step. */
  inPortal?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  async function request() {
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/onboarding/session/${token}/mailbox`, { method: "POST" });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not send your request.");
      return;
    }
    onSaved(data as CandidateView);
  }

  async function reveal() {
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/onboarding/session/${token}/mailbox`, { method: "PUT" });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not fetch your credentials.");
      return;
    }
    setCredentials(data as Credentials);
  }

  if (locked) {
    return (
      <Card>
        <SectionTitle
          eyebrow={inPortal ? undefined : "Step 6 of 6"}
          title="Your Focus Realm email"
          lead="Once your signed agreement is verified, you can request a company mailbox here."
        />
        <Notice tone="warn">Opens once your agreement has been verified.</Notice>
      </Card>
    );
  }

  if (credentials) return <CredentialsPanel credentials={credentials} />;

  if (candidate.mailbox) {
    return (
      <Card>
        <SectionTitle
          eyebrow={inPortal ? undefined : "Step 6 of 6"}
          title="Your mailbox is ready"
          lead={
            candidate.mailbox.viewed
              ? "You have already collected your password. If you did not save it, ask the founders to reset it in SpaceMail."
              : "Your temporary password is shown once, and once only. Have somewhere to save it before you continue."
          }
        />

        <p className="mb-5 flex items-center gap-2 text-base font-bold break-all">
          <AtSign className="size-5 shrink-0" style={{ color: "var(--fr-gold)" }} aria-hidden />
          {candidate.mailbox.address}
        </p>

        {message && (
          <div className="mb-4">
            <Notice tone="bad">{message}</Notice>
          </div>
        )}

        <Button disabled={busy} onClick={reveal}>
          <Eye className="size-4" aria-hidden />
          {busy ? "Fetching…" : candidate.mailbox.viewed ? "Show setup instructions" : "Reveal password once"}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        eyebrow={inPortal ? undefined : "Step 6 of 6"}
        title="Request your Focus Realm email"
        lead="Your agreement is verified. Request a mailbox and the founders will create it on SpaceMail — you will be able to collect the credentials here."
      />

      {candidate.emailRequestedAt ? (
        <Notice tone="good">
          Requested. You will see your address and a one-time password here as soon as the mailbox is
          created.
        </Notice>
      ) : (
        <>
          {message && (
            <div className="mb-4">
              <Notice tone="bad">{message}</Notice>
            </div>
          )}
          <Button disabled={busy} onClick={request}>
            <Mail className="size-4" aria-hidden />
            {busy ? "Sending…" : "Request my email ID"}
          </Button>
        </>
      )}
    </Card>
  );
}

function CredentialsPanel({ credentials }: { credentials: Credentials }) {
  const { settings } = credentials;

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle
          eyebrow="Welcome aboard"
          title="Your Focus Realm mailbox"
          lead={
            credentials.password
              ? "Save these now — the password is not shown again. Change it in webmail once you are signed in."
              : "You have already collected your password. The setup details below stay available."
          }
        />

        <dl className="space-y-3">
          <CredentialRow label="Email address" value={credentials.address} />
          {credentials.password ? (
            <CredentialRow label="Temporary password" value={credentials.password} mono />
          ) : (
            <div>
              <dt className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fr-muted)" }}>
                Temporary password
              </dt>
              <dd className="mt-1 text-sm" style={{ color: "var(--fr-muted)" }}>
                Already collected. Ask the founders to reset it if you no longer have it.
              </dd>
            </div>
          )}
          <CredentialRow label="Webmail" value={settings.webmail} />
        </dl>
      </Card>

      <Card>
        <SectionTitle
          title="Server settings"
          lead={`This mailbox is hosted on ${settings.provider}, not Microsoft — which is the one thing that trips people up in Outlook.`}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <ServerBlock
            heading={`Incoming · ${settings.incoming.protocol}`}
            host={settings.incoming.host}
            port={settings.incoming.port}
            security={settings.incoming.security}
          />
          <ServerBlock
            heading={`Outgoing · ${settings.outgoing.protocol}`}
            host={settings.outgoing.host}
            port={settings.outgoing.port}
            security={settings.outgoing.security}
          />
        </div>

        <p className="mt-4 text-sm" style={{ color: "var(--fr-muted)" }}>
          Username is your full email address, both times.
        </p>
      </Card>

      <Card>
        <SectionTitle title="Setting it up in Outlook" />
        <ol className="space-y-3">
          {credentials.outlookSteps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                style={{ backgroundColor: "var(--fr-gold)", color: "var(--fr-navy-deep)" }}
                aria-hidden
              >
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-pretty">{step}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function CredentialRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <dt className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fr-muted)" }}>
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap items-center gap-3">
        <span className={`text-base font-bold break-all ${mono ? "font-mono" : ""}`}>{value}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold"
          style={{ backgroundColor: "var(--fr-navy-soft)", border: "1px solid var(--fr-line)" }}
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? "Copied" : "Copy"}
        </button>
      </dd>
    </div>
  );
}

function ServerBlock({
  heading,
  host,
  port,
  security,
}: {
  heading: string;
  host: string;
  port: number;
  security: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
    >
      <p className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fr-gold)" }}>
        {heading}
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt style={{ color: "var(--fr-muted)" }}>Server</dt>
          <dd className="font-mono font-bold break-all">{host}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt style={{ color: "var(--fr-muted)" }}>Port</dt>
          <dd className="font-mono font-bold">{port}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt style={{ color: "var(--fr-muted)" }}>Encryption</dt>
          <dd className="font-bold">{security}</dd>
        </div>
      </dl>
    </div>
  );
}
