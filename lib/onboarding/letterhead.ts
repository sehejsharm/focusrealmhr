/**
 * Focus Realm's letterhead, as the founders supplied it
 * (content/onboarding/brand/focus-realm-letterhead.docx). Every letter and
 * certificate the console issues carries these details; the PDFs draw that
 * file's header and footer, measured from it.
 *
 * Safe to import from the browser — it is only text.
 */
export const LETTERHEAD = {
  name: "Focus Realm",
  tagline: "HOSPITALITY  ·  EDUCATION  ·  TECHNOLOGY",
  web: "focusrealm.org",
  email: "admin@focusrealm.org",
  phone: "+91 93221 07991",
  address: "Jaipur, Rajasthan, India",
} as const;

/** The letterhead's own colours (hex, no #), as in the supplied file. */
export const LETTERHEAD_COLOURS = {
  /** "Focus Realm" in the header, and headings. */
  navy: "0B1F3A",
  /** The header rule and the tagline. */
  blue: "024AAC",
  /** The short accent rule and the WEB / EMAIL / PHONE labels. */
  sky: "53BAFA",
  /** Contact details and the footer. */
  muted: "5B6675",
  /** Body text. */
  ink: "1F2937",
} as const;
