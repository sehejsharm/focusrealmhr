"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Award, Check, Copy, Download, ExternalLink, FileWarning, LogOut, Mail, RotateCcw, Upload, UserMinus, X } from "lucide-react";
import ContractDocument from "@/components/onboarding/ContractDocument";
import {
  Button,
  Card,
  Field,
  Notice,
  SectionTitle,
  Wordmark,
  formatDate,
  formatDateTime,
  inputClass,
  inputStyle,
} from "@/components/onboarding/ui";
import type { Contract } from "@/lib/onboarding/contract";
import {
  DEFAULT_TERM_MONTHS,
  STAGE_LABEL,
  trackOf,
  type Candidate,
  type Stage,
} from "@/lib/onboarding/types";
import type { Company } from "@/lib/onboarding/types";
import { COMPANIES, companyLabel } from "@/lib/onboarding/content";
import {
  CERTIFICATE_KINDS,
  CERTIFICATE_LABEL,
  CERTIFICATE_WINDOW_DAYS,
  activeCertificate,
  draftCertificate,
} from "@/lib/onboarding/certificates";
import { formatLongDate } from "@/lib/onboarding/contract";
import type { CertificateKind, CertificateText, CertificateWindow } from "@/lib/onboarding/types";
import { EXIT_QUESTIONS, OFFBOARDING_LINK_DAYS_BEFORE_END, type OffboardingState } from "@/lib/onboarding/offboarding";

interface AdminCandidate extends Omit<Candidate, "mailbox" | "companies"> {
  stage: Stage;
  /** Resolved by the API — records predating the choice come back as both. */
  companies: Company[];
  aadhaarFormatted: string | null;
  contract: Contract | null;
  mailbox: {
    address: string;
    provisionedAt: string;
    viewedAt: string | null;
    collected: boolean;
  } | null;
  retention: { kind: "keep" | "erase"; until: string } | null;
  certificateWindow: CertificateWindow;
  offboardingState: OffboardingState;
  /** Path of the offboarding link, once it can be sent. */
  offboardingLink: string | null;
}

