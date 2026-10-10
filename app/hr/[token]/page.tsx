"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Award, CalendarDays, ChevronDown, Download, FileText, PartyPopper } from "lucide-react";
import ContractStage from "@/components/onboarding/ContractStage";
import DetailsStage from "@/components/onboarding/DetailsStage";
import LearningStage from "@/components/onboarding/LearningStage";
import MailboxStage from "@/components/onboarding/MailboxStage";
import StageRail from "@/components/onboarding/StageRail";
import TestsStage from "@/components/onboarding/TestsStage";
import WorkspaceAccess from "@/components/onboarding/WorkspaceAccess";
import { Card, Notice, SectionTitle, Wordmark, formatDate } from "@/components/onboarding/ui";
import { companyLabel } from "@/lib/onboarding/content";
import { stageIndex } from "@/lib/onboarding/stage";
import { type CandidateView } from "@/lib/onboarding/types";

const DAY = 86_400_000;

/** Whole days from now until `iso` — negative once it has passed. */
function daysFromNow(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
}

/**
 * One person's page, behind the token in their link: their onboarding while it
 * is in progress, then their employee portal.
 */
export default function EmployeePortal() {
  const { token } = useParams<{ token: string }>();
  const [candidate, setCandidate] = useState<CandidateView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/onboarding/session/${token}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState("invalid");
          return;
        }
        setCandidate((await response.json()) as CandidateView);
        setState("ready");
      })
      .catch(() => !cancelled && setState("invalid"));

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSaved = useCallback((next: CandidateView) => setCandidate(next), []);

  if (state === "loading") {
    return (
      <Shell>
        <p style={{ color: "var(--fr-muted)" }}>Loading…</p>
      </Shell>
    );
  }

  if (state === "invalid" || !candidate) {
    return (
      <Shell>
        <Card>
          <SectionTitle
            title="This link is not valid"
            lead="It may have been mistyped, or withdrawn. Check the link you were sent, or reply to the email it came from."
          />
          <Link href="/hr" className="text-sm font-bold underline" style={{ color: "var(--fr-gold-soft)" }}>
            Go to sign-in
          </Link>
        </Card>
      </Shell>
    );
  }

  return candidate.stage === "complete" ? (
    <EmployeeHome token={token} candidate={candidate} onSaved={onSaved} />
  ) : (
    <Onboarding token={token} candidate={candidate} onSaved={onSaved} />
  );
}

/* -------------------------------------------------------------------------- */
/* Onboarding — while it is in progress                                       */
/* -------------------------------------------------------------------------- */

