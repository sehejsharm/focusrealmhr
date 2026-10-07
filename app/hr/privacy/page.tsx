import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, SectionTitle, Wordmark } from "@/components/onboarding/ui";
import {
  AADHAAR_SAFEGUARDS,
  DATA_COLLECTED,
  DATA_FIDUCIARY,
  PRIVACY_NOTICE_VERSION,
  PURPOSES,
  RETENTION,
  RIGHTS,
} from "@/lib/onboarding/compliance";

export const metadata: Metadata = {
  title: "Focus Realm · Onboarding privacy notice",
  description:
    "How Focus Realm collects, uses, stores and erases the personal data given during intern onboarding.",
  robots: { index: false, follow: false },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t pt-6 first:border-0 first:pt-0" style={{ borderColor: "var(--fr-line)" }}>
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--fr-muted)" }}>
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span style={{ color: "var(--fr-gold)" }} aria-hidden>
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The notice given before any personal data is collected, as the DPDP Act
 * requires. Its version is recorded against every consent, so a candidate's
 * record always points at the text they actually agreed to.
 */
export default function PrivacyNoticePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Wordmark subtitle="HR portal" />
        <Link
          href="/hr"
          className="inline-flex items-center gap-2 text-sm font-bold"
          style={{ color: "var(--fr-gold-soft)" }}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to Focus Realm HR
        </Link>
      </div>

      <Card>
        <SectionTitle
          eyebrow={`Version ${PRIVACY_NOTICE_VERSION}`}
          title="Privacy notice — intern onboarding"
          lead="Read this before you give us anything. It explains what we collect, why, how long we keep it, and how you can take it back."
        />

        <div className="space-y-6">
          <Section title="Who is responsible for your data">
            <p>
              {DATA_FIDUCIARY.name}, {DATA_FIDUCIARY.place}, is the data fiduciary for the
              personal data collected through this portal. Questions, requests and
              complaints go to {DATA_FIDUCIARY.grievanceOfficer} at{" "}
              <a href={`mailto:${DATA_FIDUCIARY.grievanceEmail}`} className="underline">
                {DATA_FIDUCIARY.grievanceEmail}
              </a>
              .
            </p>
          </Section>

          <Section title="What we collect">
            <Bullets items={DATA_COLLECTED} />
          </Section>

          <Section title="Why we collect it">
            <p>
              Only for the purposes below. We do not use your data for anything else, and we
              do not sell it, rent it, or use it for advertising or profiling.
            </p>
            <Bullets items={PURPOSES} />
          </Section>

          <Section title="The legal basis">
            <p>
              We rely on your consent, given freely and specifically through the tick boxes
              on the details form, as provided for by the Digital Personal Data Protection
              Act, 2023. Consent is not a condition of anything except onboarding itself:
              you can decline, and nothing about your offer changes — but we cannot issue an
              agreement without the details it has to contain.
            </p>
          </Section>

          <Section title="Your Aadhaar">
            <Bullets items={AADHAAR_SAFEGUARDS} />
            <p>
              This is consistent with section 4(3) of the Aadhaar Act, 2016, which makes
              giving Aadhaar voluntary for a purpose like this one, and with the Aadhaar
              (Sharing of Information) Regulations, 2016, which prohibit publishing or
              displaying an Aadhaar number.
            </p>
          </Section>

          <Section title="Who can see it">
            <p>
              The founders of {DATA_FIDUCIARY.name}, and no one else. Your data is not
              shared with any other person or organisation, other than the hosting and
              storage providers that run this portal on our instructions, and any disclosure
              a court or a law requires us to make.
            </p>
          </Section>

          <Section title="How it is protected">
            <p>
              Identity documents are held in private storage that this portal cannot read
              back into a web page, reachable only with a server-side credential. Your
              onboarding link is a secret — treat it like a password. Aadhaar numbers are
              masked everywhere but the founders&apos; console, and every time a founder
              opens your Aadhaar copy, that access is recorded against your record.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>{RETENTION.summary}</p>
            <p>{RETENTION.detail}</p>
          </Section>

          <Section title="Your rights">
            <ul className="space-y-3">
              {RIGHTS.map((right) => (
                <li key={right.title}>
                  <p className="font-bold" style={{ color: "var(--fr-paper)" }}>
                    {right.title}
                  </p>
                  <p>{right.body}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Changes to this notice">
            <p>
              Every consent you give records the version of this notice in force at the
              time. If we change it, the new version applies only to consents given
              afterwards — what you agreed to stays what you agreed to.
            </p>
          </Section>
        </div>
      </Card>

      <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
        This notice and the internship agreement generated by this portal are drafts pending
        review by counsel, and are not legal advice.
      </p>
    </div>
  );
}
