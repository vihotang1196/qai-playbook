import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { GenerateResult, Language } from "./types";
import { T } from "./i18n";

// Brand / palette
const CORAL = rgb(1, 0x3d / 255, 0x6e / 255); // #FF3D6E
const DARK = rgb(0x1f / 255, 0x29 / 255, 0x37 / 255); // #1F2937
const GREY = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255); // #6B7280
const WHITE = rgb(1, 1, 1);
const CARD_FILL = rgb(1, 0.965, 0.975); // faint coral tint
const CARD_BORDER = rgb(0.93, 0.85, 0.88); // light coral-grey
const RULE = rgb(1, 0x3d / 255, 0x6e / 255);

// A4 geometry
const PW = 595.28;
const PH = 841.89;
const M = 44;
const MAXW = PW - M * 2;
const USABLE = PH - M * 2;

// The embedded CJK font (subset:false — fontkit's CFF subsetting corrupts
// glyphs) is only needed for 华文. en/ms use built-in Helvetica so those PDFs
// stay tiny and the ~2MB font only loads when exporting Chinese.
let cjkBytesPromise: Promise<ArrayBuffer> | null = null;
function loadCjkFont(): Promise<ArrayBuffer> {
  if (!cjkBytesPromise) {
    cjkBytesPromise = import("@/assets/fonts/NotoSansSC-Regular.otf?url")
      .then((m) => fetch(m.default))
      .then((r) => {
        if (!r.ok) throw new Error("font load failed");
        return r.arrayBuffer();
      });
  }
  return cjkBytesPromise;
}

/** Strip characters the embedded fonts can't render (emoji, pictographs,
 *  variation selectors, ZWJ, skin tones, private-use) so drawText won't throw. */
function clean(s: string): string {
  return String(s ?? "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/[\u{E000}-\u{F8FF}]/gu, "")
    .trimEnd();
}

function safeWidth(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return text.length * size * 0.5;
  }
}

/** SVG path for a rounded rectangle (origin at its top-left, y-down —
 *  pdf-lib's drawSvgPath anchors at (x,y) and draws downward). */