function Onboarding({
  token,
  candidate,
  onSaved,
}: {
  token: string;
  candidate: CandidateView;
  onSaved: (next: CandidateView) => void;
}) {
  const at = stageIndex(candidate.stage);

  return (
    <Shell subtitle={`${candidate.role.label} internship`} home={`/hr/${token}`}>
      <header className="mb-6">
        <h1 className="text-2xl leading-tight font-bold text-balance sm:text-3xl">
          Welcome, {candidate.details?.fullName ?? candidate.invitedName}.
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fr-muted)" }}>
          Six steps between here and your first day, starting {formatDate(candidate.startDate)}.
          Your progress is saved as you go — you can close this and come back to the same link.
        </p>
      </header>

      <div className="mb-8">
        <StageRail stage={candidate.stage} />
      </div>

      <div className="space-y-5">
        <DetailsStage token={token} candidate={candidate} onSaved={onSaved} />
        <LearningStage token={token} candidate={candidate} onSaved={onSaved} locked={at < 1} />
        <TestsStage token={token} candidate={candidate} onSaved={onSaved} locked={at < 2} />
        <ContractStage token={token} candidate={candidate} onSaved={onSaved} locked={at < 3} />
        <MailboxStage token={token} candidate={candidate} onSaved={onSaved} locked={at < 5} />
        {/* The Workspace login opens on the last step, alongside the mailbox. */}
        {candidate.workspace && at >= stageIndex("email") && (
          <WorkspaceAccess token={token} workspace={candidate.workspace} />
        )}
      </div>

      <Footer />
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/* Employee portal — once onboarded                                           */
/* -------------------------------------------------------------------------- */

function EmployeeHome({
  token,
  candidate,
  onSaved,
}: {
  token: string;
  candidate: CandidateView;
  onSaved: (next: CandidateView) => void;
}) {
  const name = candidate.details?.fullName ?? candidate.invitedName;
  const first = name.trim().split(/\s+/)[0];
  const remaining = daysFromNow(candidate.endDate);
  const untilStart = daysFromNow(candidate.startDate);
  const hasAgreement = !candidate.existing && candidate.agreementKind === "standard" && candidate.signedAt;
  const showMailbox = Boolean(candidate.mailbox) || !candidate.existing;

  return (
    <Shell subtitle="Employee portal" home={`/hr/${token}`}>
      <header className="mb-6">
        <h1 className="text-2xl leading-tight font-bold text-balance sm:text-3xl">
          Welcome back, {first}.
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fr-muted)" }}>
          {candidate.role.roleTitle} · {candidate.companies.map(companyLabel).join(" and ")}
        </p>
      </header>

      <div className="space-y-5">
        <Card>
          <div className="flex items-start gap-4">
            <CalendarDays className="size-6 shrink-0" style={{ color: "var(--fr-gold)" }} aria-hidden />
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Your internship</h2>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--fr-muted)" }}>
                {candidate.termMonths}-month term, {formatDate(candidate.startDate)} →{" "}
                {formatDate(candidate.endDate)}.{" "}
                {untilStart > 0
                  ? `Starts in ${untilStart} day${untilStart === 1 ? "" : "s"}.`
                  : remaining > 0
                    ? `${remaining} day${remaining === 1 ? "" : "s"} to go.`
                    : `Ended ${formatDate(candidate.endDate)}.`}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="Your documents"
            lead="Download these whenever you need them. They stay here after your internship ends."
          />
          <ul className="space-y-3">
            {hasAgreement && (
              <DocumentRow
                Icon={FileText}
                title="Internship agreement"
                status={
                  candidate.companySignature
                    ? `Signed by you and countersigned by ${candidate.companySignature.typedName}.`
                    : "Signed by you."
                }
                href={`/api/onboarding/session/${token}/contract/pdf`}
              />
            )}
            <DocumentRow
              Icon={Award}
              title="Completion certificate and letter of recommendation"
              status="Handed over at offboarding. The founders send you an offboarding link near the end of your term; it opens the day after your last day."
            />
          </ul>
        </Card>

        {showMailbox && <MailboxStage token={token} candidate={candidate} onSaved={onSaved} locked={false} inPortal />}

        {candidate.workspace && <WorkspaceAccess token={token} workspace={candidate.workspace} />}

        {!candidate.existing && (
          <details className="group fr-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-5 sm:px-6">
              <span className="flex items-center gap-3">
                <PartyPopper className="size-5" style={{ color: "var(--fr-gold)" }} aria-hidden />
                <span className="font-bold">Your onboarding record</span>
              </span>
              <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-5 px-3 pb-5 sm:px-5">
              <DetailsStage token={token} candidate={candidate} onSaved={onSaved} />
              <LearningStage token={token} candidate={candidate} onSaved={onSaved} locked={false} />
              <TestsStage token={token} candidate={candidate} onSaved={onSaved} locked={false} />
              <ContractStage token={token} candidate={candidate} onSaved={onSaved} locked={false} />
            </div>
          </details>
        )}
      </div>

      <Footer />
    </Shell>
  );
}

function DocumentRow({
  Icon,
  title,
  status,
  href,
}: {
  Icon: typeof Award;
  title: string;
  status: string;
  href?: string;
}) {
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
      style={{ borderColor: "var(--fr-line)", backgroundColor: "var(--fr-navy-deep)" }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          className="mt-0.5 size-5 shrink-0"
          style={{ color: href ? "var(--fr-gold)" : "var(--fr-muted)" }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--fr-muted)" }}>
            {status}
          </p>
        </div>
      </div>
      {href && (
        <a
          href={href}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold"
          style={{ backgroundColor: "var(--fr-gold)", color: "var(--fr-navy-deep)" }}
        >
          <Download className="size-4" aria-hidden />
          Download PDF
        </a>
      )}
    </li>
  );
}

function Footer() {
  return (
    <footer className="mt-10 space-y-4 border-t pt-6 fr-rule">
      <Notice>
        Something not right, or stuck? Reply to the email your invitation came from — Ali or Sehej
        will sort it out.
      </Notice>
      <p className="text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
        Your personal data is handled under the{" "}
        <Link href="/hr/privacy" className="underline" style={{ color: "var(--fr-gold-soft)" }}>
          privacy notice
        </Link>
        . You can ask to see, correct or erase your data, or withdraw your consent, at any time —
        including after your internship starts.
      </p>
    </footer>
  );
}

function Shell({
  children,
  subtitle,
  home,
}: {
  children: React.ReactNode;
  subtitle?: string;
  /** A person's home is their own portal, not the sign-in page. */
  home?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8">
        <Wordmark subtitle={subtitle ?? "Focus Realm HR"} href={home} />
      </div>
      {children}
    </div>
  );
}
