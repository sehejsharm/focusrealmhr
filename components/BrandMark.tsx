import { useId } from "react";

/**
 * The Focus Realm monogram: a sky-blue F interlocked with a royal-blue R.
 *
 * Ported from the Focus Realm Workspace (components/brand/logo.tsx) so both
 * products wear the same mark. Drawn inline, so it stays crisp at every size,
 * needs no image request and can never render as a broken image. Never redraw,
 * recolour, stretch or rotate it — the colours below are the logo itself, the
 * one place the brand rules allow literal values.
 *
 * - `color`: blue mark, for light surfaces (the default).
 * - `inverse`: white mark, for brand-blue surfaces.
 * - `tile`: white rounded tile with the colour mark, wherever it needs a
 *   frame — the same in light and dark.
 */
export function BrandMark({
  size = 32,
  className = "",
  variant = "color",
  parts,
}: {
  size?: number;
  className?: string;
  /** color: blue on light · inverse: white on blue · tile: white rounded tile with the colour mark. */
  variant?: "color" | "inverse" | "tile";
  /** Class names for the F and R groups, so a screen can animate the letters. */
  parts?: { f?: string; r?: string };
}) {
  // useId's format varies between React versions; keep only characters that
  // are safe inside an SVG url(#…) reference.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const f = `fr-f-${id}`;
  const r = `fr-r-${id}`;
  const inverse = variant === "inverse";
  const tile = variant === "tile";
  const markSize = tile ? size * 0.72 : size;

  const mark = (
    <svg
      viewBox="0 0 64 64"
      width={markSize}
      height={markSize}
      role="img"
      aria-label="Focus Realm"
      className={tile ? undefined : `shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={f} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={inverse ? "#ffffff" : "#7cc0fa"} />
          <stop offset="100%" stopColor={inverse ? "#dcebfe" : "#3b8ef5"} />
        </linearGradient>
        <linearGradient id={r} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={inverse ? "#eaf3ff" : "#2f86f0"} />
          <stop offset="100%" stopColor={inverse ? "#bfdcfe" : "#1655c0"} />
        </linearGradient>
      </defs>
      {/* F — sky */}
      <g fill={`url(#${f})`} className={parts?.f}>
        <rect x="12" y="8" width="5" height="48" />
        <rect x="12" y="8" width="29" height="5" />
        <rect x="12" y="27.5" width="18" height="5" />
      </g>
      {/* R — royal, its bowl growing out of the F's middle arm */}
      <g fill={`url(#${r})`} className={parts?.r}>
        <path
          fillRule="evenodd"
          d="M26 56 V27.5 H40.5 A10 10 0 0 1 40.5 47.5 H31 V56 Z M31 32.5 V42.5 H40.5 A5 5 0 0 0 40.5 32.5 Z"
        />
        <path d="M35 47.5 H41 L52 56 H45.2 Z" />
      </g>
    </svg>
  );

  if (!tile) return mark;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[28%] bg-white shadow-sm ring-1 ring-brand-100 dark:ring-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      {mark}
    </span>
  );
}

export default BrandMark;
