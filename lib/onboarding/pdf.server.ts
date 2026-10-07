import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Contract } from "./contract";
import { formatLongDate } from "./contract";
import type { CompanySignature, Signature } from "./types";

/**
 * Renders the internship agreement as a PDF for download, emailing or filing.
 * SERVER ONLY.
 *
 * pdf-lib is used rather than a headless browser so this runs inside a normal
 * serverless function with no Chromium to install.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const WIDTH = A4[0] - MARGIN * 2;

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.75, 0.75, 0.75);

/**
 * The standard fonts encode WinAnsi only, so anything outside it would throw
 * mid-render. Typographic characters are folded to their ASCII equivalents and
 * anything still unencodable is dropped rather than failing the download.
 */
export function ascii(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\xFF]/g, "");
}

interface Layout {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
}

function newPage(layout: Layout): void {
  layout.page = layout.doc.addPage(A4);
  layout.y = A4[1] - MARGIN;
}

function ensureSpace(layout: Layout, needed: number): void {
  if (layout.y - needed < MARGIN) newPage(layout);
}

/** Greedy wrap against real glyph widths. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of ascii(text).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);

  return lines.length ? lines : [""];
}

function paragraph(
  layout: Layout,
  text: string,
  options: {
    size?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    leading?: number;
    spaceAfter?: number;
    indent?: number;
  } = {},
): void {
  const size = options.size ?? 10;
  const font = options.font ?? layout.regular;
  const leading = options.leading ?? size * 1.45;
  const width = WIDTH - (options.indent ?? 0);

  for (const line of wrap(text, font, size, width)) {
    ensureSpace(layout, leading);
    layout.page.drawText(line, {
      x: MARGIN + (options.indent ?? 0),
      y: layout.y - size,
      size,
      font,
      color: options.color ?? INK,
    });
    layout.y -= leading;
  }

  layout.y -= options.spaceAfter ?? 6;
}

function sectionHeading(layout: Layout, text: string): void {
  ensureSpace(layout, 34);
  layout.y -= 10;
  layout.page.drawText(ascii(text.toUpperCase()), {
    x: MARGIN,
    y: layout.y - 9,
    size: 9,
    font: layout.bold,
    color: MUTED,
  });
  layout.y -= 22;
}

function rule(layout: Layout, gapAbove = 12, gapBelow = 14): void {
  ensureSpace(layout, gapAbove + gapBelow);
  layout.y -= gapAbove;
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.y },
    end: { x: MARGIN + WIDTH, y: layout.y },
    thickness: 0.7,
    color: RULE,
  });
  layout.y -= gapBelow;
}

/** One signature column: label, then value-over-line rows. */
function signatureBlock(
  layout: Layout,
  x: number,
  columnWidth: number,
  heading: string,
  party: string,
  rows: { label: string; value?: string }[],
): number {
  let y = layout.y;

  layout.page.drawText(ascii(heading.toUpperCase()), {
    x,
    y: y - 8,
    size: 8,
    font: layout.bold,
    color: MUTED,
  });
  y -= 20;

  for (const line of wrap(party, layout.bold, 10, columnWidth)) {
    layout.page.drawText(line, { x, y: y - 10, size: 10, font: layout.bold, color: INK });
    y -= 15;
  }
  y -= 8;

  for (const row of rows) {
    const label = `${ascii(row.label)}:`;
    layout.page.drawText(label, { x, y: y - 9, size: 9, font: layout.regular, color: MUTED });

    const labelWidth = layout.regular.widthOfTextAtSize(label, 9) + 6;
    const valueX = x + labelWidth;
    const valueWidth = columnWidth - labelWidth;

    if (row.value) {
      // Truncate rather than overflow into the neighbouring column.
      let value = ascii(row.value);
      while (value && layout.regular.widthOfTextAtSize(value, 9) > valueWidth) {
        value = value.slice(0, -1);
      }
      layout.page.drawText(value, { x: valueX, y: y - 9, size: 9, font: layout.regular, color: INK });
    }

    layout.page.drawLine({
      start: { x: valueX, y: y - 12 },
      end: { x: x + columnWidth, y: y - 12 },
      thickness: 0.6,
      color: RULE,
    });
    y -= 26;
  }

  return y;
}

