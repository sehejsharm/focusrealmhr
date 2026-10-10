"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Award, Copy, KeyRound, LogOut, FileWarning, Plus, RefreshCw, UserPlus } from "lucide-react";
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
import {
  BUILT_IN_TRACKS,
  DEFAULT_TERM_MONTHS,
  MAX_TERM_MONTHS,
  MIN_TERM_MONTHS,
  STAGE_LABEL,
  type AgreementPlan,
  type InternTrack,
  type Stage,
  type TrackDefinition,
} from "@/lib/onboarding/types";
import type { Company } from "@/lib/onboarding/types";
import { ALL_COMPANIES, COMPANIES, companyLabel } from "@/lib/onboarding/content";

interface Row {
  id: string;
  token: string;
  invitedName: string;
  invitedEmail: string;
  track: InternTrack;
  role: TrackDefinition;
  startDate: string;
  endDate: string;
  termMonths: number;
  agreementKind: AgreementPlan["kind"];
  agreementReady: boolean;
  companies: Company[];
  removal: { leftOn: string; reason: string | null } | null;
  /** Added directly as an existing employee rather than invited. */
  existing: boolean;
  retention: { kind: "keep" | "erase"; until: string } | null;
  stage: Stage;
  fullName: string | null;
  signedAt: string | null;
  contractVerifiedAt: string | null;
  emailRequestedAt: string | null;
  mailbox: string | null;
  /** Completion certificate / recommendation letter drafted and awaiting approval. */
  certificatesAwaiting: ("completion" | "recommendation")[];
  certificatesIssued: ("completion" | "recommendation")[];
  /** Where they are in leaving — see lib/onboarding/offboarding.ts. */
  offboarding: "not-eligible" | "not-yet" | "link-ready" | "open" | "done";
  offboardedAt: string | null;
}

const DAY = 86_400_000;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
}

