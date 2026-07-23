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

// Visual cue: empty required = red border; filled = teal border.
// Use ! to override glass-input's `border` shorthand.
const fieldCls = (v: string) =>
  v
    ? "!border !border-teal-500 focus-visible:!ring-teal-500"
    : "!border !border-red-400 focus-visible:!ring-red-400";

const groupCls = (v: string) =>
  v
    ? "rounded-2xl border border-teal-500 p-1.5"
    : "rounded-2xl border border-red-400 p-1.5";

export function Survey({ onSubmit }: { onSubmit: (data: SurveyInput) => void }) {
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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.appTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.appSubtitle}</p>
      </div>

      <Card className="glass-panel space-y-8 p-6">
        {/* Language */}
        <section className="space-y-4">
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
                className={`rounded-2xl px-4 py-5 text-base font-semibold transition-all duration-300 ${
                  data.language === l
                    ? "bg-teal-50 border-2 border-teal-500 text-teal-700"
                    : "glass-input hover:-translate-y-0.5"
                }`}
              >
                {l === "zh" ? "华文" : l === "en" ? "English" : "Malay"}
              </button>
            ))}
          </div>
        </section>

        {/* Product */}
        <section className="space-y-4">
          <SectionHeader title={t.steps[1]} />
          <Field label={t.productName} required>
            <Input
              className={fieldCls(data.productName)}
              value={data.productName}
              onChange={(e) => update("productName", e.target.value)}
              placeholder={t.productNamePh}
            />
          </Field>
          <Field label={t.productDesc} required>
            <Input
              className={fieldCls(data.productDesc)}
              value={data.productDesc}
              onChange={(e) => update("productDesc", e.target.value)}
              placeholder={t.productDescPh}
            />
          </Field>
          <Field label={t.price} required>
            <Input
              className={fieldCls(data.price)}
              value={data.price}
              onChange={(e) => update("price", e.target.value)}
              placeholder={t.pricePh}
            />
          </Field>
          <Field label={t.usp} required>
            <Textarea
              className={fieldCls(data.usp)}
              rows={3}
              value={data.usp}
              onChange={(e) => update("usp", e.target.value)}
              placeholder={t.uspPh}
            />
          </Field>
        </section>

        {/* Audience */}
        <section className="space-y-4">
          <SectionHeader title={t.steps[2]} />
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
                <div className={groupCls(data.ageRange)}>
                  <div className="grid grid-cols-2 gap-2 p-1">
                    <button
                      type="button"
                      onClick={() => !m && setRange([25, 45])}
                      className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                        !isUnlimited && !!data.ageRange
                          ? "bg-teal-50 border-2 border-teal-500 text-teal-700"
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
                          ? "bg-teal-50 border-2 border-teal-500 text-teal-700"
                          : "glass-input hover:-translate-y-0.5"
                      }`}
                    >
                      {t.ageUnlimited}
                    </button>
                  </div>
                  {!isUnlimited && !!data.ageRange && (
                    <div className="px-3 pt-4 pb-3">
                      <SliderPrimitive.Root
                        min={3}
                        max={70}
                        step={1}
                        minStepsBetweenThumbs={1}
                        value={[lo, hi]}
                        onValueChange={setRange}
                        className="relative flex w-full touch-none select-none items-center"
                      >
                        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-teal-100">
                          <SliderPrimitive.Range className="absolute h-full bg-teal-500" />
                        </SliderPrimitive.Track>
                        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-teal-500 bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" />
                        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-teal-500 bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" />
                      </SliderPrimitive.Root>
                      <div className="mt-3 text-center text-sm font-semibold text-teal-700">
                        {lo} - {hi} {t.ageYearsLabel}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </Field>
          <Field label={t.gender} required>
            <div className={groupCls(data.gender)}>
              <div className="grid grid-cols-3 gap-2">
                {t.genderOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update("gender", opt)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                      data.gender === opt
                        ? "bg-teal-50 border-2 border-teal-500 text-teal-700"
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
              className={fieldCls(data.occupation)}
              value={data.occupation}
              onChange={(e) => update("occupation", e.target.value)}
              placeholder={t.occupationPh}
            />
          </Field>
          <Field label={t.painPoint} required>
            <Textarea
              className={fieldCls(data.painPoint)}
              rows={3}
              value={data.painPoint}
              onChange={(e) => update("painPoint", e.target.value)}
              placeholder={t.painPointPh}
            />
          </Field>
          <Field label={t.dream} required>
            <Textarea
              className={fieldCls(data.dream)}
              rows={3}
              value={data.dream}
              onChange={(e) => update("dream", e.target.value)}
              placeholder={t.dreamPh}
            />
          </Field>
        </section>

        {/* Trust & Action / Style */}
        <section className="space-y-4">
          <SectionHeader title={t.steps[3]} />
          <Field label={t.cta} required>
            <Select value={data.cta} onValueChange={(v) => update("cta", v)}>
              <SelectTrigger className={fieldCls(data.cta)}>
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
            <div className={groupCls(data.tone)}>
              <div className="grid grid-cols-2 gap-2">
                {t.toneOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update("tone", opt)}
                    className={`rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ${
                      data.tone === opt
                        ? "bg-teal-50 border-2 border-teal-500 text-teal-700"
                        : "glass-input hover:-translate-y-0.5"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </Field>
        </section>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onSubmit(data)} disabled={!canSubmit} size="lg">
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
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
