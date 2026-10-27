import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { formatLongDate } from "./contract";
import { LETTERHEAD, LETTERHEAD_COLOURS } from "./letterhead";
import { ascii, wrap } from "./pdf.server";
import type { IssuedCertificate } from "./types";

/**
 * Renders an issued certificate or letter as a PDF — the only form they are
 * handed out in. SERVER ONLY.
 *
 * Always drawn from the text frozen at approval (`IssuedCertificate.text`),
 * never from the live record — a document downloaded next year reads exactly
 * as it did the day it was approved. The layout around that text is the
 * Focus Realm letterhead (content/onboarding/brand/focus-realm-letterhead.docx),
 * measured from that file. Every page carries a security watermark behind the
 * text: the logo, and the document's own reference number repeated across it.
 */

function hex(value: string): RGB {
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  );
}

const NAVY = hex(LETTERHEAD_COLOURS.navy);
const BLUE = hex(LETTERHEAD_COLOURS.blue);
const SKY = hex(LETTERHEAD_COLOURS.sky);
const MUTED = hex(LETTERHEAD_COLOURS.muted);
const INK = hex(LETTERHEAD_COLOURS.ink);
const RULE = hex("CFD7E3");

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];

// The letterhead's page set-up, in points (twips / 20).
const MARGIN_X = 56.7;
const BODY_TOP = 115;
const BODY_BOTTOM = 104;

const LOGO = path.join(process.cwd(), "content/onboarding/brand/focus-realm-logo.png");
// The logo's own proportions (648 × 924), kept wherever it is drawn.
const LOGO_RATIO = 648 / 924;

interface Fonts {
  sans: PDFFont;
  sansBold: PDFFont;
  serif: PDFFont;
  serifBold: PDFFont;
  serifItalic: PDFFont;
}

async function setup(title: string, subject: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setSubject(subject);
  doc.setAuthor(LETTERHEAD.name);
  doc.setCreator("Focus Realm HR");
  doc.setProducer("Focus Realm HR");

  const fonts: Fonts = {
    // Helvetica stands in for the letterhead's Arial: the same metrics.
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };

  // The logo is a nicety: a missing file must never stop a download.
  let logo: PDFImage | null = null;
  try {
    logo = await doc.embedPng(await readFile(LOGO));
  } catch {
    logo = null;
  }

  return { doc, fonts, logo };
}

/** Width of letter-spaced text — the letterhead tracks its small capitals. */
function trackedWidth(text: string, font: PDFFont, size: number, spacing: number): number {
  const chars = ascii(text).split("");
  return chars.reduce((w, c) => w + font.widthOfTextAtSize(c, size), 0) + spacing * Math.max(chars.length - 1, 0);
}

