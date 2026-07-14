import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { GenerateResult, Language } from "./types";
import { T } from "./i18n";

// Colors
const CORAL = rgb(1, 0x3d / 255, 0x6e / 255); // #FF3D6E
const DARK = rgb(0x1f / 255, 0x29 / 255, 0x37 / 255);
const GREY = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);

// Page geometry (A4)
const PW = 595.28;
const PH = 841.89;
const M = 42;
const MAXW = PW - M * 2;

// The embedded CJK font (subset:false — fontkit's CFF subsetting corrupts
// glyphs) is only needed for 华文 output. en/ms use built-in Helvetica, so
// those PDFs stay tiny and this ~2MB font only loads when exporting Chinese.
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

/** Remove characters the embedded fonts can't render (emoji, pictographs,
 *  variation selectors, ZWJ, skin tones, private-use) so drawText won't throw. */
function clean(s: string): string {
  return String(s ?? "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/[\u{E000}-\u{F8FF}]/gu, "")
    .replace(/ /g, " ")
    .trimEnd();
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
        continue; // unencodable char — skip it
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

  const space = (needed: number) => {
    if (y - needed < M) {
      page = doc.addPage([PW, PH]);
      y = PH - M;
    }
  };
  const drawLine = (line: string, f: PDFFont, size: number, color: ReturnType<typeof rgb>) => {
    const lh = size * 1.5;
    space(lh);
    if (line) {
      try {
        page.drawText(line, { x: M, y: y - size, size, font: f, color });
      } catch {
        /* skip unencodable line */
      }
    }
    y -= lh;
  };
  const block = (text: string, f: PDFFont, size: number, color: ReturnType<typeof rgb>) => {
    for (const line of wrapLines(text, f, size, MAXW)) drawLine(line, f, size, color);
  };

  // Title
  block(t.resultsTitle, bold, 19, DARK);
  y -= 2;
  block(t.resultsSubtitle, font, 10.5, GREY);
  y -= 10;

  const section = (heading: string) => {
    space(34);
    y -= 8;
    block(heading, bold, 14, CORAL);
    // underline rule
    space(2);
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: PW - M, y: y + 6 }, thickness: 1, color: rgb(1, 0x3d / 255, 0x6e / 255), opacity: 0.25 });
    y -= 6;
  };
  const groupLabel = (label: string) => {
    y -= 4;
    block(label, bold, 11.5, GREY);
    y -= 1;
  };
  const item = (label: string, body: string) => {
    if (label) block(label, bold, 11, CORAL);
    block(body, font, 11, DARK);
    y -= 7;
  };

  // A — Ad script
  section(`A · ${t.adScriptTitle}`);
  for (const s of result.adScript.segments) item(s.stage, s.content);

  // B — Ad caption
  section(`B · ${t.adCopyTitle}`);
  item("", result.adCopy || "");

  // C — Funnel
  section(`C · ${t.funnelTitle}`);
  for (const f of result.funnel) item(f.section, f.content);

  // D — Automation messages
  section(`D · ${t.autoMsgTitle}`);
  const wa = result.automationMessages.whatsapp;
  const em = result.automationMessages.email;
  groupLabel(t.autoMsgWhatsappLabel);
  item(t.autoMsgGreeting, wa.greeting);
  item(t.autoMsgDayBefore, wa.dayBefore);
  item(t.autoMsgCurrentDay, wa.currentDay);
  groupLabel(t.autoMsgEmailLabel);
  const emItem = (label: string, m: { subject: string; body: string }) =>
    item(label, `${t.emailSubjectLabel}: ${m.subject}\n\n${t.emailBodyLabel}:\n${m.body}`);
  emItem(t.autoMsgGreeting, em.greeting);
  emItem(t.autoMsgDayBefore, em.dayBefore);
  emItem(t.autoMsgCurrentDay, em.currentDay);

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
