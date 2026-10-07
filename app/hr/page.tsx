"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Button,
  Card,
  Notice,
  SectionTitle,
  Wordmark,
  inputClass,
  inputStyle,
} from "@/components/onboarding/ui";

const STEPS = [
  "Submit your details and a copy of your Aadhaar card",
  "Read your company handbooks and watch the video briefings",
  "Pass the assessments — 75% on each",
  "Review and sign your internship agreement",
  "We verify the signed agreement",
  "Request your Focus Realm email and set it up",
];

/**
 * Front door of Focus Realm HR. There are no accounts or passwords: everyone
 * gets in through a personal link — an invitation to start, an offboarding
 * link to finish.
 */
export default function HrHome() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
      <div className="mb-10">
        <Wordmark subtitle="HR portal" />
      </div>

      <Invitation onOpen={(token) => router.push(`/hr/${token}`)} />

      <Card className="mb-5">
        <SectionTitle
          title="Finishing your internship?"
          lead="The founders send you a personal offboarding link towards the end of your term. It opens the day after your last day: answer a few short questions about your time here, then download your completion certificate and letter of recommendation."
        />
      </Card>

      <p className="mb-4 text-center text-xs leading-relaxed" style={{ color: "var(--fr-muted)" }}>
        Before you submit anything, read the{" "}
        <Link href="/hr/privacy" className="font-bold underline" style={{ color: "var(--fr-gold-soft)" }}>
          privacy notice
        </Link>{" "}
        — what we collect, why, how long we keep it, and how to take it back.
      </p>

      <p className="text-center text-xs" style={{ color: "var(--fr-muted)" }}>
        Founders —{" "}
        <Link href="/hr/admin" className="font-bold underline">
          open the HR console
        </Link>
      </p>
    </div>
  );
}

function Invitation({ onOpen }: { onOpen: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function open() {
    // Accept either the whole link or just the code at the end of it.
    const token = value.trim().replace(/\/+$/, "").split("/").pop();
    if (!token) {
      setMessage("Paste the link from your invitation.");
      return;
    }
    onOpen(token);
  }

  return (
    <Card className="mb-5">
      <SectionTitle
        eyebrow="Focus Realm HR"
        title="New intern? Start your onboarding"
        lead="Everything between being offered a place and your first working day, in one link. It takes most people an afternoon."
      />

      <ol className="mb-6 space-y-2.5">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-start gap-3">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
              style={{ backgroundColor: "rgba(201,162,39,0.16)", color: "var(--fr-gold-soft)" }}
              aria-hidden
            >
              {index + 1}
            </span>
            <span className="text-sm leading-snug text-pretty">{step}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Open your invitation</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && open()}
            placeholder="Paste the link from your invitation"
            className={inputClass}
            style={inputStyle}
          />
        </label>

        {message && <Notice tone="bad">{message}</Notice>}

        <Button variant="ghost" onClick={open}>
          Continue
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}