function needsFounder(row: Row): boolean {
  return Boolean(
    (row.signedAt && !row.contractVerifiedAt) ||
      (row.emailRequestedAt && !row.mailbox) ||
      !row.agreementReady ||
      row.certificatesAwaiting.length > 0,
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminConsole() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [creating, setCreating] = useState<null | "invite" | "existing">(null);

  const load = useCallback(
    () =>
      fetch("/api/onboarding/admin/candidates")
        .then(async (response) => {
          if (response.status === 401) {
            setNeedsAuth(true);
            return;
          }
          setNeedsAuth(false);
          setRows((await response.json()) as Row[]);
        })
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Removed interns leave the active list and every count, but stay listed below.
  const active = useMemo(() => rows?.filter((r) => !r.removal) ?? null, [rows]);
  const removed = useMemo(() => rows?.filter((r) => r.removal) ?? [], [rows]);

  const stats = useMemo(() => {
    if (!active) return null;
    return {
      total: active.length,
      onboarding: active.filter((r) => r.stage !== "complete").length,
      needsYou: active.filter(needsFounder).length,
      agreementsToPrepare: active.filter((r) => !r.agreementReady).length,
      certificates: active.filter((r) => r.certificatesAwaiting.length > 0).length,
      endingSoon: active.filter((r) => {
        const days = daysUntil(r.endDate);
        return days >= 0 && days <= 30;
      }).length,
    };
  }, [active]);

  if (needsAuth) return <PasscodeGate onDone={load} />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <Wordmark subtitle="HR console" href="/hr/admin" />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={load}>
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCreating((v) => (v === "existing" ? null : "existing"))}
          >
            <UserPlus className="size-4" aria-hidden />
            Add existing employee
          </Button>
          <Button onClick={() => setCreating((v) => (v === "invite" ? null : "invite"))}>
            <Plus className="size-4" aria-hidden />
            New candidate
          </Button>
        </div>
      </div>

      {stats && (
        <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="People" value={stats.total} />
          <Stat label="Onboarding" value={stats.onboarding} />
          <Stat label="Needs you" value={stats.needsYou} tone={stats.needsYou > 0 ? "gold" : undefined} />
          <Stat
            label="Agreements to prepare"
            value={stats.agreementsToPrepare}
            tone={stats.agreementsToPrepare > 0 ? "gold" : undefined}
          />
          <Stat
            label="Certificates to approve"
            value={stats.certificates}
            tone={stats.certificates > 0 ? "gold" : undefined}
          />
          <Stat label="Ending ≤ 30 days" value={stats.endingSoon} />
        </dl>
      )}

      {creating && (
        <div className="mb-5">
          <NewCandidate
            key={creating}
            mode={creating}
            onCreated={() => {
              setCreating(null);
              load();
            }}
          />
        </div>
      )}

      <Card className="!p-0">
        <div className="border-b p-5 fr-rule sm:p-6">
          <SectionTitle
            title="People"
            lead="Interns, candidates and employees, newest first. Open one to review documents, act on onboarding, approve end-of-internship certificates, or send an offboarding link."
          />
        </div>

        {!active ? (
          <p className="p-6 text-sm" style={{ color: "var(--fr-muted)" }}>
            Loading…
          </p>
        ) : active.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: "var(--fr-muted)" }}>
            {removed.length > 0
              ? "No one active. Removed people are listed below."
              : "No one here yet. Invite a candidate, or add an existing employee."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead>
                <tr
                  className="text-[11px] tracking-[0.14em] uppercase"
                  style={{ color: "var(--fr-muted)" }}
                >
                  <Th>Person</Th>
                  <Th>Role</Th>
                  <Th>Onboarding</Th>
                  <Th>Term</Th>
                  <Th>Starts</Th>
                  <Th>Ends</Th>
                  <Th>Stage</Th>
                  <Th>Flags</Th>
                </tr>
              </thead>
              <tbody>
                {active.map((row) => {
                  const remaining = daysUntil(row.endDate);
                  const ended = remaining < 0;

                  return (
                    <tr key={row.id} className="border-t align-top fr-rule">
                      <Td>
                        <Link
                          href={`/hr/admin/${row.id}`}
                          className="font-bold hover:underline"
                        >
                          {row.fullName ?? row.invitedName}
                        </Link>
                        <span className="mt-0.5 block text-xs" style={{ color: "var(--fr-muted)" }}>
                          {row.invitedEmail}
                        </span>
                      </Td>
                      <Td>{row.role.label}</Td>
                      <Td>{row.companies.map(companyLabel).join(" + ")}</Td>
                      <Td>
                        <span className="tabular-nums">{row.termMonths} mo</span>
                      </Td>
                      <Td>
                        <span className="tabular-nums">{formatDate(row.startDate)}</span>
                      </Td>
                      <Td>
                        <span className="tabular-nums">{formatDate(row.endDate)}</span>
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: ended ? "var(--fr-muted)" : "var(--fr-gold-soft)" }}
                        >
                          {ended
                            ? `ended ${Math.abs(remaining)}d ago`
                            : `${remaining}d remaining`}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className="inline-block rounded-md px-2 py-1 text-xs"
                          style={{
                            backgroundColor: "var(--fr-navy-soft)",
                            color: "var(--fr-muted)",
                          }}
                        >
                          {STAGE_LABEL[row.stage]}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          {row.existing && (
                            <span
                              className="inline-block rounded-md px-2 py-1 text-xs"
                              style={{ backgroundColor: "var(--fr-navy-soft)", color: "var(--fr-muted)" }}
                            >
                              Added directly
                            </span>
                          )}
                          {!row.agreementReady && (
                            <Flag tone="gold" Icon={FileWarning}>
                              Agreement needed
                            </Flag>
                          )}
                          {row.signedAt && !row.contractVerifiedAt && (
                            <Flag tone="gold" Icon={AlertTriangle}>
                              Verify signature
                            </Flag>
                          )}
                          {row.emailRequestedAt && !row.mailbox && (
                            <Flag tone="gold" Icon={AlertTriangle}>
                              Create mailbox
                            </Flag>
                          )}
                          {row.certificatesAwaiting.length > 0 && (
                            <Flag tone="gold" Icon={Award}>
                              {row.certificatesAwaiting.length === 2
                                ? "Approve certificates"
                                : row.certificatesAwaiting[0] === "completion"
                                  ? "Approve certificate"
                                  : "Approve letter"}
                            </Flag>
                          )}
                          {(row.offboarding === "link-ready" || row.offboarding === "open") && (
                            <Flag tone="gold" Icon={LogOut}>
                              {row.offboarding === "open" ? "Offboarding open" : "Send offboarding link"}
                            </Flag>
                          )}
                          {row.offboarding === "done" && (
                            <span
                              className="inline-block rounded-md px-2 py-1 text-xs"
                              style={{ backgroundColor: "rgba(52,168,110,0.14)", color: "#a7e8c6" }}
                            >
                              Offboarded
                            </span>
                          )}
                          {row.certificatesIssued.length > 0 && (
                            <span
                              className="inline-block rounded-md px-2 py-1 text-xs"
                              style={{ backgroundColor: "rgba(52,168,110,0.14)", color: "#a7e8c6" }}
                            >
                              {row.certificatesIssued.length === 2 ? "Certificates issued" : "1 of 2 issued"}
                            </span>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {removed.length > 0 && (
        <Card className="mt-5">
          <SectionTitle
            title={`Removed (${removed.length})`}
            lead="People who left, or candidates who stopped before starting. Their links and sign-in no longer work, but their records are kept as the privacy notice promises. Open one to restore it."
          />
          <ul className="space-y-2">
            {removed.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
              >
                <div className="min-w-0">
                  <Link href={`/hr/admin/${row.id}`} className="font-bold hover:underline">
                    {row.fullName ?? row.invitedName}
                  </Link>
                  <span className="block text-xs" style={{ color: "var(--fr-muted)" }}>
                    {row.role.label} · left {formatDate(row.removal!.leftOn)}
                    {row.removal!.reason ? ` · ${row.removal!.reason}` : ""}
                  </span>
                </div>
                {row.retention && (
                  <span className="text-xs tabular-nums" style={{ color: "var(--fr-muted)" }}>
                    {row.retention.kind === "keep" ? "Keep until " : "Erase by "}
                    {formatDate(row.retention.until)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rows && <WorkspaceSync onSynced={load} />}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "gold";
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy)" }}
    >
      <dt
        className="text-[10px] font-bold tracking-[0.14em] uppercase"
        style={{ color: "var(--fr-muted)" }}
      >
        {label}
      </dt>
      <dd
        className="mt-2 text-2xl leading-none font-bold tabular-nums"
        style={{ color: tone === "gold" && value > 0 ? "var(--fr-gold-soft)" : "var(--fr-paper)" }}
      >
        {value}
      </dd>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold first:pl-5 last:pr-5">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3.5 first:pl-5 last:pr-5">{children}</td>;
}

function Flag({
  children,
  Icon,
}: {
  children: React.ReactNode;
  tone: "gold";
  Icon: typeof AlertTriangle;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: "var(--fr-gold)", color: "var(--fr-navy-deep)" }}
    >
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Gate                                                                       */
/* -------------------------------------------------------------------------- */

function PasscodeGate({ onDone }: { onDone: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/onboarding/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setBusy(false);

    if (!response.ok) {
      setMessage("Incorrect passcode.");
      return;
    }
    onDone();
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="mb-8">
        <Wordmark subtitle="HR console" href="/hr/admin" />
      </div>
      <Card>
        <SectionTitle
          title="Founders only"
          lead="This console shows candidates' identity documents. Enter the shared passcode to continue."
        />
        <div className="space-y-4">
          <Field label="Passcode">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className={inputClass}
              style={inputStyle}
              autoFocus
            />
          </Field>
          {message && <Notice tone="bad">{message}</Notice>}
          <Button disabled={busy || !passcode} onClick={submit}>
            {busy ? "Checking…" : "Enter"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Invite                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * "invite" creates an onboarding link. "existing" records someone already
 * onboarded outside the console — no link, no agreement to choose.
 */
function NewCandidate({
  mode,
  onCreated,
}: {
  mode: "invite" | "existing";
  onCreated: () => void;
}) {
  const isExisting = mode === "existing";
  const [track, setTrack] = useState("founders-office");
  const [agreementKind, setAgreementKind] =
    useState<AgreementPlan["kind"]>("standard");
  const [companies, setCompanies] = useState<Company[]>(ALL_COMPANIES);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const known = BUILT_IN_TRACKS[track];
  // Only the Founder's Office agreement exists as a reviewed document.
  const hasAgreementOnFile = Boolean(known?.agreementOnFile);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/onboarding/admin/candidates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        invitedName: form.get("invitedName"),
        invitedEmail: form.get("invitedEmail"),
        track,
        startDate: form.get("startDate"),
        termMonths: Number(form.get("termMonths")),
        agreementKind: hasAgreementOnFile ? "standard" : agreementKind,
        companies,
        existing: isExisting
          ? { companyEmail: form.get("companyEmail"), note: form.get("note") }
          : undefined,
        customRole:
          track === "custom"
            ? {
                label: form.get("customLabel"),
                roleTitle: form.get("customRoleTitle"),
                duties: form.get("customDuties"),
              }
            : undefined,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not create.");
      return;
    }
    setCreated({
      id: data.id as string,
      link: `${window.location.origin}/hr/${data.token}`,
    });
  }

  if (created) {
    return (
      <Card>
        <SectionTitle
          title={isExisting ? "Added — portal link ready" : "Onboarding link ready"}
          lead={
            isExisting
              ? "Send this to them. It opens their employee portal — there are no passwords, so treat the link like one. At the end of their term you send a separate offboarding link for their documents."
              : "Send this to the candidate. It is the only way into their onboarding, so treat it like a password — anyone holding it can submit details as them."
          }
        />
        <p
          className="mb-4 rounded-xl border p-4 font-mono text-sm break-all"
          style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
        >
          {created.link}
        </p>

        {!isExisting && agreementKind === "bespoke" && !hasAgreementOnFile && (
          <div className="mb-4">
            <Notice tone="warn">
              This candidate cannot reach a signature until you upload their agreement.
              Open their record and add the document.
            </Notice>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              navigator.clipboard?.writeText(created.link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="size-4" aria-hidden />
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button variant="ghost" onClick={onCreated}>
            Done
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        title={isExisting ? "Add existing employee" : "New candidate"}
        lead={
          isExisting
            ? "For someone onboarded before this console existed. They go straight onto the roster as onboarded, skipping onboarding, and get an employee portal link; they collect their certificates through an offboarding link at the end of their term. Their agreement stays wherever you keep it now — nothing is signed or recorded on their behalf."
            : "Creates their onboarding link."
        }
      />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input name="invitedName" required className={inputClass} style={inputStyle} />
          </Field>
          <Field label={isExisting ? "Personal email" : "Email"}>
            <input name="invitedEmail" required type="email" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Role">
            <select
              name="track"
              required
              className={inputClass}
              style={inputStyle}
              value={track}
              onChange={(event) => setTrack(event.target.value)}
            >
              {Object.values(BUILT_IN_TRACKS).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom role…</option>
            </select>
          </Field>
          <Field label="Start date">
            <input name="startDate" required type="date" className={inputClass} style={inputStyle} />
          </Field>
          <Field
            label="Length of the internship"
            hint="In months. Written into the agreement, and used for the end date."
          >
            <input
              name="termMonths"
              required
              type="number"
              min={MIN_TERM_MONTHS}
              max={MAX_TERM_MONTHS}
              step={1}
              defaultValue={DEFAULT_TERM_MONTHS}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>

        <fieldset
          className="space-y-3 rounded-xl border p-4"
          style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
        >
          <legend className="px-1 text-sm font-bold">
            {isExisting ? "Works with" : "Onboard into"}
          </legend>
          <p className="text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
            {isExisting
              ? "The companies they work across. Shown on the roster."
              : "Each company adds its own handbook, video briefing and assessment. The candidate only sees — and can only open — the material for the companies ticked here."}
          </p>
          <div className="flex flex-wrap gap-3">
            {COMPANIES.map((company) => {
              const checked = companies.includes(company.id);
              return (
                <label
                  key={company.id}
                  className="flex min-h-12 items-center gap-3 rounded-xl border px-4"
                  style={{
                    borderColor: checked ? "var(--fr-gold)" : "var(--fr-line)",
                    backgroundColor: checked ? "rgba(201,162,39,0.10)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setCompanies((prev) =>
                        event.target.checked
                          ? ALL_COMPANIES.filter((c) => c === company.id || prev.includes(c))
                          : prev.filter((c) => c !== company.id),
                      )
                    }
                    className="size-4 shrink-0 accent-[var(--fr-gold)]"
                  />
                  <span className="text-sm font-bold">{company.label}</span>
                </label>
              );
            })}
          </div>
          {companies.length === 0 && (
            <p className="text-xs font-bold" style={{ color: "#f2b8b8" }}>
              Tick at least one company.
            </p>
          )}
        </fieldset>

        {track === "custom" && (
          <div
            className="space-y-4 rounded-xl border p-4"
            style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
          >
            <p className="text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
              A custom role is written into this candidate&apos;s agreement exactly as you
              enter it here, and is frozen on their record — editing it later cannot change
              an agreement they have already signed.
            </p>

            <Field label="Role name" hint='Shown in the portal and the console, e.g. "Design".'>
              <input
                name="customLabel"
                required
                maxLength={60}
                placeholder="Design"
                className={inputClass}
                style={inputStyle}
              />
            </Field>

            <Field
              label="Role title for the agreement"
              hint='The title in Clause 1, e.g. "Design Intern".'
            >
              <input
                name="customRoleTitle"
                required
                maxLength={80}
                placeholder="Design Intern"
                className={inputClass}
                style={inputStyle}
              />
            </Field>

            <Field
              label="Duties and responsibilities"
              hint="Completes the sentence “assisting with …” in the duties clause."
            >
              <textarea
                name="customDuties"
                required
                rows={3}
                maxLength={600}
                placeholder="product and brand design support, design-system upkeep, and asset production for the founding team"
                className={`${inputClass} resize-y`}
                style={inputStyle}
              />
            </Field>
          </div>
        )}

        {/*
          Only the Founder's Office agreement exists as a reviewed document. For
          every other role the founders have to decide, here, which agreement
          this candidate signs.
        */}
        {isExisting && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company email" hint="Optional. Their Focus Realm address, if they have one.">
              <input
                name="companyEmail"
                type="email"
                placeholder="firstname@focusrealm.org"
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <Field label="Note" hint="Optional. e.g. where their signed agreement is filed.">
              <input name="note" maxLength={500} className={inputClass} style={inputStyle} />
            </Field>
          </div>
        )}

        {!hasAgreementOnFile && !isExisting && (
          <fieldset
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--fr-gold)", backgroundColor: "var(--fr-navy-deep)" }}
          >
            <legend
              className="px-1 text-xs font-bold tracking-[0.16em] uppercase"
              style={{ color: "var(--fr-gold)" }}
            >
              Agreement for this role
            </legend>
            <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
              The only agreement on file is the Founder&apos;s Office one. Choose what this
              candidate signs.
            </p>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="agreementKind"
                  checked={agreementKind === "standard"}
                  onChange={() => setAgreementKind("standard")}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--fr-gold)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">
                    Issue the standard agreement for this role
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
                    Identical to the Founder&apos;s Office agreement clause for clause. Only
                    the role title, the duties above and the term change. Ready to sign
                    immediately.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="agreementKind"
                  checked={agreementKind === "bespoke"}
                  onChange={() => setAgreementKind("bespoke")}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--fr-gold)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">
                    Upload an agreement or job description for this role
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
                    Use this where the terms differ beyond duties and title. You upload the
                    document from the candidate&apos;s record, and they cannot reach a
                    signature until you have.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        )}

        {message && <Notice tone="bad">{message}</Notice>}

        <Button type="submit" disabled={busy || companies.length === 0}>
          {busy ? (isExisting ? "Adding…" : "Creating…") : isExisting ? "Add to roster" : "Create and generate link"}
        </Button>
      </form>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Focus Realm Workspace                                                      */
/* -------------------------------------------------------------------------- */

interface SyncResult {
  synced: number;
  alreadyLinked: number;
  /** Removed people, left out of the Workspace. */
  skipped: number;
  failed: { id: string; name: string; error: string }[];
}

/**
 * Everyone added here gets a Workspace login the moment they are created.
 * This catches up everyone else: people added before the two apps were
 * connected, or whose login could not be created at the time.
 */
function WorkspaceSync({ onSynced }: { onSynced: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function sync() {
    setBusy(true);
    setMessage(null);
    setResult(null);

    const response = await fetch("/api/onboarding/admin/workspace/sync", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not sync with the Workspace.");
      return;
    }
    setResult(data as SyncResult);
    onSynced();
  }

  return (
    <Card className="mt-5">
      <SectionTitle
        title="Focus Realm Workspace"
        lead="Everyone added here gets a Workspace login: an employee ID like FR-0042 and a temporary password, shown once on their record. This gives one to everyone who does not have one yet, such as people added before the Workspace was connected. Anyone already linked is skipped, so it is safe to run again."
      />
      <div className="space-y-4">
        <Button disabled={busy} onClick={sync}>
          <KeyRound className="size-4" aria-hidden />
          {busy ? "Syncing…" : "Sync everyone to the Workspace"}
        </Button>

        {message && <Notice tone="bad">{message}</Notice>}

        {result && (
          <>
            <Notice tone={result.failed.length > 0 ? "warn" : "good"}>
              {result.synced} new login{result.synced === 1 ? "" : "s"} · {result.alreadyLinked} already
              linked · {result.failed.length} failed
              {result.skipped > 0
                ? ` · ${result.skipped} removed ${result.skipped === 1 ? "person" : "people"} left out`
                : ""}
              .
              {result.synced > 0 &&
                " Open a person's record to reveal their temporary password, or let them collect it on their own page."}
            </Notice>

            {result.failed.length > 0 && (
              <ul className="space-y-2">
                {result.failed.map((failure) => (
                  <li
                    key={failure.id}
                    className="rounded-xl border p-3 text-sm"
                    style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
                  >
                    <Link href={`/hr/admin/${failure.id}`} className="font-bold hover:underline">
                      {failure.name}
                    </Link>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--fr-muted)" }}>
                      {failure.error}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
