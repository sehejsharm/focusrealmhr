"use client";

import { useState } from "react";
import { Copy, Eye, KeyRound } from "lucide-react";
import { Button, Card, Notice, SectionTitle } from "./ui";

interface Login {
  loginId: string;
  password: string | null;
  alreadyViewed: boolean;
  loginUrl: string | null;
  /** Their email on record. Not a login — several people may share it. */
  email: string;
  /** Names of the other people using the same email. */
  sharedEmailWith: string[];
}

/** The two apps a login can be for. The CRM one is for sales people only. */
const SYSTEMS = {
  workspace: {
    path: "workspace",
    eyebrow: "Focus Realm Workspace",
    title: "Your Workspace login",
    about: "The team's own app, where your work and deadlines live.",
  },
  crm: {
    path: "crm",
    eyebrow: "Focus Realm Sales CRM",
    title: "Your Sales CRM login",
    about: "Where the sales team works its prospects and calls. Calls you make through it are recorded for coaching.",
  },
} as const;

/**
 * Their Focus Realm Workspace login — or, for sales people, their Sales CRM
 * login — from the last step of onboarding on. The temporary password is
 * revealed once, as the mailbox's is — the server destroys its copy as it
 * hands it over.
 */
export default function WorkspaceAccess({
  token,
  workspace,
  system = "workspace",
}: {
  token: string;
  workspace: { loginId: string; viewed: boolean };
  system?: keyof typeof SYSTEMS;
}) {
  const app = SYSTEMS[system];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [login, setLogin] = useState<Login | null>(null);

  async function reveal() {
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/onboarding/session/${token}/${app.path}`, { method: "POST" });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? `Could not fetch your ${app.eyebrow} login.`);
      return;
    }
    setLogin(data as Login);
  }

  if (login) {
    return (
      <Card>
        <SectionTitle
          eyebrow={app.eyebrow}
          title={app.title}
          lead={
            login.password
              ? "Save these now — the password is not shown again. You choose your own password the first time you sign in."
              : "Your temporary password has already been collected. Sign in with the password you chose, or ask the founders to reset it."
          }
        />

        <dl className="space-y-3">
          <CredentialRow label="Sign in with this employee ID" value={login.loginId} />
          {login.password && <CredentialRow label="Temporary password" value={login.password} mono />}
          {login.loginUrl && <CredentialRow label="Sign in at" value={login.loginUrl} />}
        </dl>

        <p className="mt-5 text-sm" style={{ color: "var(--fg-muted)" }}>
          Your email, {login.email}, is not a login — always sign in with your employee ID.
        </p>

        {login.sharedEmailWith.length > 0 && (
          <div className="mt-4">
            <Notice tone="info">
              {login.email} is shared. Also used by: {login.sharedEmailWith.join(", ")}. Each of you has
              your own employee ID and your own password.
            </Notice>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        eyebrow={app.eyebrow}
        title={app.title}
        lead={
          workspace.viewed
            ? "Your temporary password has already been collected. If you no longer have it, ask the founders to reset it."
            : `${app.about} You sign in with your employee ID and a temporary password, which is shown once, and once only — have somewhere to save it before you continue.`
        }
      />

      <p className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fg-muted)" }}>
        Sign in with this employee ID
      </p>
      <p className="mt-1 mb-2 flex items-center gap-2 font-mono text-base font-bold">
        <KeyRound className="size-5 shrink-0" style={{ color: "var(--brand)" }} aria-hidden />
        {workspace.loginId}
      </p>
      <p className="mb-5 text-sm" style={{ color: "var(--fg-muted)" }}>
        Your email is not a login.
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
      <dt className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fg-muted)" }}>
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
          style={{ backgroundColor: "var(--surface-hover)", border: "1px solid var(--line)" }}
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? "Copied" : "Copy"}
        </button>
      </dd>
    </div>
  );
}