function roundedRectPath(w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M ${rr} 0 H ${w - rr} A ${rr} ${rr} 0 0 1 ${w} ${rr} ` +
    `V ${h - rr} A ${rr} ${rr} 0 0 1 ${w - rr} ${h} ` +
    `H ${rr} A ${rr} ${rr} 0 0 1 0 ${h - rr} ` +
    `V ${rr} A ${rr} ${rr} 0 0 1 ${rr} 0 Z`
  );
}

/** Word-wrap (breaks at spaces for Latin, per-char for CJK which has none). */
function wrapLines(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    if (!para) {
      out.push("");
      continue;
    }
    let line = "";
    let lastSpace = -1;
    for (const ch of para) {
      const test = line + ch;
      let w: number;
      try {
        w = font.widthOfTextAtSize(test, size);
      } catch {
        continue;
      }
      if (w > maxW && line) {
        if (lastSpace > 0) {
          out.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1) + ch;
        } else {
          out.push(line);
          line = ch;
        }
        lastSpace = -1;
      } else {
        line = test;
        if (ch === " ") lastSpace = line.length - 1;
      }
    }
    out.push(line);
  }
  return out;
}

export async function buildPdfBlob(result: GenerateResult, lang: Language): Promise<Blob> {
  const t = T[lang];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  let font: PDFFont;
  let bold: PDFFont;
  if (lang === "zh") {
    const bytes = await loadCjkFont();
    font = await doc.embedFont(bytes, { subset: false });
    bold = font; // single weight
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  let page: PDFPage = doc.addPage([PW, PH]);
  let y = PH - M;

  const newPage = () => {
    page = doc.addPage([PW, PH]);
    y = PH - M;
  };
  const drawText = (str: string, x: number, baseline: number, size: number, f: PDFFont, color: RGB) => {
    if (!str) return;
    try {
      page.drawText(str, { x, y: baseline, size, font: f, color });
    } catch {
      /* skip unencodable line */
    }
  };

  // Full-width wrapped paragraph (used for the header title/subtitle).
  const paragraph = (text: string, size: number, f: PDFFont, color: RGB, lineFactor = 1.4) => {
    const lh = size * lineFactor;
    for (const line of wrapLines(text, f, size, MAXW)) {
      if (y - lh < M) newPage();
      drawText(line, M, y - size, size, f, color);
      y -= lh;
    }
  };

  // ── Header ────────────────────────────────────────────────────────────────
  paragraph(t.resultsTitle, 19, bold, DARK, 1.3);
  y -= 1;
  paragraph(t.resultsSubtitle, 10.5, font, GREY, 1.4);
  y -= 16;

  // ── Section header: coral circle marker + brand-color title + subtitle ─────
  const sectionHeader = (letter: string, title: string, subtitle: string) => {
    if (y - 58 < M) newPage();
    y -= 6;
    const r = 11;
    const cx = M + r;
    const cy = y - r;
    page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, color: CORAL });
    const lw = safeWidth(bold, letter, 12);
    drawText(letter, cx - lw / 2, cy - 4.4, 12, bold, WHITE);
    const tx = M + r * 2 + 12;
    drawText(title, tx, cy - 1, 15, bold, CORAL);
    drawText(subtitle, tx, cy - 15, 9, font, GREY);
    y = cy - r - 12;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1, color: RULE, opacity: 0.22 });
    y -= 14;
  };

  // Small group label (WhatsApp / Email under section D).
  const groupLabel = (label: string) => {
    if (y - 24 < M) newPage();
    y -= 2;
    drawText(label, M + 2, y - 11, 11, bold, GREY);
    y -= 20;
  };

  // ── Card: sub-heading (coral) + body, in a tinted bordered box ─────────────
  const PAD = 12;
  const TX = M + 14;
  const INNERW = MAXW - 14 - PAD;
  const LABEL_SZ = 11;
  const BODY_SZ = 11;
  const LH = BODY_SZ * 1.55;
  const LABEL_LH = LABEL_SZ * 1.5;

  const card = (label: string, body: string) => {
    const labelLines = label ? wrapLines(label, bold, LABEL_SZ, INNERW) : [];
    const bodyLines = wrapLines(body, font, BODY_SZ, INNERW);
    const contentH =
      labelLines.length * LABEL_LH + (labelLines.length ? 5 : 0) + bodyLines.length * LH;
    const cardH = contentH + PAD * 2;

    // Oversized item (taller than a whole page): draw without a box so it can
    // flow across pages rather than clip.
    if (cardH > USABLE) {
      if (labelLines.length) {
        for (const ln of labelLines) {
          if (y - LABEL_LH < M) newPage();
          drawText(ln, TX, y - LABEL_SZ, LABEL_SZ, bold, CORAL);
          y -= LABEL_LH;
        }
        y -= 5;
      }
      for (const ln of bodyLines) {
        if (y - LH < M) newPage();
        drawText(ln, TX, y - BODY_SZ, BODY_SZ, font, DARK);
        y -= LH;
      }
      y -= 12;
      return;
    }

    if (y - cardH < M) newPage();
    const top = y;
    const bottom = top - cardH;
    // Clean rounded card: light fill + thin border (no glass/blur).
    page.drawSvgPath(roundedRectPath(MAXW, cardH, 10), {
      x: M,
      y: top,
      color: CARD_FILL,
      borderColor: CARD_BORDER,
      borderWidth: 0.75,
    });
    let ty = top - PAD;
    for (const ln of labelLines) {
      drawText(ln, TX, ty - LABEL_SZ, LABEL_SZ, bold, CORAL);
      ty -= LABEL_LH;
    }
    if (labelLines.length) ty -= 5;
    for (const ln of bodyLines) {
      drawText(ln, TX, ty - BODY_SZ, BODY_SZ, font, DARK);
      ty -= LH;
    }
    y = bottom - 9;
  };

  // ── A · Ad script ──────────────────────────────────────────────────────────
  sectionHeader("A", t.adScriptTitle, t.adScriptSub);
  for (const s of result.adScript.segments) card(s.stage, s.content);

  // ── B · Ad caption ──────────────────────────────────────────────────────────
  sectionHeader("B", t.adCopyTitle, t.adCopySub);
  card("", result.adCopy || "");

  // ── C · Funnel ──────────────────────────────────────────────────────────────
  sectionHeader("C", t.funnelTitle, t.funnelSub);
  for (const f of result.funnel) card(f.section, f.content);

  // ── D · Automation messages ─────────────────────────────────────────────────
  sectionHeader("D", t.autoMsgTitle, t.autoMsgSub);
  const wa = result.automationMessages.whatsapp;
  const em = result.automationMessages.email;
  groupLabel(t.autoMsgWhatsappLabel);
  card(t.autoMsgGreeting, wa.greeting);
  card(t.autoMsgDayBefore, wa.dayBefore);
  card(t.autoMsgCurrentDay, wa.currentDay);
  groupLabel(t.autoMsgEmailLabel);
  const emCard = (label: string, m: { subject: string; body: string }) =>
    card(label, `${t.emailSubjectLabel}: ${m.subject}\n\n${t.emailBodyLabel}:\n${m.body}`);
  emCard(t.autoMsgGreeting, em.greeting);
  emCard(t.autoMsgDayBefore, em.dayBefore);
  emCard(t.autoMsgCurrentDay, em.currentDay);

  const bytes = await doc.save();
  // Copied into a fresh Uint8Array rather than passed straight to Blob: since
  // TS 5.7 Uint8Array is generic over its buffer, and pdf-lib's return is typed
  // ArrayBufferLike, which BlobPart (ArrayBuffer-backed only) rejects. The copy
  // is ArrayBuffer-backed by construction, so this is a real fix rather than a
  // cast papering over a mismatch.
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
