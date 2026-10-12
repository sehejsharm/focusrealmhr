"use client";

import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import BrandMark from "../BrandMark";

/**
 * Small brand primitives shared across the onboarding module.
 *
 * Everything here wears the Focus Realm blue-and-white brand through the
 * tokens in app/globals.css (bg-surface, text-fg-muted, border-line, bg-brand
 * …) — never a literal colour — so light and dark stay in lockstep.
 */

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* The same mechanism as the Focus Realm Workspace: the preference lives in   */
/* localStorage under "fr-theme" (light | dark | system, default light), the  */
/* boot script in app/layout.tsx applies it before first paint, and React     */
/* reads it as an external store — no flash, and other tabs follow along.     */
/* -------------------------------------------------------------------------- */

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_KEY = "fr-theme";

function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {}
  return "light";
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Puts the right class on <html>. Transitions are suppressed for the instant of the switch. */
function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && systemPrefersDark());
  const root = document.documentElement;
  if (root.classList.contains("dark") === dark) return;
  root.classList.add("theme-switching");
  root.classList.toggle("dark", dark);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

const themeListeners = new Set<() => void>();

function subscribeTheme(onChange: () => void) {
  themeListeners.add(onChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readThemePreference() === "system") applyTheme("system");
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY && event.key !== null) return;
    applyTheme(readThemePreference());
    onChange();
  };
  media.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(onChange);
    media.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

function themeSnapshot(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function serverThemeSnapshot(): ResolvedTheme {
  return "light";
}

function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {}
  applyTheme(preference);
  themeListeners.forEach((listener) => listener());
}

const noop = () => {};

/**
 * Keeps <html> in step with the saved theme on every page, toggle or not.
 * Rendered once, in the root layout. It re-applies the preference on mount
 * (React's development remount clears the class the boot script set) and
 * follows the system setting and other tabs from then on.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readThemePreference());
    return subscribeTheme(noop);
  }, []);
  return null;
}

/**
 * Switches between light and dark and remembers the choice. Place it at the
 * right end of a page's top bar, after the page's own header actions.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const resolved = useSyncExternalStore(subscribeTheme, themeSnapshot, serverThemeSnapshot);
  // Only animate the icon after a switch, not on first paint.
  const [switched, setSwitched] = useState(false);
  const next: ResolvedTheme = resolved === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;

  return (
    <button
      type="button"
      onClick={() => {
        setThemePreference(next);
        setSwitched(true);
      }}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-fg-muted shadow-xs transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-line-strong hover:bg-surface-hover hover:text-fg active:scale-[0.97] ${className}`}
    >
      <span key={resolved} aria-hidden className={`inline-flex ${switched ? "fr-theme-icon-in" : ""}`}>
        {resolved === "dark" ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

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
      className="group inline-flex min-w-0 items-center gap-3 rounded-xl"
    >
      <BrandMark
        size={40}
        variant="tile"
        className="transition-transform duration-200 ease-out-expo group-hover:-rotate-6 group-hover:scale-105"
      />
      <span className="min-w-0 leading-none">
        <span className="block text-[13px] font-semibold tracking-[0.14em] text-fg uppercase">
          Focus Realm
        </span>
        {subtitle && (
          <span className="mt-1.5 block truncate text-[12.5px] text-fg-muted">{subtitle}</span>
        )}
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
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
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-brand uppercase">
          {eyebrow}
        </p>
      )}
      <h2 className="text-xl leading-tight font-semibold tracking-[-0.02em] text-balance text-fg sm:text-2xl">
        {title}
      </h2>
      {lead && <p className="mt-2 text-sm leading-relaxed text-pretty text-fg-muted">{lead}</p>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
};

/*
 * Solid fills use the -solid tokens: identical to --brand / --danger in light,
 * and held at the deeper value in dark so white text keeps 4.5:1 contrast.
 */
const BUTTON_VARIANTS = {
  primary:
    "bg-brand-solid text-brand-fg shadow-press hover:bg-brand-solid-hover hover:shadow-brand disabled:shadow-none",
  ghost:
    "border border-line bg-surface text-fg shadow-xs hover:border-line-strong hover:bg-surface-hover",
  danger: "bg-danger-solid text-white shadow-xs hover:brightness-95",
} as const;

export function Button({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 [&_svg]:shrink-0";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${BUTTON_VARIANTS[variant]} ${className}`}
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
      <span className="mb-1.5 block text-[13px] font-medium text-fg">{label}</span>
      {hint && <span className="mb-2 block text-xs leading-snug text-fg-muted">{hint}</span>}
      {children}
    </label>
  );
}

/** Inputs, selects and textareas. The focus ring is brand blue in both themes. */
export const inputClass =
  "w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm text-fg shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle hover:border-line-strong focus:border-brand focus:ring-[3px] focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

/**
 * Kept so existing `style={inputStyle}` callers compile; the look now lives
 * entirely in inputClass.
 */
export const inputStyle = {} as const;

const NOTICE_TONES = {
  info: "border-info/20 bg-info-soft text-info-soft-fg",
  good: "border-success/20 bg-success-soft text-success-soft-fg",
  warn: "border-warning/25 bg-warning-soft text-warning-soft-fg",
  bad: "border-danger/20 bg-danger-soft text-danger-soft-fg",
} as const;

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "good" | "warn" | "bad";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "bad" ? "alert" : undefined}
      className={`rounded-xl border px-4 py-3 text-sm leading-snug text-pretty ${NOTICE_TONES[tone]}`}
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
