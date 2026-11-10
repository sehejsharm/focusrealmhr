import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { ContractEdits } from "./types";

/**
 * Turns an agreement a founder uploaded (Word or PDF) into the console's own
 * editable agreement, under the platform's rules. SERVER ONLY.
 *
 * The rules:
 *  1. The parties, the effective date and the signature blocks always come
 *     from the intern's record and the console's e-signing, never from the
 *     document — those parts of the upload are dropped.
 *  2. No Aadhaar number appears in full: any 12-digit number is masked to its
 *     last four digits (Aadhaar Act s. 29; see compliance.ts).
 *  3. Blanks and placeholders ("[Name]", "_____") are flagged, as are missing
 *     term, confidentiality and termination clauses — the founder fixes them
 *     in the editor before the intern can sign.
 * The founder always reviews the result; nothing is signed unread.
 */

const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function extractAgreementText(bytes: Buffer, mimeType: string): Promise<string> {
  if (mimeType === WORD_MIME) {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return value;
  }
  if (mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  throw new Error("Only Word (.docx) and PDF agreements can be converted. Save an old .doc as .docx first.");
}

/** Rule 2: never more than the last four digits of an Aadhaar number. */
function maskAadhaarNumbers(text: string): { text: string; masked: number } {
  let masked = 0;
  const out = text.replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, (_m, _a, _b, last: string) => {
    masked++;
    return `XXXX XXXX ${last}`;
  });
  return { text: out, masked };
}

const CLAUSE_HEADING = /^(\d{1,2})[.)]\s+(.+)$/;

export function convertAgreementText(raw: string): Pick<ContractEdits, "recitals" | "clauses"> & { warnings: string[] } {
  const warnings: string[] = [];
  const { text, masked } = maskAadhaarNumbers(raw.replace(/\r/g, ""));
  if (masked > 0) warnings.push(`${masked} full Aadhaar number(s) were masked to the last four digits.`);

  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const recitals: string[] = [];
  const clauses: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  const flush = () => {
    if (current) clauses.push({ heading: current.heading, body: current.body.join(" ").trim() });
    current = null;
  };

  for (const line of lines) {
    // Rule 1: the console writes the signature/execution block itself.
    if (/^IN WITNESS WHEREOF/i.test(line)) break;

    if (/^(WHEREAS|NOW,? THEREFORE)/i.test(line)) {
      flush();
      recitals.push(line);
      continue;
    }

    const heading = CLAUSE_HEADING.exec(line);
    if (heading) {
      flush();
      const rest = heading[2];
      // "3. Confidentiality. The Intern shall…" — heading and body on one line.
      const split = /^([^.]{2,80})\.\s+(.+)$/.exec(rest);
      current = split
        ? { heading: `${heading[1]}. ${split[1]}`, body: [split[2]] }
        : { heading: `${heading[1]}. ${rest}`, body: [] };
      continue;
    }

    if (current) current.body.push(line);
    // Text before the first clause and outside recitals is the title and
    // parties block — rule 1, dropped.
  }
  flush();

  const usable = clauses.filter((c) => c.body);
  if (usable.length < clauses.length) {
    warnings.push(`${clauses.length - usable.length} heading(s) had no text under them and were left out.`);
  }
  if (usable.length === 0) {
    warnings.push("No numbered clauses were found. Add the clauses in the editor, numbered like \"1. Term\".");
  }

  const all = usable.map((c) => `${c.heading} ${c.body}`).join("\n");
  if (/\[[^\]]{1,40}\]|_{3,}|\.{5,}/.test(all + recitals.join(" "))) {
    warnings.push("Some blanks or placeholders (like [Name] or _____) remain — fill them in before the intern signs.");
  }
  const need: [RegExp, string][] = [
    [/\bterm\b|\bduration\b|commence/i, "term and duration"],
    [/confidential/i, "confidentiality"],
    [/terminat/i, "termination"],
  ];
  for (const [pattern, name] of need) {
    if (!pattern.test(all)) warnings.push(`No ${name} clause was found — check whether one is needed.`);
  }
  warnings.push(
    "The parties, effective date and signatures come from the intern's record. Check that dates written in the clauses match the start date and term on the record.",
  );

  return { recitals, clauses: usable, warnings };
}
