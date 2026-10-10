"use client";

import { useState } from "react";
import { Copy, Eye, KeyRound } from "lucide-react";
import type { CandidateView } from "@/lib/onboarding/types";
import { Button, Card, Notice, SectionTitle } from "./ui";

interface Login {
  loginId: string;
  password: string | null;
  alreadyViewed: boolean;
  loginUrl: string | null;
}

/**
 * Their Focus Realm Workspace login, from the last step of onboarding on. The
 * temporary password is revealed once, as the mailbox's is — the server
 * destroys its copy as it hands it over.
 */
export default function WorkspaceAccess({
  token,
  workspace,
}: {
  token: string;
  workspace: NonNullable<CandidateView["workspace"]>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [login, setLogin] = useState<Login | null>(null);

  async function reveal() {
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/onboarding/session/${token}/workspace`, { method: "POST" });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not fetch your Workspace login.");
      return;
    }
    setLogin(data as Login);
  }

  if (login) {
    return (
      <Card>
        <SectionTitle
          eyebrow="Focus Realm Workspace"
          title="Your Workspace login"
          lead={
            login.password
              ? "Save these now — the password is not shown again. You choose your own password the first time you sign in."
              : "Your temporary password has already been collected. Sign in with the password you chose, or ask the founders to reset it."
          }
        />

        <dl className="space-y-3">
          <CredentialRow label="Employee ID" value={login.loginId} />
          {login.password && <CredentialRow label="Temporary password" value={login.password} mono />}
          {login.loginUrl && <CredentialRow label="Sign in at" value={login.loginUrl} />}
        </dl>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        eyebrow="Focus Realm Workspace"
        title="Your Workspace login"
        lead={
          workspace.viewed
            ? "Your temporary password has already been collected. If you no longer have it, ask the founders to reset it."
            : "The team's own app, where your work and deadlines live. You sign in with your employee ID and a temporary password, which is shown once, and once only — have somewhere to save it before you continue."
        }
      />

      <p className="mb-5 flex items-center gap-2 font-mono text-base font-bold">
        <KeyRound className="size-5 shrink-0" style={{ color: "var(--fr-gold)" }} aria-hidden />
        {workspace.loginId}
      </p>

      {message && (
        <div className="mb-4">
          <Notice tone="bad">{message}</Notice>
        </div>
      )}

      <Button disabled={busy} onClick={reveal}>
        <Eye className="size-4" aria-hidden />
        {busy ? "Fetching…" : workspace.viewed ? "Show sign-in details" : "Reveal password once"}
      </Button>
    </Card>
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
