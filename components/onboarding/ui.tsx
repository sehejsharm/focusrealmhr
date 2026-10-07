"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import BrandMark from "../BrandMark";

/** Small brand primitives shared across the onboarding module. */

/**
 * The logo, linking home. "Home" depends on who is looking: the console for
 * founders, a candidate's own portal for them, the landing page otherwise.
 */
export function Wordmark({
  subtitle,
  href = "/hr",
}: {
  subtitle?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Focus Realm — home"
      className="inline-flex items-center gap-3 rounded-lg transition-opacity hover:opacity-85"
    >
      <BrandMark size={40} />
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-bold tracking-[0.18em] uppercase">
          Focus Realm
        </span>
        {subtitle && (
          <span
            className="block truncate text-xs leading-tight"
            style={{ color: "var(--fr-muted)" }}
          >
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`fr-card p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function SectionTitle({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="mb-5">
      {eyebrow && (
        <p
          className="mb-2 text-xs font-bold tracking-[0.18em] uppercase"
          style={{ color: "var(--fr-gold)" }}
        >
          {eyebrow}
        </p>
      )}
      <h2 className="text-xl leading-tight font-bold text-balance sm:text-2xl">{title}</h2>
      {lead && (
        <p className="mt-2 text-sm leading-relaxed text-pretty" style={{ color: "var(--fr-muted)" }}>
          {lead}
        </p>
      )}
    </header>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
};

export function Button({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";

  const style =
    variant === "primary"
      ? { backgroundColor: "var(--fr-gold)", color: "var(--fr-navy-deep)" }
      : variant === "danger"
        ? { backgroundColor: "#7f1d1d", color: "var(--fr-paper)" }
        : {
            backgroundColor: "var(--fr-navy-soft)",
            color: "var(--fr-paper)",
            border: "1px solid var(--fr-line)",
          };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`${base} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      {hint && (
        <span className="mb-2 block text-xs leading-snug" style={{ color: "var(--fr-muted)" }}>
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[var(--fr-gold)]";

export const inputStyle = {
  backgroundColor: "var(--fr-navy-deep)",
  borderColor: "var(--fr-line)",
  color: "var(--fr-paper)",
} as const;

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "good" | "warn" | "bad";
  children: ReactNode;
}) {
  const palette = {
    info: { bg: "rgba(144,164,192,0.12)", fg: "var(--fr-paper)", line: "var(--fr-line)" },
    good: { bg: "rgba(52,168,110,0.14)", fg: "#a7e8c6", line: "#2f6b4f" },
    warn: { bg: "rgba(201,162,39,0.14)", fg: "var(--fr-gold-soft)", line: "#7a6320" },
    bad: { bg: "rgba(220,80,80,0.14)", fg: "#f2b8b8", line: "#7f3535" },
  }[tone];

  return (
    <p
      role={tone === "bad" ? "alert" : undefined}
      className="rounded-xl border px-4 py-3 text-sm leading-snug text-pretty"
      style={{ backgroundColor: palette.bg, color: palette.fg, borderColor: palette.line }}
    >
      {children}
    </p>
  );
}

/**
 * Dates are shown in Indian time wherever the viewer is, so "opens on 1 Oct"
 * means the same day to a founder abroad as to an intern in Pune.
 */
const TIME_ZONE = "Asia/Kolkata";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
