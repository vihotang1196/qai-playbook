import { useEffect, useState } from "react";
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
import { Sparkles, Languages } from "lucide-react";
import type { SurveyInput } from "@/lib/copywriter/types";
import { T, type Language, loadLang, saveLang } from "@/lib/copywriter/i18n";

const DRAFT_KEY = "qai_survey_draft";

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
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
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

// The audience block has five fields and would otherwise set the height of the
// whole row. Once we're in three-column mode (and only then — in one/two-column
// mode each column is already wide and there is no height problem to solve), its
// short fields pair up, which is what brings the form onto a single screen.
const PAIR_CLS = "grid grid-cols-1 gap-3 2xl:grid-cols-2";

export function Survey({
  onSubmit,
  /** Held down while a generation this browser started is still unaccounted for.
   *  Submitting again would start a second billable run for the same copy. */
  disabled = false,
}: {
  onSubmit: (data: SurveyInput) => void;
  disabled?: boolean;
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

  const lang: Language = data.language || "zh";
  const t = T[lang];

  const update = <K extends keyof SurveyInput>(k: K, v: SurveyInput[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const setLanguage = (l: Language) => {
    saveLang(l);
    setData((d) => ({ ...d, language: l, tone: d.tone || T[l].toneOptions[1] }));
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
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.appTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.appSubtitle}</p>
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
                  className={FIELD_CLS}
                  rows={3}
                  value={data.usp}
                  onChange={(e) => update("usp", e.target.value)}
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
                  const isUnlimited =
                    !!data.ageRange && !/^\d+-\d+$/.test(data.ageRange);
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
                          onClick={() => update("ageRange", t.ageUnlimited)}
                          className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                            isUnlimited
                              ? "bg-[#fed50a] border-2 border-[#141414] text-[#141414]"
                              : "glass-input hover:-translate-y-0.5"
                          }`}
                        >
                          {t.ageUnlimited}
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
                    {t.genderOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => update("gender", opt)}
                        className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                          data.gender === opt
                            ? "bg-[#fed50a] border-2 border-[#141414] text-[#141414]"
                            : "glass-input hover:-translate-y-0.5"
                        }`}
                      >
                        {opt}
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
              {/* Paired, and the same rows so the two boxes line up. */}
              <div className={PAIR_CLS}>
                <Field label={t.painPoint} required>
                  <Textarea
                    className={FIELD_CLS}
                    rows={3}
                    value={data.painPoint}
                    onChange={(e) => update("painPoint", e.target.value)}
                    placeholder={t.painPointPh}
                  />
                </Field>
                <Field label={t.dream} required>
                  <Textarea
                    className={FIELD_CLS}
                    rows={3}
                    value={data.dream}
                    onChange={(e) => update("dream", e.target.value)}
                    placeholder={t.dreamPh}
                  />
                </Field>
              </div>
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
                    {t.ctaOptions.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t.tone} required>
                <div className={GROUP_CLS}>
                  <div className="grid grid-cols-2 gap-2">
                    {t.toneOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => update("tone", opt)}
                        className={`rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${
                          data.tone === opt
                            ? "bg-[#fed50a] border-2 border-[#141414] text-[#141414]"
                            : "glass-input hover:-translate-y-0.5"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            </div>
          </section>
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