function drawTracked(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, spacing: number, color: RGB) {
  let cursor = x;
  for (const c of ascii(text).split("")) {
    page.drawText(c, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(c, size) + spacing;
  }
}

function centred(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color: RGB) {
  const clean = ascii(text);
  page.drawText(clean, { x: (page.getWidth() - font.widthOfTextAtSize(clean, size)) / 2, y, size, font, color });
}

function approvalLine(issued: IssuedCertificate): string {
  return `Issued electronically through Focus Realm HR on ${new Date(issued.issuedAt).toUTCString()}, approved by ${issued.approvedBy.typedName}, ${issued.approvedBy.designation}. Reference ${issued.serial}.`;
}

/* -------------------------------------------------------------------------- */
/* Security watermark                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Drawn first on every page, so it sits behind everything else: the logo,
 * large and faint, and "FOCUS REALM · ORIGINAL · <reference>" repeated on the
 * diagonal. The reference ties each copy to its record, so a page lifted from
 * one document, or an edited one, shows the wrong number underneath.
 */
function drawWatermark(page: PDFPage, fonts: Fonts, logo: PDFImage | null, serial: string) {
  const W = page.getWidth();
  const H = page.getHeight();

  if (logo) {
    const h = Math.min(W, H) * 0.62;
    const w = h * LOGO_RATIO;
    page.drawImage(logo, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h, opacity: 0.045 });
  }

  // Copies run end to end along parallel diagonal lines, so none crosses another.
  const label = ascii(`FOCUS REALM  ·  ORIGINAL  ·  ${serial}`);
  const size = 11;
  const angle = 32;
  const along = fonts.sansBold.widthOfTextAtSize(label, size) + 40;
  const across = 74;
  const cos = Math.cos((angle * Math.PI) / 180);
  const sin = Math.sin((angle * Math.PI) / 180);
  const reach = Math.ceil(Math.hypot(W, H) / Math.min(along, across)) + 1;

  for (let line = -reach; line <= reach; line++) {
    // Alternate lines start half a copy along, so the copies do not stack into columns.
    const shift = (line % 2) * (along / 2);
    for (let n = -reach; n <= reach; n++) {
      const x = W / 2 + (n * along + shift) * cos - line * across * sin;
      const y = H / 2 + (n * along + shift) * sin + line * across * cos;
      if (x < -along || x > W + along || y < -along || y > H + along) continue;
      page.drawText(label, { x, y, size, font: fonts.sansBold, color: BLUE, opacity: 0.07, rotate: degrees(angle) });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* The letterhead                                                             */
/* -------------------------------------------------------------------------- */

/** Logo, name and tagline on the left; web, email and phone on the right; the two rules. */
function drawLetterheadHeader(page: PDFPage, fonts: Fonts, logo: PDFImage | null) {
  const W = page.getWidth();
  const H = page.getHeight();
  const top = H - 28;

  const logoH = 39.75;
  const logoW = logoH * LOGO_RATIO;
  const middle = top - logoH / 2;
  if (logo) page.drawImage(logo, { x: MARGIN_X, y: top - logoH, width: logoW, height: logoH });

  const textX = MARGIN_X + 41;
  page.drawText(LETTERHEAD.name, { x: textX, y: middle - 1, size: 20, font: fonts.sansBold, color: NAVY });
  drawTracked(page, LETTERHEAD.tagline, textX + 1, middle - 13, fonts.sans, 6.5, 1.6, BLUE);

  const right = W - MARGIN_X;
  const contacts: [string, string][] = [
    ["WEB", LETTERHEAD.web],
    ["EMAIL", LETTERHEAD.email],
    ["PHONE", LETTERHEAD.phone],
  ];
  contacts.forEach(([label, value], i) => {
    const y = middle + 8 - i * 10.5;
    const valueWidth = fonts.sans.widthOfTextAtSize(value, 8);
    page.drawText(value, { x: right - valueWidth, y, size: 8, font: fonts.sans, color: MUTED });
    const labelWidth = trackedWidth(label, fonts.sansBold, 7, 1);
    drawTracked(page, label, right - valueWidth - 7 - labelWidth, y, fonts.sansBold, 7, 1, SKY);
  });

  const ruleY = top - logoH - 21;
  page.drawLine({ start: { x: MARGIN_X, y: ruleY }, end: { x: right, y: ruleY }, thickness: 1.5, color: BLUE });
  page.drawLine({ start: { x: MARGIN_X, y: ruleY - 3.6 }, end: { x: MARGIN_X + 80, y: ruleY - 3.6 }, thickness: 2.25, color: SKY });
}

/** The footer rule and "Focus Realm | Jaipur, Rajasthan, India | focusrealm.org | admin@focusrealm.org". */
function drawLetterheadFooter(page: PDFPage, fonts: Fonts) {
  const W = page.getWidth();
  page.drawLine({ start: { x: MARGIN_X, y: 62 }, end: { x: W - MARGIN_X, y: 62 }, thickness: 0.5, color: SKY });

  const name = LETTERHEAD.name;
  const rest = `   |   ${LETTERHEAD.address}   |   ${LETTERHEAD.web}   |   ${LETTERHEAD.email}`;
  const size = 7.5;
  const width = fonts.sansBold.widthOfTextAtSize(name, size) + fonts.sans.widthOfTextAtSize(rest, size);
  const x = (W - width) / 2;
  page.drawText(name, { x, y: 50, size, font: fonts.sansBold, color: NAVY });
  page.drawText(rest, { x: x + fonts.sansBold.widthOfTextAtSize(name, size), y: 50, size, font: fonts.sans, color: MUTED });
}

/* -------------------------------------------------------------------------- */
/* Letters — the completion letter and the recommendation, A4 portrait        */
/* -------------------------------------------------------------------------- */

/** Draws one line, spread to the full width unless it ends its paragraph — justified, as a formal letter is. */
function drawLine(page: PDFPage, line: string, x: number, y: number, width: number, font: PDFFont, size: number, color: RGB, justify: boolean) {
  const words = line.split(" ");
  if (!justify || words.length < 2) {
    page.drawText(line, { x, y, size, font, color });
    return;
  }
  const wordsWidth = words.reduce((w, word) => w + font.widthOfTextAtSize(word, size), 0);
  const gap = (width - wordsWidth) / (words.length - 1);
  let cursor = x;
  for (const word of words) {
    page.drawText(word, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(word, size) + gap;
  }
}

async function renderLetter(issued: IssuedCertificate): Promise<Uint8Array> {
  const { text } = issued;
  const { doc, fonts, logo } = await setup(`${text.title} — ${text.recipientName}`, text.title);
  const [PAGE_W, PAGE_H] = A4_PORTRAIT;
  const WIDTH = PAGE_W - MARGIN_X * 2;
  const SIZE = 10.5;
  const LEADING = 15.5;

  const addPage = () => {
    const added = doc.addPage(A4_PORTRAIT);
    drawWatermark(added, fonts, logo, text.serial);
    return added;
  };
  let page = addPage();
  let y = PAGE_H - BODY_TOP;
  const newPage = () => {
    page = addPage();
    y = PAGE_H - BODY_TOP;
  };

  const write = (content: string, font: PDFFont, after: number, color: RGB = INK, justify = true) => {
    const lines = wrap(content, font, SIZE, WIDTH);
    lines.forEach((line, i) => {
      if (y < BODY_BOTTOM) newPage();
      drawLine(page, line, MARGIN_X, y, WIDTH, font, SIZE, color, justify && i < lines.length - 1);
      y -= LEADING;
    });
    y -= after;
  };

  // Date on the left, reference on the right.
  page.drawText(ascii(formatLongDate(new Date(text.issuedOn))), { x: MARGIN_X, y, size: SIZE, font: fonts.sans, color: INK });
  const ref = ascii(`Ref. No.: ${text.serial}`);
  page.drawText(ref, { x: MARGIN_X + WIDTH - fonts.sans.widthOfTextAtSize(ref, 9.5), y, size: 9.5, font: fonts.sans, color: MUTED });
  y -= LEADING * 2.2;

  if (text.subject) {
    // The current, formal wording: an addressee line and a subject.
    const addressee = ascii((text.salutation ?? "To Whom It May Concern").toUpperCase());
    const width = fonts.sansBold.widthOfTextAtSize(addressee, 11);
    const x = (PAGE_W - width) / 2;
    page.drawText(addressee, { x, y, size: 11, font: fonts.sansBold, color: NAVY });
    page.drawLine({ start: { x, y: y - 2.5 }, end: { x: x + width, y: y - 2.5 }, thickness: 0.7, color: NAVY });
    y -= LEADING * 2;
    write(`Subject: ${text.subject}`, fonts.sansBold, LEADING * 0.7, NAVY, false);
  } else {
    // Issued before the formal wording: its title, then its own salutation.
    page.drawText(ascii(text.title), { x: MARGIN_X, y, size: 15, font: fonts.sansBold, color: NAVY });
    y -= LEADING * 2;
    if (text.salutation) write(text.salutation, fonts.sans, 8, INK, false);
  }

  for (const paragraph of text.paragraphs) write(paragraph, fonts.sans, 8);

  // Keep the sign-off together on one page.
  if (y < BODY_BOTTOM + 120) newPage();
  y -= 4;
  if (text.closing) write(text.closing, fonts.sans, 0, INK, false);
  page.drawText("For Focus Realm", { x: MARGIN_X, y, size: SIZE, font: fonts.sansBold, color: NAVY });
  y -= 34;

  // The approving founder's typed name is the signature.
  page.drawText(ascii(text.signatory.name), { x: MARGIN_X, y, size: 20, font: fonts.serifItalic, color: NAVY });
  y -= 9;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + 190, y }, thickness: 0.7, color: RULE });
  y -= 15;
  page.drawText(ascii(text.signatory.name), { x: MARGIN_X, y, size: SIZE, font: fonts.sansBold, color: NAVY });
  y -= 14;
  page.drawText(ascii(`${text.signatory.designation}, Focus Realm`), { x: MARGIN_X, y, size: 10, font: fonts.sans, color: MUTED });
  const contact = [text.signatory.contactPhone, text.signatory.contactEmail].filter(Boolean).join("   ·   ");
  if (contact) {
    y -= 14;
    page.drawText(ascii(contact), { x: MARGIN_X, y, size: 10, font: fonts.sans, color: MUTED });
  }

  const pages = doc.getPages();
  pages.forEach((p, index) => {
    drawLetterheadHeader(p, fonts, logo);
    drawLetterheadFooter(p, fonts);
    wrap(approvalLine(issued), fonts.sans, 6.5, WIDTH).forEach((line, i) => {
      p.drawText(line, { x: MARGIN_X, y: 80 - i * 8, size: 6.5, font: fonts.sans, color: MUTED });
    });
    if (pages.length > 1) {
      const label = `Page ${index + 1} of ${pages.length}`;
      p.drawText(label, { x: PAGE_W - MARGIN_X - fonts.sans.widthOfTextAtSize(label, 7), y: 36, size: 7, font: fonts.sans, color: MUTED });
    }
  });

  return doc.save();
}

/* -------------------------------------------------------------------------- */
/* Certificate of completion — framed, A4 landscape                           */
/* -------------------------------------------------------------------------- */

async function renderCompletion(issued: IssuedCertificate): Promise<Uint8Array> {
  const { text } = issued;
  const { doc, fonts, logo } = await setup(`${text.title} — ${text.recipientName}`, text.title);
  const page = doc.addPage(A4_LANDSCAPE);
  const W = page.getWidth();
  const H = page.getHeight();
  drawWatermark(page, fonts, logo, text.serial);

  // Double frame, in the letterhead's blues.
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: BLUE, borderWidth: 2.4 });
  page.drawRectangle({ x: 31, y: 31, width: W - 62, height: H - 62, borderColor: SKY, borderWidth: 0.8 });

  let y = H - 56;
  if (logo) {
    const h = 50;
    const w = h * LOGO_RATIO;
    page.drawImage(logo, { x: (W - w) / 2, y: y - h, width: w, height: h });
    y -= h + 16;
  }
  const name = "FOCUS REALM";
  drawTracked(page, name, (W - trackedWidth(name, fonts.sansBold, 11, 3.2)) / 2, y, fonts.sansBold, 11, 3.2, NAVY);
  y -= 12;
  drawTracked(page, LETTERHEAD.tagline, (W - trackedWidth(LETTERHEAD.tagline, fonts.sans, 6.5, 1.6)) / 2, y, fonts.sans, 6.5, 1.6, BLUE);
  y -= 38;

  centred(page, text.title, y, fonts.serifBold, 28, NAVY);
  y -= 32;
  centred(page, "This is to certify that", y, fonts.serifItalic, 14, MUTED);
  y -= 42;

  centred(page, text.recipientName, y, fonts.serifBold, 32, NAVY);
  y -= 13;
  page.drawLine({ start: { x: W / 2 - 170, y }, end: { x: W / 2 + 170, y }, thickness: 1, color: SKY });
  y -= 28;

  for (const [index, paragraph] of text.paragraphs.entries()) {
    for (const line of wrap(paragraph, fonts.serif, 13, 640)) {
      centred(page, line, y, fonts.serif, 13, INK);
      y -= 18.5;
    }
    y -= index === 0 ? 7 : 5;
  }

  // Signature, bottom left; date and certificate number, bottom right.
  const baseY = 102;
  const leftX = 96;
  const colWidth = 230;

  page.drawText(ascii(text.signatory.name), { x: leftX, y: baseY + 26, size: 18, font: fonts.serifItalic, color: NAVY });
  page.drawLine({ start: { x: leftX, y: baseY + 18 }, end: { x: leftX + colWidth, y: baseY + 18 }, thickness: 0.7, color: RULE });
  page.drawText(ascii(text.signatory.name), { x: leftX, y: baseY + 4, size: 10, font: fonts.sansBold, color: NAVY });
  page.drawText(ascii(`${text.signatory.designation}, Focus Realm`), { x: leftX, y: baseY - 10, size: 9, font: fonts.sans, color: MUTED });

  const rightX = W - 96 - colWidth;
  page.drawText(ascii(formatLongDate(new Date(text.issuedOn))), { x: rightX, y: baseY + 26, size: 13, font: fonts.serif, color: NAVY });
  page.drawLine({ start: { x: rightX, y: baseY + 18 }, end: { x: rightX + colWidth, y: baseY + 18 }, thickness: 0.7, color: RULE });
  page.drawText("Date of issue", { x: rightX, y: baseY + 4, size: 10, font: fonts.sansBold, color: NAVY });
  page.drawText(ascii(`Certificate no. ${text.serial}`), { x: rightX, y: baseY - 10, size: 9, font: fonts.sans, color: MUTED });

  // How anyone checks it is genuine — what a background check needs.
  const verify = `To verify this certificate, contact Focus Realm at ${LETTERHEAD.phone} or ${LETTERHEAD.email}, quoting certificate no. ${text.serial}.   ${LETTERHEAD.address}   ·   ${LETTERHEAD.web}`;
  centred(page, verify, 60, fonts.sans, 7.5, MUTED);
  for (const [i, line] of wrap(approvalLine(issued), fonts.sans, 6.5, W - 180).entries()) {
    centred(page, line, 47 - i * 8, fonts.sans, 6.5, MUTED);
  }

  return doc.save();
}

export function renderCertificatePdf(issued: IssuedCertificate): Promise<Uint8Array> {
  return issued.kind === "completion" ? renderCompletion(issued) : renderLetter(issued);
}
