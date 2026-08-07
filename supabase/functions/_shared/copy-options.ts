// ════════════════════════════════════════════════════════════════════════════
// Copywriter survey options — THE single source of truth for both sides.
//
// The questionnaire stores STABLE KEYS ("professional"), never the localized
// label the customer happens to be looking at ("专业" / "Profesional"). The
// server turns a key back into text in the OUTPUT language when it builds the
// prompt.
//
// Why keys: the display language and the output language are about to become
// independent. With labels-as-values, someone browsing in Chinese while
// generating Malay copy would send "专业" into a Malay prompt. Keys also fix a
// live bug — switching language used to leave every button group unhighlighted
// (the stored label no longer matched any option) while Generate stayed enabled.
//
// ── HOW THE TWO SIDES STAY IN SYNC ──────────────────────────────────────────
// They import THIS FILE. There is no second copy to drift:
//   • Edge function → `../_shared/copy-options.ts`  (Deno, explicit extension)
//   • Frontend      → `@/lib/copywriter/options`    (re-export, Vite resolves)
// Deliberately dependency-free (no Deno APIs, no browser APIs, no imports) so
// both runtimes can load it as-is.
// ════════════════════════════════════════════════════════════════════════════

/** Output languages the generator supports. */
export type OptionLang = "zh" | "en" | "ms";

// Array order IS the on-screen button order — keep it stable.
export const TONE_KEYS = ["professional", "friendly", "bold", "playful"] as const;
export const GENDER_KEYS = ["male", "female", "any"] as const;
export const CTA_KEYS = ["whatsapp", "signup", "buy"] as const;

/** The age field stores "25-45" for a numeric range, or this for "no limit". */
export const AGE_ANY = "any";

export type ToneKey = (typeof TONE_KEYS)[number];
export type GenderKey = (typeof GENDER_KEYS)[number];
export type CtaKey = (typeof CTA_KEYS)[number];

/** Which set of options a value belongs to. */
export type OptionGroup = "tone" | "gender" | "cta" | "age";

type LabelSet = {
  tone: Record<ToneKey, string>;
  gender: Record<GenderKey, string>;
  cta: Record<CtaKey, string>;
  /** Label for AGE_ANY; numeric ranges are shown as-is. */
  age: Record<typeof AGE_ANY, string>;
};

/**
 * Key → the text shown for it, per language. These strings are what the
 * customer reads AND what the server feeds Claude, so they must stay natural in
 * each language rather than being literal translations of the key.
 */
export const OPTION_LABELS: Record<OptionLang, LabelSet> = {
  zh: {
    tone: { professional: "专业", friendly: "亲切", bold: "夸张吸睛", playful: "搞笑" },
    gender: { male: "男", female: "女", any: "不限" },
    cta: { whatsapp: "WhatsApp 私讯", signup: "立即报名", buy: "立即购买" },
    age: { any: "不限" },
  },
  en: {
    tone: { professional: "Professional", friendly: "Friendly", bold: "Bold & catchy", playful: "Playful" },
    gender: { male: "Male", female: "Female", any: "Any" },
    cta: { whatsapp: "WhatsApp DM", signup: "Sign up now", buy: "Buy now" },
    age: { any: "Any age" },
  },
  ms: {
    tone: { professional: "Profesional", friendly: "Mesra", bold: "Berani & menarik", playful: "Santai" },
    gender: { male: "Lelaki", female: "Perempuan", any: "Semua" },
    cta: { whatsapp: "DM WhatsApp", signup: "Daftar sekarang", buy: "Beli sekarang" },
    age: { any: "Tanpa had" },
  },
};

const KEYS_BY_GROUP: Record<OptionGroup, readonly string[]> = {
  tone: TONE_KEYS,
  gender: GENDER_KEYS,
  cta: CTA_KEYS,
  age: [AGE_ANY],
};

/** A numeric age range like "25-45", which is stored verbatim. */
const NUMERIC_AGE = /^\d+-\d+$/;

/**
 * Label → key, built from OPTION_LABELS across ALL languages so a draft saved in
 * any language can be recovered. Derived, never hand-maintained: add a language
 * or reword a label above and this follows automatically.
 */
const KEY_BY_LABEL: Record<OptionGroup, Record<string, string>> = (() => {
  const out = { tone: {}, gender: {}, cta: {}, age: {} } as Record<
    OptionGroup,
    Record<string, string>
  >;
  for (const lang of Object.keys(OPTION_LABELS) as OptionLang[]) {
    const set = OPTION_LABELS[lang];
    for (const group of Object.keys(out) as OptionGroup[]) {
      const table = set[group] as Record<string, string>;
      for (const key of Object.keys(table)) {
        out[group][table[key].trim().toLowerCase()] = key;
      }
    }
  }
  return out;
})();

/** Is this already one of the stable keys for the group? */
export function isOptionKey(group: OptionGroup, value: string): boolean {
  return KEYS_BY_GROUP[group].includes(value);
}

/**
 * Coerce a stored value into a stable key.
 *
 * Accepts a key (returned unchanged) or a localized label in ANY of the three
 * languages (mapped back to its key) — that second case is how a draft saved
 * before this change is recovered. Returns "" for anything unrecognised, so a
 * junk value clears the field and the customer re-picks instead of silently
 * shipping garbage into the prompt.
 *
 * Age is special: a numeric range ("25-45") is a legitimate value and passes
 * through untouched.
 */
export function normalizeOptionValue(group: OptionGroup, raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (group === "age" && NUMERIC_AGE.test(value)) return value;
  if (isOptionKey(group, value)) return value;
  return KEY_BY_LABEL[group][value.toLowerCase()] || "";
}

/**
 * Key → the text to show (or to put in the prompt) in `lang`.
 *
 * A value that isn't a known key is returned as-is. That is the compatibility
 * path: an older client still posting "专业" keeps working instead of erroring,
 * it just doesn't get translated.
 */
export function optionLabel(group: OptionGroup, value: string, lang: OptionLang): string {
  const v = (value || "").trim();
  if (!v) return "";
  const table = OPTION_LABELS[lang]?.[group] as Record<string, string> | undefined;
  return table?.[v] ?? v;
}
