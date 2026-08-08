import { useEffect, useRef, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Languages, Clock } from "lucide-react";
import type { SurveyInput } from "@/lib/copywriter/types";
import { useLang } from "@/i18n/LanguageContext";
import { T, type Language, loadLang, saveLang, uiLanguage } from "@/lib/copywriter/i18n";
import {
  TONE_KEYS,
  GENDER_KEYS,
  CTA_KEYS,
  AGE_ANY,
  OPTION_LABELS,
  normalizeOptionValue,
} from "@/lib/copywriter/options";

export const DRAFT_KEY = "qai_survey_draft";

const DEFAULT: SurveyInput = {
  language: "zh",
  productName: "",
  productDesc: "",
  price: "",
  usp: "",
  ageRange: "",
  gender: "",
  occupation: "",
  painPoint: "",
  dream: "",
  testimonials: "",
  cta: "",
  tone: "",
};

function loadDraft(): SurveyInput {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return DEFAULT;
    const saved = { ...DEFAULT, ...JSON.parse(raw) } as SurveyInput;
    // Drafts written before options became stable keys hold the localized label
    // that was on screen ("专业"). Translate those back to keys so the buttons
    // light up again; anything unrecognisable is cleared so the customer
    // re-picks rather than a stale string reaching the prompt. The free-text
    // answers they actually spent time on are untouched either way.
    return {
      ...saved,
      tone: normalizeOptionValue("tone", saved.tone),
      gender: normalizeOptionValue("gender", saved.gender),
      cta: normalizeOptionValue("cta", saved.cta),
      ageRange: normalizeOptionValue("age", saved.ageRange),
    };
  } catch {
    return DEFAULT;
  }
}

/**
 * Is there anything in the saved draft the customer would mind losing?
 *
 * Only fields they TYPED count. A language pick or a tone button is one click to
 * redo, so counting those would fire the "this will overwrite your work"
 * confirmation on a form nobody has actually filled in — the surest way to teach
 * someone to click through warnings without reading them.
 */
export function hasDraftContent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw) as Partial<SurveyInput>;
    return [
      d.productName,
      d.productDesc,
      d.price,
      d.usp,
      d.occupation,
      d.painPoint,
      d.dream,
      d.testimonials,
    ].some((v) => !!(v || "").trim());
  } catch {
    return false;
  }
}

/**
 * Replace the draft with a past questionnaire ("use as template").
 *
 * Writing the DRAFT rather than passing a prop is deliberate: Survey is
 * conditionally rendered, so leaving the history view remounts it and it reloads
 * the draft on its own. A prop would also have to be un-set afterwards, or
 * bouncing to the list and back would silently overwrite edits the customer made
 * after the template landed.
 */
export function writeDraft(input: SurveyInput): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(input));
  } catch {
    /* private mode — the template just won't persist; nothing else breaks */
  }
}

// Visual cue: required fields carry an ink border in both states.
// Use ! to override glass-input's `border` shorthand.
const FIELD_CLS = "!border !border-[#141414] focus-visible:!ring-[#141414]";

const GROUP_CLS = "rounded-2xl border border-[#141414] p-1.5";

// The three content blocks sit SIDE BY SIDE rather than stacking: three columns
// from 1536px up (the whole questionnaire fits on a 1080p screen without
// scrolling, which is the point), two on a small laptop, one on a phone.
// `items-start` keeps the short blocks from being stretched to match the tall one.
const COLUMNS_CLS = "grid grid-cols-1 items-start gap-8 md:grid-cols-2 2xl:grid-cols-3";

// Inside a column the fields just stack — no nested grid.
const STACK_CLS = "space-y-4";

// The two long-answer fields get their own full-width row under the columns:
// they are what the customer writes most in, and a ~200px column was too cramped
// to be usable.
const LONG_ROW_CLS = "grid grid-cols-1 gap-4 md:grid-cols-2";