export async function renderContractPdf(
  contract: Contract,
  signature: Signature | null | undefined,
  companySignature: CompanySignature | null | undefined,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const layout: Layout = { doc, page: doc.addPage(A4), y: A4[1] - MARGIN, regular, bold };

  doc.setTitle(`${contract.title} — ${contract.fields.fullName}`);
  doc.setSubject(contract.subtitle);
  doc.setProducer("Focus Realm onboarding");

  // Title block
  paragraph(layout, contract.subtitle, { size: 8, font: bold, color: MUTED, spaceAfter: 8 });
  paragraph(layout, contract.title, { size: 20, font: bold, leading: 24, spaceAfter: 4 });
  paragraph(layout, "Draft template — recommended for legal review before signature.", {
    size: 8,
    color: MUTED,
    spaceAfter: 4,
  });
  rule(layout, 6, 16);

  paragraph(layout, contract.preamble, { spaceAfter: 10 });

  for (const party of contract.parties) {
    if (party.label) {
      paragraph(layout, party.label, { size: 8, font: bold, color: MUTED, spaceAfter: 3 });
    }
    paragraph(layout, party.body, { spaceAfter: 8 });
  }

  sectionHeading(layout, "Recitals");
  for (const recital of contract.recitals) {
    paragraph(layout, recital, { spaceAfter: 7 });
  }

  sectionHeading(layout, "Terms and Conditions");
  for (const clause of contract.clauses) {
    ensureSpace(layout, 40);
    paragraph(layout, clause.heading, { size: 10, font: bold, spaceAfter: 2 });
    paragraph(layout, clause.body, { spaceAfter: 9 });
  }

  paragraph(layout, contract.execution, { spaceAfter: 4 });

  // Signatures, side by side, kept whole on one page.
  const columnWidth = (WIDTH - 32) / 2;
  ensureSpace(layout, 190);
  rule(layout, 14, 22);

  const startY = layout.y;

  layout.y = startY;
  const leftEnd = signatureBlock(
    layout,
    MARGIN,
    columnWidth,
    "For and on behalf of",
    "FocusRealm (to be incorporated)",
    [
      { label: "Signature", value: companySignature?.typedName },
      { label: "Name", value: companySignature?.typedName },
      { label: "Designation", value: companySignature?.designation ?? "Authorized Signatory" },
      {
        label: "Date",
        value: companySignature ? formatLongDate(new Date(companySignature.signedAt)) : undefined,
      },
    ],
  );

  layout.y = startY;
  const rightEnd = signatureBlock(
    layout,
    MARGIN + columnWidth + 32,
    columnWidth,
    "The Intern",
    contract.fields.fullName,
    [
      { label: "Signature", value: signature?.typedName },
      { label: "Name", value: contract.fields.fullName },
      { label: "Aadhaar No.", value: `XXXX XXXX ${contract.fields.aadhaarNumber.slice(-4)}` },
      {
        label: "Date",
        value: signature ? formatLongDate(new Date(signature.signedAt)) : undefined,
      },
    ],
  );

  layout.y = Math.min(leftEnd, rightEnd);

  if (signature || companySignature) {
    rule(layout, 16, 14);
    const audit: string[] = [];

    if (signature) {
      audit.push(
        `Signed electronically by ${signature.typedName} (Intern) on ${new Date(
          signature.signedAt,
        ).toUTCString()}${signature.ip ? ` from ${signature.ip}` : ""}, affirming they had read and accepted this agreement in full.`,
      );
    }
    if (companySignature) {
      audit.push(
        `Countersigned electronically by ${companySignature.typedName}, ${companySignature.designation}, for FocusRealm on ${new Date(
          companySignature.signedAt,
        ).toUTCString()}${companySignature.ip ? ` from ${companySignature.ip}` : ""}.`,
      );
    }
    audit.push(
      "The intern's Aadhaar number is masked above; the full number is held on the signed record.",
    );

    for (const line of audit) {
      paragraph(layout, line, { size: 8, color: MUTED, leading: 11, spaceAfter: 4 });
    }
  }

  // Page numbers, once the page count is final.
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    page.drawText(label, {
      x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: MARGIN / 2,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}

/** `Internship-Agreement-Priya-Nair.pdf` */
export function contractFilename(fullName: string): string {
  const slug = fullName
    // Fold accents first, so "Ánjali" keeps its A instead of losing the letter.
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `Internship-Agreement-${slug || "Intern"}.pdf`;
}
