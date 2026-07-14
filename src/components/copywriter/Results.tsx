import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Download,
  RefreshCw,
  RotateCcw,
  Play,
  Loader2,
  Volume2,
  ImageIcon,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { GenerateResult } from "@/lib/copywriter/types";
import { generateVoice } from "@/lib/copywriter/api";
import { T, type Language } from "@/lib/copywriter/i18n";

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build a self-contained, print-ready HTML document from the result.
 *
 * Rendered as real HTML text (NOT an html2canvas image), so the browser's
 * "Save as PDF" produces a PDF with a genuine, selectable/copyable text layer.
 * The font stack lists Windows/macOS/Linux CJK fonts so 华文 renders as real
 * glyphs (no tofu). An on-load script opens the print dialog automatically.
 */
function buildPrintDoc(result: GenerateResult, t: (typeof T)[Language], lang: Language): string {
  const item = (label: string, body: string) =>
    `<div class="item"><div class="label">${esc(label)}</div><div class="body">${esc(body)}</div></div>`;

  const segs = result.adScript.segments.map((s) => item(s.stage, s.content)).join("");
  const funnel = result.funnel.map((f) => item(f.section, f.content)).join("");

  const wa = result.automationMessages.whatsapp;
  const em = result.automationMessages.email;
  const waBlock =
    item(t.autoMsgGreeting, wa.greeting) +
    item(t.autoMsgDayBefore, wa.dayBefore) +
    item(t.autoMsgCurrentDay, wa.currentDay);
  const emItem = (label: string, m: { subject: string; body: string }) =>
    `<div class="item"><div class="label">${esc(label)}</div><div class="body"><span class="k">${esc(t.emailSubjectLabel)}:</span> ${esc(m.subject)}\n\n<span class="k">${esc(t.emailBodyLabel)}:</span>\n${esc(m.body)}</div></div>`;
  const emBlock =
    emItem(t.autoMsgGreeting, em.greeting) +
    emItem(t.autoMsgDayBefore, em.dayBefore) +
    emItem(t.autoMsgCurrentDay, em.currentDay);

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8" />
<title>${esc(t.resultsTitle)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Plus Jakarta Sans","Segoe UI","Microsoft YaHei","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Heiti SC",sans-serif;color:#111827;background:#fff;margin:0;padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:22px;margin:0 0 2px}
  .sub{color:#6b7280;font-size:12px;margin:0 0 20px}
  h2{font-size:15px;color:#FF3D6E;border-bottom:2px solid rgba(255,61,110,.25);padding-bottom:5px;margin:24px 0 10px;break-after:avoid}
  .grp{font-weight:700;font-size:12px;margin:10px 0 6px;color:#374151}
  .item{break-inside:avoid;margin:0 0 11px}
  .label{font-weight:700;color:#FF3D6E;font-size:12.5px;margin-bottom:2px}
  .body{white-space:pre-wrap;font-size:12.5px;line-height:1.6;color:#1f2937}
  .k{font-weight:700;color:#6b7280}
  @page{margin:14mm}
</style></head>
<body>
  <h1>${esc(t.resultsTitle)}</h1>
  <div class="sub">${esc(t.resultsSubtitle)}</div>
  <h2>A · ${esc(t.adScriptTitle)}</h2>${segs}
  <h2>B · ${esc(t.adCopyTitle)}</h2>${item("", result.adCopy)}
  <h2>C · ${esc(t.funnelTitle)}</h2>${funnel}
  <h2>D · ${esc(t.autoMsgTitle)}</h2>
  <div class="grp">${esc(t.autoMsgWhatsappLabel)}</div>${waBlock}
  <div class="grp">${esc(t.autoMsgEmailLabel)}</div>${emBlock}
</body></html>`;
}

export function Results({
  result,
  onRegenerate,
  onRestart,
}: {
  result: GenerateResult;
  onRegenerate: () => void;
  onRestart: () => void;
}) {
  const lang: Language = result.language || "zh";
  const t = T[lang];
  const ref = useRef<HTMLDivElement>(null);

  // Per-segment voice-over (MiniMax via the generate-voice Edge Function).
  const [voices, setVoices] = useState<Record<number, string>>({});
  const [loadingVoice, setLoadingVoice] = useState<Record<number, boolean>>({});

  const playVoice = async (idx: number, text: string) => {
    if (loadingVoice[idx] || voices[idx]) return;
    setLoadingVoice((s) => ({ ...s, [idx]: true }));
    try {
      const dataUrl = await generateVoice(text, lang);
      setVoices((s) => ({ ...s, [idx]: dataUrl }));
      toast.success(t.voiceDone);
      // Autoplay once the <audio> for this segment has mounted.
      setTimeout(() => {
        const el = document.getElementById(`voice-audio-${idx}`) as HTMLAudioElement | null;
        el?.play().catch(() => {});
      }, 50);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.voiceFail;
      toast.error(`${t.voiceFail}: ${msg}`);
    } finally {
      setLoadingVoice((s) => ({ ...s, [idx]: false }));
    }
  };

  // Print via a hidden iframe → the browser's "Save as PDF" produces a real,
  // selectable/copyable text PDF (correct CJK glyphs via the doc's font stack).
  // An iframe avoids pop-up blockers that would break window.open.
  const exportPdf = () => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;border:0";
    iframe.srcdoc = buildPrintDoc(result, t, lang);
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        return;
      }
      win.onafterprint = () => setTimeout(() => iframe.remove(), 500);
      // Small delay so fonts/layout settle before the print dialog opens.
      setTimeout(() => {
        win.focus();
        win.print();
      }, 350);
      // Fallback cleanup if onafterprint never fires (some browsers).
      setTimeout(() => iframe.remove(), 120000);
    };
    document.body.appendChild(iframe);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div data-export-hide className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.resultsTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.resultsSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRestart}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            {t.restart}
          </Button>
          <Button variant="outline" onClick={onRegenerate}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {t.regenerate}
          </Button>
          <Button onClick={exportPdf}>
            <Download className="mr-1.5 h-4 w-4" />
            {t.exportPdf}
          </Button>
        </div>
      </div>

      <div id="export-area" ref={ref} className="space-y-10 bg-background p-6">
        {/* Section A: Ad Script */}
        <section>
          <SectionTitle index="A" title={t.adScriptTitle} subtitle={t.adScriptSub} />
          <div className="space-y-4">
            {result.adScript.segments.map((seg, i) => {
              const isBanner = i >= 4;
              return (
                <Card
                  key={i}
                  className={`p-5 shadow-sm ${
                    isBanner
                      ? "border-l-4 border-l-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-primary">{seg.stage}</div>
                      {isBanner && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                          {t.topBannerTag}
                        </span>
                      )}
                    </div>
                    {!isBanner && (
                      <div data-export-hide className="flex items-center gap-2">
                        {voices[i] ? (
                          <>
                            <audio
                              id={`voice-audio-${i}`}
                              src={voices[i]}
                              controls
                              className="h-9"
                            />
                            <Volume2 className="h-4 w-4 text-muted-foreground" />
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => playVoice(i, seg.content)}
                            disabled={!!loadingVoice[i]}
                          >
                            {loadingVoice[i] ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="mr-1.5 h-4 w-4" />
                            )}
                            {loadingVoice[i] ? t.generating : t.playVoice}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <p
                    className={`whitespace-pre-wrap leading-relaxed ${
                      isBanner ? "text-xl font-bold" : "text-sm"
                    }`}
                  >
                    {seg.content}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Section B: Ad Copy (social caption) */}
        <section>
          <SectionTitle index="B" title={t.adCopyTitle} subtitle={t.adCopySub} />
          <AdCopyCard text={result.adCopy || ""} lang={lang} />
        </section>

        {/* Section C: Funnel landing page */}
        <section>
          <SectionTitle index="C" title={t.funnelTitle} subtitle={t.funnelSub} />
          <div className="space-y-6">
            {result.funnel.map((f, i) => (
              <FunnelBlock key={i} index={i} section={f.section} content={f.content} lang={lang} />
            ))}
          </div>
        </section>

        {/* Section D: Automation Messages */}
        <section>
          <SectionTitle index="D" title={t.autoMsgTitle} subtitle={t.autoMsgSub} />

          {/* WhatsApp */}
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              {t.autoMsgWhatsappLabel}
            </span>
          </div>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <CopyableCard
              title={t.autoMsgGreeting}
              text={result.automationMessages?.whatsapp?.greeting || ""}
              lang={lang}
            />
            <CopyableCard
              title={t.autoMsgDayBefore}
              text={result.automationMessages?.whatsapp?.dayBefore || ""}
              lang={lang}
            />
            <CopyableCard
              title={t.autoMsgCurrentDay}
              text={result.automationMessages?.whatsapp?.currentDay || ""}
              lang={lang}
            />
          </div>

          {/* Email */}
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700">
              {t.autoMsgEmailLabel}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <EmailCard
              title={t.autoMsgGreeting}
              subject={result.automationMessages?.email?.greeting?.subject || ""}
              body={result.automationMessages?.email?.greeting?.body || ""}
              lang={lang}
            />
            <EmailCard
              title={t.autoMsgDayBefore}
              subject={result.automationMessages?.email?.dayBefore?.subject || ""}
              body={result.automationMessages?.email?.dayBefore?.body || ""}
              lang={lang}
            />
            <EmailCard
              title={t.autoMsgCurrentDay}
              subject={result.automationMessages?.email?.currentDay?.subject || ""}
              body={result.automationMessages?.email?.currentDay?.body || ""}
              lang={lang}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="btn-gradient flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold">
        {index}
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** Image placeholder frame */
function ImageBox({ label, ratio = "aspect-square" }: { label: string; ratio?: string }) {
  return (
    <div
      className={`${ratio} flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground`}
    >
      <ImageIcon className="mb-1 h-7 w-7 opacity-50" />
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

/** Split content into N parts by leading numbering like "1." "1、" "1)" — fallback to line split */
function splitIntoParts(text: string, n: number): string[] {
  if (!text) return Array.from({ length: n }, () => "");
  // Try numbered split
  const re = /(?:^|\n)\s*(\d+)[\.\、\)\s]+/g;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    indices.push(m.index + (m[0].startsWith("\n") ? 1 : 0));
  }
  if (indices.length >= n) {
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const start = indices[i];
      const end = i + 1 < indices.length ? indices[i + 1] : text.length;
      parts.push(text.slice(start, end).replace(/^\s*\d+[\.\、\)\s]+/, "").trim());
    }
    return parts;
  }
  // Fallback: split by blank lines / line breaks
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length >= n) {
    return lines.slice(0, n);
  }
  // Pad
  const out = [...lines];
  while (out.length < n) out.push("");
  return out;
}

function ThreeColumn({
  items,
  imgLabelPrefix,
}: {
  items: string[];
  imgLabelPrefix: (i: number) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((txt, i) => (
        <Card key={i} className="overflow-hidden p-4">
          <div className="mb-3">
            <ImageBox label={imgLabelPrefix(i + 1)} />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{txt}</p>
        </Card>
      ))}
    </div>
  );
}

function FunnelBlock({
  index,
  section,
  content,
  lang,
}: {
  index: number;
  section: string;
  content: string;
  lang: Language;
}) {
  const t = T[lang];
  const idx = index + 1;
  // Common header
  const Header = (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
      {section}
    </div>
  );

  // 1. Headline
  if (idx === 1) {
    return (
      <Card className="overflow-hidden p-6">
        {Header}
        <div className="grid items-center gap-6 md:grid-cols-2">
          <h3 className="whitespace-pre-wrap text-3xl font-extrabold leading-tight tracking-tight">
            {content}
          </h3>
          <ImageBox label={t.imagePlaceholder(1)} ratio="aspect-[4/3]" />
        </div>
      </Card>
    );
  }

  // 2. Questions / 4. Pain / 5. Benefits / 8. Testimonials — 3 columns
  if (idx === 2 || idx === 4 || idx === 5 || idx === 8) {
    const parts = splitIntoParts(content, 3);
    return (
      <Card className="overflow-hidden p-6">
        {Header}
        <ThreeColumn
          items={parts}
          imgLabelPrefix={(n) => t.imagePlaceholder(n)}
        />
      </Card>
    );
  }

  // 3. Empathy
  if (idx === 3) {
    return (
      <Card className="overflow-hidden p-6">
        {Header}
        <div className="grid items-center gap-6 md:grid-cols-[1fr_300px]">
          <p className="whitespace-pre-wrap text-base leading-relaxed">{content}</p>
          <ImageBox label={t.imagePlaceholder(1)} ratio="aspect-[4/3]" />
        </div>
      </Card>
    );
  }

  // 6. Before & After
  if (idx === 6) {
    const parts = splitIntoParts(content, 2);
    const beforeText = parts[0]?.replace(/^(之前|before|sebelum)\s*[:：]?\s*/i, "") ?? "";
    const afterText = parts[1]?.replace(/^(之后|after|selepas)\s*[:：]?\s*/i, "") ?? "";
    return (
      <Card className="overflow-hidden p-6">
        {Header}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase">
              {t.beforeLabel}
            </div>
            <ImageBox label={t.imagePlaceholder(1)} ratio="aspect-[4/3]" />
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{beforeText}</p>
          </div>
          <div className="rounded-xl border bg-primary/5 p-4">
            <div className="mb-2 inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold uppercase text-primary-foreground">
              {t.afterLabel}
            </div>
            <ImageBox label={t.imagePlaceholder(2)} ratio="aspect-[4/3]" />
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{afterText}</p>
          </div>
        </div>
      </Card>
    );
  }

  // 7. About
  if (idx === 7) {
    return (
      <Card className="overflow-hidden p-6">
        {Header}
        <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
          <ImageBox label={t.imagePlaceholder(1)} ratio="aspect-square" />
          <p className="whitespace-pre-wrap text-base leading-relaxed">{content}</p>
        </div>
      </Card>
    );
  }

  // 9. CTA
  if (idx === 9) {
    return (
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 p-8 text-primary-foreground shadow-lg">
        <div className="text-center">
          <p className="mb-6 whitespace-pre-wrap text-xl font-bold leading-relaxed">{content}</p>
          <div className="inline-block rounded-full bg-background px-8 py-3 text-lg font-bold text-primary shadow-md">
            {t.ctaButton}
          </div>
        </div>
      </Card>
    );
  }

  // fallback
  return (
    <Card className="p-6">
      {Header}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
    </Card>
  );
}

function AdCopyCard({ text, lang }: { text: string; lang: Language }) {
  const t = T[lang];
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await copyToClipboard(text);
      setCopied(true);
      toast.success(t.copyDone);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.copyFail;
      toast.error(`${t.copyFail}: ${msg}`);
    }
  };

  return (
    <Card className="relative p-6 shadow-sm">
      <div data-export-hide className="absolute right-4 top-4">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? (
            <Check className="mr-1.5 h-4 w-4" />
          ) : (
            <Copy className="mr-1.5 h-4 w-4" />
          )}
          {copied ? t.copied : t.copyText}
        </Button>
      </div>
      <p className="whitespace-pre-wrap pr-28 text-sm leading-relaxed">
        {text || "—"}
      </p>
    </Card>
  );
}

function CopyableCard({ title, text, lang }: { title: string; text: string; lang: Language }) {
  const t = T[lang];
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await copyToClipboard(text);
      setCopied(true);
      toast.success(t.copyDone);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.copyFail;
      toast.error(`${t.copyFail}: ${msg}`);
    }
  };

  return (
    <Card className="relative flex flex-col p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        <Button data-export-hide size="sm" variant="outline" onClick={copy}>
          {copied ? (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Copy className="mr-1.5 h-3.5 w-3.5" />
          )}
          {copied ? t.copied : t.copyText}
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{text || "—"}</p>
    </Card>
  );
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function EmailCard({
  title,
  subject,
  body,
  lang,
}: {
  title: string;
  subject: string;
  body: string;
  lang: Language;
}) {
  const t = T[lang];
  const [copiedKey, setCopiedKey] = useState<"subject" | "body" | null>(null);

  const doCopy = async (key: "subject" | "body", text: string) => {
    try {
      await copyToClipboard(text);
      setCopiedKey(key);
      toast.success(t.copyDone);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.copyFail;
      toast.error(`${t.copyFail}: ${msg}`);
    }
  };

  return (
    <Card className="flex flex-col p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold leading-tight">{title}</h3>

      <div className="mb-3 rounded-lg border bg-muted/30 p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.emailSubjectLabel}
          </span>
          <Button
            data-export-hide
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => doCopy("subject", subject)}
          >
            {copiedKey === "subject" ? (
              <Check className="mr-1 h-3 w-3" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            <span className="text-xs">
              {copiedKey === "subject" ? t.copied : t.copySubject}
            </span>
          </Button>
        </div>
        <p className="text-sm font-medium leading-relaxed">{subject || "—"}</p>
      </div>

      <div className="flex flex-1 flex-col rounded-lg border p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.emailBodyLabel}
          </span>
          <Button
            data-export-hide
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => doCopy("body", body)}
          >
            {copiedKey === "body" ? (
              <Check className="mr-1 h-3 w-3" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            <span className="text-xs">{copiedKey === "body" ? t.copied : t.copyBody}</span>
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{body || "—"}</p>
      </div>
    </Card>
  );
}
