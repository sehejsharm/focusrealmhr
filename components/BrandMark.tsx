"use client";

import { useState } from "react";

/**
 * The Focus Realm mark.
 *
 * Renders the logo from `public/focus-realm-logo.svg` (a `.png` also works if
 * the path is changed to match). Until that file is committed — or if it fails
 * to load — it falls back to the FR monogram tile, so the chrome never renders
 * with a broken image.
 */
export default function BrandMark({
  size = 36,
  className = "",
  variant = "gold",
}: {
  size?: number;
  className?: string;
  /** "gold" for the navy chrome, "navy" for a light ground. */
  variant?: "gold" | "navy";
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-lg text-xs font-bold tracking-tight ${
          variant === "gold"
            ? "bg-gold-500 text-navy-900"
            : "bg-navy-800 text-gold-400"
        } ${className}`}
        style={{ width: size, height: size }}
      >
        FR
      </span>
    );
  }

  return (
    // Plain <img>: the file is a small brand mark that may not exist yet, and
    // the fallback above depends on the load actually failing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/focus-realm-logo.svg"
      alt="Focus Realm"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-lg object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