// Textareas start at two rows and grow with the content. `!min-h-0` overrides the
// shared Textarea's min-h-[80px] (that component is used site-wide and must not
// be touched); `resize-none` because the height is driven by the content now.
const TEXTAREA_CLS = `${FIELD_CLS} !min-h-0 resize-none`;

/** Rows the box may grow to before it starts scrolling internally. */
const MAX_ROWS = 6;

/**
 * Size a textarea to its content, capped at MAX_ROWS.
 *
 * Called on every keystroke AND once after the draft is restored — without the
 * latter, a recovered draft sits in a two-row box with its content hidden.
 */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  const cs = getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight) || 22;
  const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  const max = lineHeight * MAX_ROWS + padding + border;
  // Reset first: scrollHeight only ever reports "at least the current height".
  el.style.height = "auto";
  // scrollHeight covers content + padding but not the border, which border-box
  // sizing does include — add it back or the box creeps a couple of pixels short.
  const next = Math.min(el.scrollHeight + border, max);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight + border > max ? "auto" : "hidden";
}

export function Survey({
  onSubmit,
  /** Held down while a generation this browser started is still unaccounted for.
   *  Submitting again would start a second billable run for the same copy. */
  disabled = false,
  onOpenHistory,
}: {
  onSubmit: (data: SurveyInput) => void;
  disabled?: boolean;
  /** Opens this account's past generations. Omitted → no button. */
  onOpenHistory?: () => void;
}) {
  const [data, setData] = useState<SurveyInput>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    const lang = loadLang();
    setData({ ...d, language: d.language || lang });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {}
  }, [data, hydrated]);

  // Every auto-growing textarea, so they can all be re-measured at once.
  // Registration only — measuring here would run while the element is still being
  // laid out, where scrollHeight reads far too large and pins the box to MAX_ROWS.
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const registerTextarea = (key: string) => (el: HTMLTextAreaElement | null) => {
    textareas.current[key] = el;
  };
  const growAll = () => Object.values(textareas.current).forEach(autoGrow);

  // Re-measure whenever the text itself changes. This runs after the DOM is
  // updated, so it is what sizes a RESTORED DRAFT correctly — keying it off
  // `hydrated` alone was a frame too early and left recovered text in a two-row
  // box. The onChange handler still sizes as you type so there's no lag.
  useEffect(() => {
    growAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.usp, data.painPoint, data.dream]);

  // A width change (breakpoint, window resize) rewraps the text, which changes
  // the height needed.
  useEffect(() => {
    window.addEventListener("resize", growAll);
    return () => window.removeEventListener("resize", growAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // INTERFACE language — follows the site navbar, not the questionnaire.
  // `data.language` below is the OUTPUT language and no longer affects any of
  // the labels on screen.
  const { lang: siteLang } = useLang();
  const lang: Language = uiLanguage(siteLang);
  const t = T[lang];

  const update = <K extends keyof SurveyInput>(k: K, v: SurveyInput[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  /** Sets the OUTPUT language only — the interface is the navbar's business. */
  const setLanguage = (l: Language) => {
    saveLang(l);
    // Nothing else is touched. This used to also seed `tone`, which made sense
    // when options were localized labels (the old value stopped matching any
    // button). They're stable keys now, so a change of output language has no
    // bearing on a tone the customer already picked.
    setData((d) => ({ ...d, language: l }));
  };

  const canSubmit =
    !!data.language &&
    !!data.productName &&
    !!data.productDesc &&
    !!data.price &&
    !!data.usp &&
    !!data.ageRange &&
    !!data.gender &&
    !!data.occupation &&
    !!data.painPoint &&
    !!data.dream &&
    !!data.cta &&
    !!data.tone;

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      {/* `relative` so the history button can sit in the corner on a real screen
          WITHOUT taking a row of its own — the questionnaire fitting on one
          1080p screen is a property worth protecting, and a new header row is
          exactly what would break it. */}
      <div className="relative mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.appTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.appSubtitle}</p>
        {onOpenHistory && (
          // Phone: a normal centred row under the subtitle (that screen scrolls
          // anyway, and a corner button would collide with the wrapped title).
          // sm and up: pinned top-right, contributing zero height.
          <div className="mt-4 flex justify-center sm:absolute sm:right-0 sm:top-0 sm:mt-0">
            <Button variant="outline" size="sm" onClick={onOpenHistory}>
              <Clock className="mr-1.5 h-4 w-4" />
              {t.historyButton}
            </Button>
          </div>
        )}
      </div>

      <Card className="glass-panel space-y-5 p-5">
        {/* Language */}
        <section className="space-y-3">
          <SectionHeader title={t.steps[0]} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Languages className="h-4 w-4" />
            {t.chooseLanguageHint}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["zh", "en", "ms"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                className={`rounded-2xl px-4 py-4 text-base font-semibold transition-all duration-300 ${
                  data.language === l
                    ? "bg-[#fed50a] border-2 border-[#141414] text-[#141414]"
                    : "glass-input hover:-translate-y-0.5"
                }`}
              >
                {l === "zh" ? "华文" : l === "en" ? "English" : "Malay"}
              </button>
            ))}
          </div>
        </section>

        {/* The three content blocks, side by side on a wide screen. */}
        <div className={COLUMNS_CLS}>

          {/* Product */}
          <section className="space-y-3">
            <SectionHeader title={t.steps[1]} />
            <div className={STACK_CLS}>
              <Field label={t.productName} required>
                <Input
                  className={FIELD_CLS}
                  value={data.productName}
                  onChange={(e) => update("productName", e.target.value)}
                  placeholder={t.productNamePh}
                />
              </Field>
              <Field label={t.price} required>
                <Input
                  className={FIELD_CLS}
                  value={data.price}
                  onChange={(e) => update("price", e.target.value)}
                  placeholder={t.pricePh}
                />
              </Field>
              <Field label={t.productDesc} required>
                <Input
                  className={FIELD_CLS}
                  value={data.productDesc}
                  onChange={(e) => update("productDesc", e.target.value)}
                  placeholder={t.productDescPh}
                />
              </Field>
              <Field label={t.usp} required>
                <Textarea
                  ref={registerTextarea("usp")}
                  className={TEXTAREA_CLS}
                  rows={2}
                  value={data.usp}
                  onChange={(e) => {
                    update("usp", e.target.value);
                    autoGrow(e.currentTarget);
                  }}
                  placeholder={t.uspPh}
                />
              </Field>
            </div>
          </section>

          {/* Audience */}
          <section className="space-y-3">
            <SectionHeader title={t.steps[2]} />
            <div className={STACK_CLS}>
              <Field label={t.ageRange} required>
                {(() => {
                  const isUnlimited = data.ageRange === AGE_ANY;
                  const m = data.ageRange.match(/^(\d+)-(\d+)$/);
                  const lo = m ? parseInt(m[1], 10) : 25;
                  const hi = m ? parseInt(m[2], 10) : 45;
                  const setRange = (v: number[]) => {
                    const [a, b] = v;
                    update("ageRange", `${Math.min(a, b)}-${Math.max(a, b)}`);
                  };
                  return (
                    <div className={GROUP_CLS}>
                      <div className="grid grid-cols-2 gap-2 p-1">
                        <button
                          type="button"
                          onClick={() => !m && setRange([25, 45])}
                          className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                            !isUnlimited && !!data.ageRange
                              ? "bg-[#fed50a] border-2 border-[#141414] text-[#141414]"
                              : "glass-input hover:-translate-y-0.5"
                          }`}
                        >
                          {t.ageNumeric}
                        </button>
                        <button
                          type="button"
                          onClick={() => update("ageRange", AGE_ANY)}
                          className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                            isUnlimited
                              ? "bg-[#fed50a] border-2 border-[#141414] text-[#141414]"
                              : "glass-input hover:-translate-y-0.5"
                          }`}
                        >
                          {OPTION_LABELS[lang].age[AGE_ANY]}
                        </button>
                      </div>
                      {!isUnlimited && !!data.ageRange && (
                        <div className="px-3 pt-3 pb-2">
                          <SliderPrimitive.Root
                            min={3}
                            max={70}
                            step={1}
                            minStepsBetweenThumbs={1}
                            value={[lo, hi]}
                            onValueChange={setRange}
                            className="relative flex w-full touch-none select-none items-center"
                          >
                            <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
                              <SliderPrimitive.Range className="absolute h-full bg-[#141414]" />
                            </SliderPrimitive.Track>
                            <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-[#141414] bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]" />
                            <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-[#141414] bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]" />
                          </SliderPrimitive.Root>
                          <div className="mt-2 text-center text-sm font-semibold text-[#141414]">
                            {lo} - {hi} {t.ageYearsLabel}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Field>
              {/* Kept full width: three options side by side, and the longest
                  Malay label ("Perempuan") is clipped in a half-width column. */}
              <Field label={t.gender} required>
                <div className={GROUP_CLS}>
                  <div className="grid grid-cols-3 gap-2">
                    {GENDER_KEYS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => update("gender", k)}
                        className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                          data.gender === k
                            ? "bg-[#fed50a] border-2 border-[#141414] text-[#141414]"
                            : "glass-input hover:-translate-y-0.5"
                        }`}
                      >
                        {OPTION_LABELS[lang].gender[k]}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
              <Field label={t.occupation} required>
                <Input
                  className={FIELD_CLS}
                  value={data.occupation}
                  onChange={(e) => update("occupation", e.target.value)}
                  placeholder={t.occupationPh}
                />
              </Field>
            </div>
          </section>

          {/* Trust & Action / Style */}
          <section className="space-y-3">
            <SectionHeader title={t.steps[3]} />
            <div className={STACK_CLS}>
              <Field label={t.cta} required>
                <Select value={data.cta} onValueChange={(v) => update("cta", v)}>
                  <SelectTrigger className={FIELD_CLS}>
                    <SelectValue placeholder={t.ctaPh} />
                  </SelectTrigger>
                  <SelectContent>
                    {CTA_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {OPTION_LABELS[lang].cta[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t.tone} required>
                <div className={GROUP_CLS}>
                  <div className="grid grid-cols-2 gap-2">
                    {TONE_KEYS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => update("tone", k)}
                        className={`rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${
                          data.tone === k
                            ? "bg-[#fed50a] border-2 border-[#141414] text-[#141414]"
                            : "glass-input hover:-translate-y-0.5"
                        }`}
                      >
                        {OPTION_LABELS[lang].tone[k]}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            </div>
          </section>
        </div>

        {/* The two long answers, full width. No heading of their own (that would
            mean new copy in all three languages) — the rule keeps them from
            reading as orphans under the columns. */}
        <div className="space-y-3">
          <div className="border-b" />
          <div className={LONG_ROW_CLS}>
            <Field label={t.painPoint} required>
              <Textarea
                ref={registerTextarea("painPoint")}
                className={TEXTAREA_CLS}
                rows={2}
                value={data.painPoint}
                onChange={(e) => {
                  update("painPoint", e.target.value);
                  autoGrow(e.currentTarget);
                }}
                placeholder={t.painPointPh}
              />
            </Field>
            <Field label={t.dream} required>
              <Textarea
                ref={registerTextarea("dream")}
                className={TEXTAREA_CLS}
                rows={2}
                value={data.dream}
                onChange={(e) => {
                  update("dream", e.target.value);
                  autoGrow(e.currentTarget);
                }}
                placeholder={t.dreamPh}
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onSubmit(data)} disabled={!canSubmit || disabled} size="lg">
            <Sparkles className="mr-2 h-4 w-4" />
            {t.submit}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-b pb-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  /** Grid placement, e.g. `md:col-span-2` for a field that spans both columns. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-foreground">*</span>}
      </Label>
      {children}
    </div>
  );
}
