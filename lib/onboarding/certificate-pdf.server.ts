import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { formatLongDate } from "./contract";
import { ascii, wrap } from "./pdf.server";
import type { IssuedCertificate } from "./types";

/**
 * Renders an issued completion certificate or recommendation letter. SERVER ONLY.
 *
 * Always drawn from the text frozen at approval (`IssuedCertificate.text`),
 * never from the live record — a certificate downloaded next year reads
 * exactly as it did the day it was approved.
 */

const NAVY = rgb(0.07, 0.16, 0.18);
const GOLD = rgb(0.79, 0.66, 0.29);
const INK = rgb(0.12, 0.12, 0.12);
const MUTED = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.78, 0.78, 0.78);

const MARK = path.join(process.cwd(), "content/onboarding/brand/focus-realm-mark.png");

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

async function setup(title: string, subject: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setSubject(subject);
  doc.setProducer("Focus Realm HR");

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
    italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  // The mark is a nicety: a missing file must never stop a download.
  let mark: PDFImage | null = null;
  try {
    mark = await doc.embedPng(await readFile(MARK));
  } catch {
    mark = null;
  }

  return { doc, fonts, mark };
}

function centred(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const clean = ascii(text);
  const x = (page.getWidth() - font.widthOfTextAtSize(clean, size)) / 2;
  page.drawText(clean, { x, y, size, font, color });
}

/** Letter-spaced capitals, centred — "FOCUS REALM". */
function tracked(page: PDFPage, text: string, y: number, font: PDFFont, size: number, spacing: number, color = GOLD) {
  const chars = ascii(text).split("");
  const width = chars.reduce((w, c) => w + font.widthOfTextAtSize(c, size), 0) + spacing * (chars.length - 1);
  let x = (page.getWidth() - width) / 2;
  for (const c of chars) {
    page.drawText(c, { x, y, size, font, color });
    x += font.widthOfTextAtSize(c, size) + spacing;
  }
}

function approvalLine(issued: IssuedCertificate): string {
  return `Issued electronically through Focus Realm HR on ${new Date(issued.issuedAt).toUTCString()}, approved by ${issued.approvedBy.typedName}, ${issued.approvedBy.designation}. Reference ${issued.serial}.`;
}

/* -------------------------------------------------------------------------- */
/* Certificate of completion — A4 landscape                                   */
/* -------------------------------------------------------------------------- */

async function renderCompletion(issued: IssuedCertificate): Promise<Uint8Array> {
  const { text } = issued;
  const { doc, fonts, mark } = await setup(`${text.title} — ${text.recipientName}`, text.title);
  const page = doc.addPage([841.89, 595.28]);
  const W = page.getWidth();
  const H = page.getHeight();

  // Double frame.
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: GOLD, borderWidth: 2.4 });
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: H - 64, borderColor: GOLD, borderWidth: 0.6 });

  let y = H - 64;

  if (mark) {
    const size = 58;
    page.drawImage(mark, { x: (W - size) / 2, y: y - size, width: size, height: size });
    y -= size + 18;
  }
  tracked(page, "FOCUS REALM", y, fonts.sansBold, 10, 3.2);
  y -= 44;

  centred(page, text.title, y, fonts.bold, 30, NAVY);
  y -= 36;
  centred(page, "This is to certify that", y, fonts.italic, 14, MUTED);
  y -= 46;

  centred(page, text.recipientName, y, fonts.bold, 34, NAVY);
  y -= 14;
  page.drawLine({ start: { x: W / 2 - 170, y }, end: { x: W / 2 + 170, y }, thickness: 1, color: GOLD });
  y -= 30;

  const bodyWidth = 650;
  for (const [index, paragraph] of text.paragraphs.entries()) {
    for (const line of wrap(paragraph, fonts.regular, 13, bodyWidth)) {
      centred(page, line, y, fonts.regular, 13);
      y -= 19;
    }
    y -= index === 0 ? 8 : 6;
  }

  // Signature, bottom left; date and reference, bottom right.
  const baseY = 96;
  const leftX = 96;
  const colWidth = 230;

  page.drawText(ascii(text.signatory.name), { x: leftX, y: baseY + 26, size: 18, font: fonts.italic, color: NAVY });
  page.drawLine({ start: { x: leftX, y: baseY + 18 }, end: { x: leftX + colWidth, y: baseY + 18 }, thickness: 0.7, color: RULE });
  page.drawText(ascii(text.signatory.name), { x: leftX, y: baseY + 4, size: 10, font: fonts.sansBold, color: INK });
  page.drawText(ascii(`${text.signatory.designation}, Focus Realm`), { x: leftX, y: baseY - 10, size: 9, font: fonts.sans, color: MUTED });

  const rightX = W - 96 - colWidth;
  const issuedOn = formatLongDate(new Date(text.issuedOn));
  page.drawText(ascii(issuedOn), { x: rightX, y: baseY + 26, size: 13, font: fonts.regular, color: NAVY });
  page.drawLine({ start: { x: rightX, y: baseY + 18 }, end: { x: rightX + colWidth, y: baseY + 18 }, thickness: 0.7, color: RULE });
  page.drawText("Date of issue", { x: rightX, y: baseY + 4, size: 10, font: fonts.sansBold, color: INK });
  page.drawText(ascii(`Certificate no. ${text.serial}`), { x: rightX, y: baseY - 10, size: 9, font: fonts.sans, color: MUTED });

  for (const [i, line] of wrap(approvalLine(issued), fonts.sans, 7, W - 180).entries()) {
    centred(page, line, 50 - i * 9, fonts.sans, 7, MUTED);
  }

  return doc.save();
}