/** One candidate: their documents, and the decisions only a founder can make. */
export default function AdminCandidatePage() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<AdminCandidate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ address: string; password: string } | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/onboarding/admin/candidates/${id}`)
        .then(async (response) => {
          if (response.ok) setCandidate((await response.json()) as AdminCandidate);
        })
        .catch(() => {}),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function act(payload: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch(`/api/onboarding/admin/candidates/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not complete that.");
      return null;
    }
    await load();
    return data;
  }

  if (!candidate) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <p style={{ color: "var(--fr-muted)" }}>Loading…</p>
      </div>
    );
  }

  const { details } = candidate;
  // A removed intern's record is read-only until restored.
  const frozen = Boolean(candidate.removal);
  const consent = details?.consent ?? null;
  const termMonths = candidate.termMonths || DEFAULT_TERM_MONTHS;
  const endDate = (() => {
    const end = new Date(candidate.startDate);
    end.setUTCMonth(end.getUTCMonth() + termMonths);
    return end.toISOString();
  })();
  const plan = candidate.agreement ?? { kind: "standard" as const };
  const bespokeDocument = plan.kind === "bespoke" ? plan.document : undefined;
  const accessLog = candidate.aadhaarAccess ?? [];

  // At the end of a term the documents are the thing to act on, so they move
  // up from the bottom of the page, above the full agreement text.
  const certificatesFirst =
    Boolean(candidate.offboardingLink) ||
    candidate.certificateWindow.status === "open" ||
    CERTIFICATE_KINDS.some((kind) => activeCertificate(candidate, kind));
  const certificates = (
    <>
    <Offboarding
      name={details?.fullName ?? candidate.invitedName}
      state={candidate.offboardingState}
      link={candidate.offboardingLink}
      submission={candidate.offboarding ?? null}
    />
    <Certificates
      id={id}
      candidate={candidate}
      frozen={frozen}
      onIssue={(kind, fields) => act({ action: "issue-certificate", kind, ...fields })}
      onWithdraw={(kind, reason) => act({ action: "withdraw-certificate", kind, reason })}
      onDecline={(kind) => act({ action: "decline-certificate", kind })}
      onUndoDecline={(kind) => act({ action: "undo-decline", kind })}
    />
    </>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Wordmark subtitle="HR console" href="/hr/admin" />
        <Link
          href="/hr/admin"
          className="inline-flex min-h-10 items-center gap-2 text-sm font-bold"
          style={{ color: "var(--fr-muted)" }}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Everyone
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl leading-tight font-bold text-balance">
          {details?.fullName ?? candidate.invitedName}
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--fr-muted)" }}>
          {trackOf(candidate).label} · {termMonths}-month term · {formatDate(candidate.startDate)}{" "}
          → {formatDate(endDate)} · currently at{" "}
          <span style={{ color: "var(--fr-gold-soft)" }}>{STAGE_LABEL[candidate.stage]}</span>
        </p>
      </header>

      {candidate.removal && (
        <RemovedBanner
          leftOn={candidate.removal.leftOn}
          reason={candidate.removal.reason}
          retention={candidate.retention}
          mailbox={candidate.mailbox?.address ?? null}
          onRestore={() => act({ action: "restore" })}
        />
      )}

      {message && (
        <div className="mb-5">
          <Notice tone="bad">{message}</Notice>
        </div>
      )}

      <div className="space-y-5">
        {!frozen && (
          <PortalAccess
            token={candidate.token}
            existing={Boolean(candidate.existing)}
          />
        )}

        {certificatesFirst && certificates}

        {candidate.existing ? (
          <Card>
            <SectionTitle
              title="Existing employee"
              lead={`Added directly on ${formatDate(candidate.existing.addedAt)}, as someone already onboarded before this console existed. They skip onboarding — their link opens the employee portal — and no details, assessments or agreement were collected here; those live wherever you kept them.`}
            />
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Personal email" value={candidate.invitedEmail} />
              <Detail label="Company email" value={candidate.mailbox?.address ?? "—"} />
              <Detail
                label="Works with"
                value={candidate.companies.map(companyLabel).join(" and ")}
              />
              {candidate.existing.note && <Detail label="Note" value={candidate.existing.note} />}
            </dl>
          </Card>
        ) : (
          <>
        <Card>
          <SectionTitle
            title="Agreement for this role"
            lead={
              plan.kind === "standard"
                ? `The standard agreement, issued with this candidate's role title, duties and ${termMonths}-month term written in.`
                : "A document you supply for this role. The candidate cannot sign until it is uploaded."
            }
          />

          {plan.kind === "standard" ? (
            <Notice tone="good">
              Ready to sign. Every clause matches the Founder&apos;s Office agreement —
              only the role title, the duties and the term differ.
            </Notice>
          ) : bespokeDocument ? (
            <div className="space-y-4">
              <Notice tone="good">
                Uploaded{plan.uploadedAt ? ` ${formatDateTime(plan.uploadedAt)}` : ""} —
                the candidate can sign against it.
              </Notice>
              <a
                href={`/api/onboarding/admin/candidates/${id}/agreement`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold"
                style={{
                  backgroundColor: "var(--fr-navy-soft)",
                  border: "1px solid var(--fr-line)",
                  color: "var(--fr-paper)",
                }}
              >
                Open {bespokeDocument.originalName}
                <ExternalLink className="size-4" aria-hidden />
              </a>
              {!candidate.signature && !frozen && (
                <AgreementUpload id={id} onDone={load} replacing />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Notice tone="warn">
                <span className="inline-flex items-center gap-2 font-bold">
                  <FileWarning className="size-4" aria-hidden />
                  Action needed
                </span>
                <span className="mt-1 block">
                  This candidate is set to sign a role-specific agreement, and none has
                  been uploaded. Upload the agreement — or the job description the
                  agreement is drawn from — before they finish the assessments.
                </span>
              </Notice>
              {!frozen && <AgreementUpload id={id} onDone={load} />}
            </div>
          )}
        </Card>

        {details ? (
          <Card>
            <SectionTitle
              title="Submitted details"
              lead={`Received ${formatDateTime(details.submittedAt)}.`}
            />
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Full name" value={details.fullName} />
              <Detail label="Son / daughter of" value={details.parentName} />
              <Detail label="Aadhaar number" value={candidate.aadhaarFormatted ?? "—"} />
              <Detail label="Phone" value={details.phone} />
              <Detail label="Email" value={details.personalEmail} />
              <div className="sm:col-span-2">
                <Detail label="Address" value={details.address} />
              </div>
            </dl>

            {consent && (
              <div
                className="mt-5 rounded-xl border p-4"
                style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
              >
                <p
                  className="text-xs font-bold tracking-[0.16em] uppercase"
                  style={{ color: "var(--fr-gold)" }}
                >
                  Consent on record
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
                  Notice version {consent.noticeVersion}, accepted{" "}
                  {formatDateTime(consent.at)}
                  {consent.ip ? ` from ${consent.ip}` : ""}.
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {consent.acceptedItems.map((item) => (
                    <li
                      key={item}
                      className="rounded-md px-2 py-0.5 font-mono text-[11px]"
                      style={{ backgroundColor: "var(--fr-navy-soft)", color: "var(--fr-muted)" }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {details.aadhaarFile && (
              <p
                className="mt-5 rounded-xl px-4 py-3 text-xs leading-relaxed"
                style={{ backgroundColor: "rgba(201,162,39,0.10)", color: "var(--fr-muted)" }}
              >
                Opening this identity document is recorded against the candidate&apos;s record
                with the time and your IP address. Open it only to verify identity or to
                prepare the agreement — never download, forward or store a copy elsewhere.
                {accessLog.length > 0 && (
                  <>
                    {" "}
                    Opened {accessLog.length} time{accessLog.length === 1 ? "" : "s"} so far,
                    most recently {formatDateTime(accessLog[accessLog.length - 1].at)}.
                  </>
                )}
              </p>
            )}

            {details.aadhaarFile && (
              <a
                href={`/api/onboarding/admin/candidates/${id}/aadhaar`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold"
                style={{
                  backgroundColor: "var(--fr-navy-soft)",
                  border: "1px solid var(--fr-line)",
                  color: "var(--fr-paper)",
                }}
              >
                Open Aadhaar copy ({details.aadhaarFile.originalName})
                <ExternalLink className="size-4" aria-hidden />
              </a>
            )}
          </Card>
        ) : (
          <Card>
            <SectionTitle title="Submitted details" />
            <Notice>Nothing submitted yet.</Notice>
          </Card>
        )}

        <Card>
          <SectionTitle
            title="Onboarding into"
            lead={`${candidate.companies.map(companyLabel).join(" and ")}. Each company's handbook, video and assessment is required; the pass mark is 75% on each assessment, judged separately.`}
          />
          <ul className="space-y-2">
            {COMPANIES.filter((c) => candidate.companies.includes(c.id)).map((company) => {
              const attempts = candidate.tests[company.testId] ?? [];
              const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
              const passed = attempts.some((a) => a.passed);
              return (
                <li key={company.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="font-bold">{company.label} assessment</span>
                  <span style={{ color: passed ? "var(--fr-gold-soft)" : "var(--fr-muted)" }}>
                    {attempts.length === 0
                      ? "not attempted yet"
                      : `${attempts.length} attempt${attempts.length === 1 ? "" : "s"} · best ${best}% · ${passed ? "passed" : "not passed"}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
          </>
        )}

        {candidate.signature && (
          <>
            <Card>
              <SectionTitle
                title="Signed agreement"
                lead={`Signed by ${candidate.signature.typedName} on ${formatDateTime(
                  candidate.signature.signedAt,
                )}${candidate.signature.ip ? ` from ${candidate.signature.ip}` : ""}.`}
              />

              {candidate.companySignature ? (
                <Notice tone="good">
                  Countersigned by {candidate.companySignature.typedName},{" "}
                  {candidate.companySignature.designation}, on{" "}
                  {formatDateTime(candidate.companySignature.signedAt)}. Fully executed.
                </Notice>
              ) : frozen ? null : (
                <CountersignActions
                  alreadyVerified={Boolean(candidate.contractVerifiedAt)}
                  onCountersign={(typedName, designation) =>
                    act({ action: "countersign", typedName, designation })
                  }
                  onReject={(note) => act({ action: "reject", note })}
                />
              )}

              {candidate.contract && (
                <a
                  href={`/api/onboarding/admin/candidates/${id}/contract/pdf`}
                  className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold"
                  style={{
                    backgroundColor: "var(--fr-navy-soft)",
                    border: "1px solid var(--fr-line)",
                    color: "var(--fr-paper)",
                  }}
                >
                  <Download className="size-4" aria-hidden />
                  Download agreement (PDF)
                </a>
              )}
            </Card>

            {candidate.contract && (
              <ContractDocument
                contract={candidate.contract}
                signature={candidate.signature}
                companySignature={candidate.companySignature}
              />
            )}
          </>
        )}

        {candidate.contractVerifiedAt && (
          <Card>
            <SectionTitle
              title="Company mailbox"
              lead={
                candidate.emailRequestedAt
                  ? `Requested ${formatDateTime(candidate.emailRequestedAt)}.`
                  : "The candidate has not requested one yet."
              }
            />

            {/* `issued` wins over the refreshed record — this is the only time
                the operator gets to see the password they must set. */}
            {issued ? (
              <div className="space-y-3">
                <Notice tone="good">
                  Recorded. Create this mailbox in SpaceMail with exactly this password — the
                  candidate sees it once, on their own page.
                </Notice>
                <dl className="space-y-2 text-sm">
                  <Detail label="Address" value={issued.address} />
                  <Detail label="Password" value={issued.password} />
                </dl>
              </div>
            ) : candidate.mailbox ? (
              <div className="space-y-2 text-sm">
                <p className="font-bold">{candidate.mailbox.address}</p>
                <p style={{ color: "var(--fr-muted)" }}>
                  Created {formatDateTime(candidate.mailbox.provisionedAt)} ·{" "}
                  {candidate.mailbox.collected
                    ? `password collected${
                        candidate.mailbox.viewedAt
                          ? ` ${formatDateTime(candidate.mailbox.viewedAt)}`
                          : ""
                      }`
                    : "password not yet collected"}
                </p>
              </div>
            ) : frozen ? (
              <p className="text-sm" style={{ color: "var(--fr-muted)" }}>
                No mailbox was created before they were removed.
              </p>
            ) : (
              <ProvisionForm
                onSubmit={async (address, password) => {
                  const data = await act({ action: "provision", address, password });
                  if (data) setIssued({ address: data.address, password: data.password });
                }}
              />
            )}
          </Card>
        )}

        {!certificatesFirst && certificates}

        {!frozen && (
          <RemoveIntern
            name={details?.fullName ?? candidate.invitedName}
            mailbox={candidate.mailbox?.address ?? null}
            onRemove={(leftOn, reason) => act({ action: "remove", leftOn, reason })}
          />
        )}
      </div>
    </div>
  );
}

/** Shown at the top of a removed intern's page. */
function RemovedBanner({
  leftOn,
  reason,
  retention,
  mailbox,
  onRestore,
}: {
  leftOn: string;
  reason?: string;
  retention: { kind: "keep" | "erase"; until: string } | null;
  mailbox: string | null;
  onRestore: () => void;
}) {
  return (
    <div className="mb-5 space-y-3">
      <Notice tone="warn">
        <span className="block font-bold">Removed — left on {formatDate(leftOn)}.</span>
        {reason && <span className="mt-1 block">Reason: {reason}</span>}
        <span className="mt-1 block">
          Any onboarding link no longer works, and nothing on this record can be changed. The
          record itself is kept:{" "}
          {retention?.kind === "keep"
            ? `their internship went ahead, so the privacy notice commits to keeping it until ${formatDate(retention.until)} (three years after they left), then erasing it.`
            : retention
              ? `their internship never began, so the privacy notice commits to erasing it by ${formatDate(retention.until)} (within 90 days).`
              : "see the privacy notice for how long."}
        </span>
        {mailbox && (
          <span className="mt-1 block font-bold">
            Disable {mailbox} in SpaceMail — this console cannot do that for you.
          </span>
        )}
      </Notice>
      <Button variant="ghost" onClick={onRestore}>
        <RotateCcw className="size-4" aria-hidden />
        Restore to the team
      </Button>
    </div>
  );
}

/** Ends an engagement early. Records are kept — this is not a delete. */
function RemoveIntern({
  name,
  mailbox,
  onRemove,
}: {
  name: string;
  mailbox: string | null;
  onRemove: (leftOn: string, reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [leftOn, setLeftOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  return (
    <Card>
      <SectionTitle
        title="Remove from the team"
        lead="For an intern or employee who leaves, or a candidate who stops before starting. Any onboarding link stops working and they leave the active list. Nothing is deleted, and you can restore them."
      />

      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}>
          <UserMinus className="size-4" aria-hidden />
          Remove from the team
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date they left">
              <input
                type="date"
                value={leftOn}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setLeftOn(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <Field label="Reason" hint="Optional. Only founders see this.">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="e.g. Left for a full-time role"
                className={inputClass}
                style={inputStyle}
              />
            </Field>
          </div>

          {mailbox && (
            <Notice tone="warn">
              They have a company mailbox, {mailbox}. Removing them here does not touch SpaceMail —
              disable it there too.
            </Notice>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              disabled={!leftOn}
              onClick={() => onRemove(leftOn, reason.trim())}
            >
              Remove {name}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function CountersignActions({
  alreadyVerified,
  onCountersign,
  onReject,
}: {
  alreadyVerified: boolean;
  onCountersign: (typedName: string, designation: string) => void;
  onReject: (note: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [typedName, setTypedName] = useState("");
  const [designation, setDesignation] = useState("Authorized Signatory");

  if (rejecting) {
    return (
      <div className="space-y-4">
        <Field label="What needs correcting?" hint="The candidate sees this, and signs again after fixing it.">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
            style={inputStyle}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button variant="danger" disabled={!note.trim()} onClick={() => onReject(note.trim())}>
            Send back
          </Button>
          <Button variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alreadyVerified && (
        <Notice tone="warn">
          Verified earlier, before countersigning existed. Sign below to complete the company side —
          it will not disturb anything the intern has already done.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Signatory's full name" hint="Whoever signs for FocusRealm.">
          <input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Sehej Sharma"
            className={inputClass}
            style={inputStyle}
            autoComplete="off"
          />
        </Field>
        <Field label="Designation">
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
      </div>

      <p className="text-xs" style={{ color: "var(--fr-muted)" }}>
        Typing the name is the company&apos;s electronic signature. It is recorded with the time and
        IP address, and cannot be undone — the agreement becomes fully executed.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={!typedName.trim() || !designation.trim()}
          onClick={() => onCountersign(typedName.trim(), designation.trim())}
        >
          <Check className="size-4" aria-hidden />
          Countersign for FocusRealm
        </Button>
        {!alreadyVerified && (
          <Button variant="ghost" onClick={() => setRejecting(true)}>
            <X className="size-4" aria-hidden />
            Send back for correction
          </Button>
        )}
      </div>
    </div>
  );
}

function ProvisionForm({
  onSubmit,
}: {
  onSubmit: (address: string, password: string) => void;
}) {
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-4">
      <Field label="Mailbox address" hint="The address you are creating on SpaceMail.">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="firstname@focusrealm.org"
          className={inputClass}
          style={inputStyle}
        />
      </Field>
      <Field
        label="Temporary password"
        hint="Leave blank to have one generated. Whatever is here must match what you set in SpaceMail."
      >
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          style={inputStyle}
          autoComplete="off"
        />
      </Field>
      <Button disabled={!address.trim()} onClick={() => onSubmit(address.trim(), password.trim())}>
        <Mail className="size-4" aria-hidden />
        Record mailbox and release to candidate
      </Button>
    </div>
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

/** Uploads the agreement or job description for a role the template misses. */
function AgreementUpload({
  id,
  onDone,
  replacing,
}: {
  id: string;
  onDone: () => void;
  replacing?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/onboarding/admin/candidates/${id}/agreement`, {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not upload that.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field
        label={replacing ? "Replace the document" : "Agreement or job description"}
        hint="PDF or Word, up to 12 MB. Stored privately, alongside identity documents."
      >
        <div
          className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-4"
          style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
        >
          <Upload className="size-5 shrink-0" style={{ color: "var(--fr-gold)" }} aria-hidden />
          <input
            name="document"
            type="file"
            required
            accept="application/pdf,.doc,.docx"
            className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--fr-navy-soft)] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[var(--fr-paper)]"
          />
        </div>
      </Field>

      {message && <Notice tone="bad">{message}</Notice>}

      <Button type="submit" disabled={busy}>
        {busy ? "Uploading…" : replacing ? "Replace document" : "Upload agreement"}
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Portal link                                                                */
/* -------------------------------------------------------------------------- */

function PortalAccess({ token, existing }: { token: string; existing: boolean }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <Card>
      <SectionTitle
        title={existing ? "Portal link" : "Onboarding and portal link"}
        lead={
          existing
            ? "Their personal link to the employee portal. There are no passwords — anyone holding it can open their record, so send it only to them."
            : "Their personal link — onboarding while that is in progress, then their employee portal. There are no passwords — anyone holding it can open their record, so send it only to them."
        }
      />
      <CopyableLink link={`${origin}/hr/${token}`} />
    </Card>
  );
}

function CopyableLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      <p
        className="mb-3 rounded-xl border p-3 font-mono text-xs break-all"
        style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
      >
        {link}
      </p>
      <Button
        variant="ghost"
        onClick={() => {
          navigator.clipboard?.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy className="size-4" aria-hidden />
        {copied ? "Copied" : "Copy link"}
      </Button>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Offboarding                                                                */
/* -------------------------------------------------------------------------- */

function Offboarding({
  name,
  state,
  link,
  submission,
}: {
  name: string;
  state: OffboardingState;
  link: string | null;
  submission: { submittedAt: string; answers: Record<string, string> } | null;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const opensOn = "opensAt" in state ? formatDate(state.opensAt) : "";

  return (
    <Card>
      <SectionTitle
        title="Offboarding"
        lead={`${OFFBOARDING_LINK_DAYS_BEFORE_END} days before the last day, a personal offboarding link appears here to send to ${name}. It opens the day after their last day: a few exit questions, then the documents you approved below.`}
      />

      {state.status === "not-eligible" && <Notice>{state.reason}</Notice>}

      {state.status === "not-yet" && (
        <Notice>
          The link appears on {formatDate(state.linkFrom)}, and {name} can use it from{" "}
          {formatDate(state.opensAt)}.
        </Notice>
      )}

      {link && state.status !== "done" && (
        <div className="space-y-3">
          <Notice tone={state.status === "open" ? "good" : "warn"}>
            <span className="inline-flex items-center gap-2 font-bold">
              <LogOut className="size-4" aria-hidden />
              {state.status === "open" ? "Open now — waiting for them" : "Ready to send"}
            </span>
            <span className="mt-1 block">
              {state.status === "open"
                ? `${name} can offboard now. They have not answered the exit questions yet.`
                : `Send it now. It opens for ${name} on ${opensOn}, the day after their last day; before that it just says when to come back.`}
            </span>
          </Notice>
          <CopyableLink link={`${origin}${link}`} />
        </div>
      )}

      {submission && (
        <div className="space-y-4">
          <Notice tone="good">Offboarded {formatDateTime(submission.submittedAt)}.</Notice>
          <dl className="space-y-4">
            {EXIT_QUESTIONS.map((question) => (
              <div key={question.id}>
                <dt className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fr-muted)" }}>
                  {question.label}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed whitespace-pre-line break-words">
                  {submission.answers[question.id]
                    ? question.kind === "scale"
                      ? `${submission.answers[question.id]} / 5`
                      : submission.answers[question.id]
                    : "—"}
                </dd>
              </div>
            ))}
          </dl>
          {link && (
            <div>
              <p className="mb-2 text-xs" style={{ color: "var(--fr-muted)" }}>
                Their link keeps working, so they can download their documents again — including
                any you approve from here on.
              </p>
              <CopyableLink link={`${origin}${link}`} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* End-of-internship documents                                                */
/* -------------------------------------------------------------------------- */

type IssueFields = {
  typedName: string;
  designation: string;
  highlights?: string;
  contactEmail?: string;
};

function Certificates({
  id,
  candidate,
  frozen,
  onIssue,
  onWithdraw,
  onDecline,
  onUndoDecline,
}: {
  id: string;
  candidate: AdminCandidate;
  frozen: boolean;
  onIssue: (kind: CertificateKind, fields: IssueFields) => Promise<unknown>;
  onWithdraw: (kind: CertificateKind, reason: string) => Promise<unknown>;
  onDecline: (kind: CertificateKind) => Promise<unknown>;
  onUndoDecline: (kind: CertificateKind) => Promise<unknown>;
}) {
  const timing = candidate.certificateWindow;
  const history = (candidate.certificates ?? []).filter((c) => c.withdrawn);
  const anyIssued = CERTIFICATE_KINDS.some((kind) => activeCertificate(candidate, kind));

  return (
    <Card>
      <SectionTitle
        title="Completion certificate and recommendation letter"
        lead={`Drafted automatically from this record in the last ${CERTIFICATE_WINDOW_DAYS} days of the term. Nothing is issued until a founder approves it — each document separately — and you can decide not to issue one. The intern downloads what you approve at the end of offboarding.`}
      />

      {timing.status === "not-eligible" && !anyIssued && <Notice>{timing.reason}</Notice>}
      {timing.status === "not-yet" && !anyIssued && (
        <Notice>
          Drafts open on {formatDate(timing.opensOn)} — {CERTIFICATE_WINDOW_DAYS} days before the
          term ends. They will be flagged on the dashboard then.
        </Notice>
      )}

      {(timing.status === "open" || anyIssued) && (
        <div className="space-y-5">
          {CERTIFICATE_KINDS.map((kind) => (
            <CertificatePanel
              key={kind}
              id={id}
              kind={kind}
              candidate={candidate}
              canIssue={timing.status === "open" && !frozen}
              frozen={frozen}
              onIssue={(fields) => onIssue(kind, fields)}
              onWithdraw={(reason) => onWithdraw(kind, reason)}
              onDecline={() => onDecline(kind)}
              onUndoDecline={() => onUndoDecline(kind)}
            />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-5 border-t pt-4 fr-rule">
          <p className="mb-2 text-xs font-bold tracking-wide uppercase" style={{ color: "var(--fr-muted)" }}>
            Withdrawn
          </p>
          <ul className="space-y-1.5 text-xs" style={{ color: "var(--fr-muted)" }}>
            {history.map((cert) => (
              <li key={cert.serial}>
                {CERTIFICATE_LABEL[cert.kind]} {cert.serial}, issued {formatDate(cert.issuedAt)} by{" "}
                {cert.approvedBy.typedName} — withdrawn {formatDate(cert.withdrawn!.at)}:{" "}
                {cert.withdrawn!.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function CertificatePanel({
  id,
  kind,
  candidate,
  canIssue,
  frozen,
  onIssue,
  onWithdraw,
  onDecline,
  onUndoDecline,
}: {
  id: string;
  kind: CertificateKind;
  candidate: AdminCandidate;
  canIssue: boolean;
  frozen: boolean;
  onIssue: (fields: IssueFields) => Promise<unknown>;
  onWithdraw: (reason: string) => Promise<unknown>;
  onDecline: () => Promise<unknown>;
  onUndoDecline: () => Promise<unknown>;
}) {
  const issued = activeCertificate(candidate, kind);
  const name = candidate.details?.fullName ?? candidate.invitedName;

  const [typedName, setTypedName] = useState("");
  const [designation, setDesignation] = useState("Co-founder");
  const [highlights, setHighlights] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");

  const box = {
    borderColor: "var(--fr-line)",
    backgroundColor: "var(--fr-navy-deep)",
  } as const;

  if (issued) {
    return (
      <div className="space-y-3 rounded-xl border p-4" style={box}>
        <p className="flex items-center gap-2 text-sm font-bold">
          <Award className="size-4" style={{ color: "var(--fr-gold)" }} aria-hidden />
          {CERTIFICATE_LABEL[kind]}
        </p>
        <Notice tone="good">
          Approved by {issued.approvedBy.typedName}, {issued.approvedBy.designation}, on{" "}
          {formatDateTime(issued.issuedAt)} · {issued.serial}. {name} downloads it at the end of
          offboarding.
        </Notice>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/onboarding/admin/candidates/${id}/certificates/${kind}/pdf`}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold"
            style={{
              backgroundColor: "var(--fr-navy-soft)",
              border: "1px solid var(--fr-line)",
              color: "var(--fr-paper)",
            }}
          >
            <Download className="size-4" aria-hidden />
            Download PDF
          </a>
          {!frozen && !withdrawing && (
            <Button variant="ghost" onClick={() => setWithdrawing(true)}>
              Withdraw
            </Button>
          )}
        </div>
        {withdrawing && (
          <div className="space-y-3">
            <Field label="Why is it being withdrawn?" hint="Kept on the record. They can no longer download it; you can issue a corrected one.">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={!reason.trim() || busy}
                onClick={async () => {
                  setBusy(true);
                  await onWithdraw(reason.trim());
                  setBusy(false);
                  setWithdrawing(false);
                  setReason("");
                }}
              >
                Withdraw {kind === "completion" ? "certificate" : "letter"}
              </Button>
              <Button variant="ghost" onClick={() => setWithdrawing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if ((candidate.declinedCertificates ?? []).includes(kind)) {
    return (
      <div className="space-y-3 rounded-xl border p-4 text-sm" style={box}>
        <p className="font-bold">{CERTIFICATE_LABEL[kind]}</p>
        <p style={{ color: "var(--fr-muted)" }}>
          Not issuing — {name} will not see this document at offboarding.
        </p>
        {!frozen && (
          <Button variant="ghost" disabled={busy} onClick={async () => {
            setBusy(true);
            await onUndoDecline();
            setBusy(false);
          }}>
            <RotateCcw className="size-4" aria-hidden />
            Undo
          </Button>
        )}
      </div>
    );
  }

  if (!canIssue) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={box}>
        <p className="font-bold">{CERTIFICATE_LABEL[kind]}</p>
        <p className="mt-1" style={{ color: "var(--fr-muted)" }}>
          Not issued.
        </p>
      </div>
    );
  }

  // The live draft, exactly as it would be frozen if approved now.
  const preview = draftCertificate(candidate as unknown as Candidate, kind, {
    signatory: {
      name: typedName.trim() || "Founder's name",
      designation: designation.trim() || "Designation",
      contactEmail: contactEmail.trim() || undefined,
    },
    highlights,
    issuedOn: new Date().toISOString(),
    serial: "assigned on approval",
  });

  const ready = typedName.trim() && designation.trim() && approved && !busy;

  return (
    <div className="space-y-4 rounded-xl border p-4" style={box}>
      <p className="flex items-center gap-2 text-sm font-bold">
        <Award className="size-4" style={{ color: "var(--fr-gold)" }} aria-hidden />
        {CERTIFICATE_LABEL[kind]} — ready for approval
      </p>

      <CertificatePreview text={preview} />

      {kind === "recommendation" && (
        <div className="grid gap-4">
          <Field
            label="A few words of your own"
            hint="Optional, but it is what makes a recommendation worth reading: something specific they did well. Printed as its own paragraph."
          >
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              rows={3}
              maxLength={1200}
              className={`${inputClass} resize-y`}
              style={inputStyle}
            />
          </Field>
          <Field label="Contact email for referees" hint="Optional. Printed so a future employer can reach you.">
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              type="email"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Approving founder's full name" hint="Printed as the signature.">
          <input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            className={inputClass}
            style={inputStyle}
            autoComplete="off"
          />
        </Field>
        <Field label="Designation">
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm leading-snug">
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => setApproved(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--fr-gold)]"
        />
        <span>
          I have read this {kind === "completion" ? "certificate" : "letter"} and approve issuing it
          to {name} on behalf of Focus Realm.
        </span>
      </label>

      <Button
        disabled={!ready}
        onClick={async () => {
          setBusy(true);
          await onIssue({
            typedName: typedName.trim(),
            designation: designation.trim(),
            highlights: kind === "recommendation" ? highlights.trim() || undefined : undefined,
            contactEmail: kind === "recommendation" ? contactEmail.trim() || undefined : undefined,
          });
          setBusy(false);
        }}
      >
        <Check className="size-4" aria-hidden />
        {busy ? "Issuing…" : `Approve and issue ${kind === "completion" ? "certificate" : "letter"}`}
      </Button>
      <Button
        variant="ghost"
        className="ml-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onDecline();
          setBusy(false);
        }}
      >
        <X className="size-4" aria-hidden />
        Not issuing this
      </Button>
    </div>
  );
}

/** A paper-like rendering of the draft, so founders approve what will be printed. */
function CertificatePreview({ text }: { text: CertificateText }) {
  const issued = formatLongDate(new Date(text.issuedOn));

  return (
    <div
      className="max-h-96 overflow-y-auto rounded-lg p-5 text-sm leading-relaxed sm:p-6"
      style={{ backgroundColor: "#fbfaf6", color: "#1f1f1f", fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      {text.kind === "completion" ? (
        <div className="text-center">
          <p className="text-[10px] font-bold tracking-[0.3em]" style={{ color: "#b8962f", fontFamily: "var(--font-inter), sans-serif" }}>
            FOCUS REALM
          </p>
          <p className="mt-2 text-xl font-bold" style={{ color: "#122a2e" }}>
            {text.title}
          </p>
          <p className="mt-2 italic" style={{ color: "#6b6b6b" }}>
            This is to certify that
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "#122a2e" }}>
            {text.recipientName}
          </p>
          {text.paragraphs.map((p, i) => (
            <p key={i} className="mt-2">
              {p}
            </p>
          ))}
          <p className="mt-4 text-xs" style={{ color: "#6b6b6b" }}>
            {text.signatory.name}, {text.signatory.designation} · Date of issue {issued} · No.{" "}
            {text.serial}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs" style={{ color: "#6b6b6b" }}>
            {issued} · Ref. {text.serial}
          </p>
          <p className="mt-2 text-lg font-bold" style={{ color: "#122a2e" }}>
            {text.title}
          </p>
          {text.salutation && <p className="mt-3">{text.salutation}</p>}
          {text.paragraphs.map((p, i) => (
            <p key={i} className="mt-3 whitespace-pre-line">
              {p}
            </p>
          ))}
          {text.closing && <p className="mt-4">{text.closing}</p>}
          <p className="mt-2 font-bold">{text.signatory.name}</p>
          <p>{text.signatory.designation}, Focus Realm</p>
          {text.signatory.contactEmail && <p style={{ color: "#6b6b6b" }}>{text.signatory.contactEmail}</p>}
        </div>
      )}
    </div>
  );
}