/* -------------------------------------------------------------------------- */
/* Letter of recommendation — A4 portrait                                     */
/* -------------------------------------------------------------------------- */

async function renderRecommendation(issued: IssuedCertificate): Promise<Uint8Array> {
  const { text } = issued;
  const { doc, fonts, mark } = await setup(`${text.title} — ${text.recipientName}`, text.title);

  const A4: [number, number] = [595.28, 841.89];
  const MARGIN = 64;
  const WIDTH = A4[0] - MARGIN * 2;

  let page = doc.addPage(A4);
  let y = A4[1] - 56;

  // Letterhead.
  const markSize = 40;
  if (mark) page.drawImage(mark, { x: MARGIN, y: y - markSize, width: markSize, height: markSize });
  const headX = MARGIN + (mark ? markSize + 12 : 0);
  page.drawText("FOCUS REALM", { x: headX, y: y - 17, size: 13, font: fonts.sansBold, color: NAVY });
  page.drawText("Pune, Maharashtra, India", { x: headX, y: y - 32, size: 9, font: fonts.sans, color: MUTED });
  y -= markSize + 14;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + WIDTH, y }, thickness: 1.2, color: GOLD });
  y -= 30;

  const dateLine = ascii(formatLongDate(new Date(text.issuedOn)));
  page.drawText(dateLine, { x: MARGIN, y, size: 11, font: fonts.regular, color: INK });
  const ref = ascii(`Ref. ${text.serial}`);
  page.drawText(ref, {
    x: MARGIN + WIDTH - fonts.sans.widthOfTextAtSize(ref, 9),
    y,
    size: 9,
    font: fonts.sans,
    color: MUTED,
  });
  y -= 34;

  page.drawText(ascii(text.title), { x: MARGIN, y, size: 17, font: fonts.bold, color: NAVY });
  y -= 30;

  const write = (content: string, font: PDFFont, size: number, leading: number, after: number) => {
    for (const line of wrap(content, font, size, WIDTH)) {
      if (y - leading < 110) {
        page = doc.addPage(A4);
        y = A4[1] - 64;
      }
      page.drawText(line, { x: MARGIN, y, size, font, color: INK });
      y -= leading;
    }
    y -= after;
  };

  if (text.salutation) write(text.salutation, fonts.regular, 11.5, 17, 8);
  for (const paragraph of text.paragraphs) write(paragraph, fonts.regular, 11.5, 17, 9);

  // Keep the sign-off together.
  if (y < 190) {
    page = doc.addPage(A4);
    y = A4[1] - 64;
  }
  y -= 6;
  if (text.closing) write(text.closing, fonts.regular, 11.5, 17, 10);

  page.drawText(ascii(text.signatory.name), { x: MARGIN, y: y - 4, size: 20, font: fonts.italic, color: NAVY });
  y -= 14;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 200, y }, thickness: 0.7, color: RULE });
  y -= 16;
  page.drawText(ascii(text.signatory.name), { x: MARGIN, y, size: 11, font: fonts.bold, color: INK });
  y -= 15;
  page.drawText(ascii(`${text.signatory.designation}, Focus Realm`), { x: MARGIN, y, size: 10.5, font: fonts.regular, color: INK });
  if (text.signatory.contactEmail) {
    y -= 15;
    page.drawText(ascii(text.signatory.contactEmail), { x: MARGIN, y, size: 10.5, font: fonts.regular, color: MUTED });
  }

  const pages = doc.getPages();
  pages.forEach((p, index) => {
    const lines = wrap(approvalLine(issued), fonts.sans, 7, WIDTH);
    lines.forEach((line, i) => {
      p.drawText(line, { x: MARGIN, y: 44 - i * 9, size: 7, font: fonts.sans, color: MUTED });
    });
    if (pages.length > 1) {
      const label = `Page ${index + 1} of ${pages.length}`;
      p.drawText(label, {
        x: MARGIN + WIDTH - fonts.sans.widthOfTextAtSize(label, 7),
        y: 26,
        size: 7,
        font: fonts.sans,
        color: MUTED,
      });
    }
  });

  return doc.save();
}

export function renderCertificatePdf(issued: IssuedCertificate): Promise<Uint8Array> {
  return issued.kind === "completion" ? renderCompletion(issued) : renderRecommendation(issued);
}
