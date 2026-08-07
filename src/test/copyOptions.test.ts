import { describe, it, expect } from "vitest";
import {
  TONE_KEYS,
  GENDER_KEYS,
  CTA_KEYS,
  AGE_ANY,
  OPTION_LABELS,
  normalizeOptionValue,
  optionLabel,
  type OptionLang,
} from "@/lib/copywriter/options";

/**
 * These cover the two things that break silently.
 *
 * 1. The server renders option keys into the OUTPUT language when it builds the
 *    prompt. `optionLabel` IS that step — the edge function calls this exact
 *    function from this exact file, so exercising it here exercises the server's
 *    mapping without spending money on a real generation.
 * 2. Drafts saved before keys existed hold a localized label. `normalizeOptionValue`
 *    is what turns those back into keys on load.
 */

const LANGS: OptionLang[] = ["zh", "en", "ms"];

describe("optionLabel — what the server puts in the prompt", () => {
  it("renders a key into each output language", () => {
    expect(optionLabel("tone", "professional", "ms")).toBe("Profesional");
    expect(optionLabel("tone", "professional", "zh")).toBe("专业");
    expect(optionLabel("gender", "female", "ms")).toBe("Perempuan");
    expect(optionLabel("cta", "whatsapp", "en")).toBe("WhatsApp DM");
    expect(optionLabel("age", AGE_ANY, "ms")).toBe("Tanpa had");
  });

  it("covers every key in every language — no blanks reaching the prompt", () => {
    for (const lang of LANGS) {
      for (const k of TONE_KEYS) expect(optionLabel("tone", k, lang)).toBeTruthy();
      for (const k of GENDER_KEYS) expect(optionLabel("gender", k, lang)).toBeTruthy();
      for (const k of CTA_KEYS) expect(optionLabel("cta", k, lang)).toBeTruthy();
      expect(optionLabel("age", AGE_ANY, lang)).toBeTruthy();
    }
  });

  it("passes a numeric age range through untouched", () => {
    expect(optionLabel("age", "25-45", "ms")).toBe("25-45");
    expect(optionLabel("age", "3-70", "zh")).toBe("3-70");
  });

  it("passes an unrecognised value through — an older client still works", () => {
    // A tab loaded before this change posts the label instead of the key.
    expect(optionLabel("tone", "专业", "zh")).toBe("专业");
    expect(optionLabel("gender", "Perempuan", "ms")).toBe("Perempuan");
  });

  it("returns empty for empty, never the string 'undefined'", () => {
    expect(optionLabel("tone", "", "zh")).toBe("");
  });
});

describe("normalizeOptionValue — recovering an old draft", () => {
  it("maps a label saved in ANY language back to its key", () => {
    expect(normalizeOptionValue("tone", "专业")).toBe("professional");
    expect(normalizeOptionValue("tone", "Professional")).toBe("professional");
    expect(normalizeOptionValue("tone", "Profesional")).toBe("professional");
    expect(normalizeOptionValue("gender", "男")).toBe("male");
    expect(normalizeOptionValue("gender", "Perempuan")).toBe("female");
    expect(normalizeOptionValue("cta", "WhatsApp 私讯")).toBe("whatsapp");
    expect(normalizeOptionValue("cta", "Daftar sekarang")).toBe("signup");
  });

  it("round-trips every label in every language", () => {
    for (const lang of LANGS) {
      const set = OPTION_LABELS[lang];
      for (const k of TONE_KEYS) expect(normalizeOptionValue("tone", set.tone[k])).toBe(k);
      for (const k of GENDER_KEYS) expect(normalizeOptionValue("gender", set.gender[k])).toBe(k);
      for (const k of CTA_KEYS) expect(normalizeOptionValue("cta", set.cta[k])).toBe(k);
      expect(normalizeOptionValue("age", set.age[AGE_ANY])).toBe(AGE_ANY);
    }
  });

  it("leaves a value that is already a key alone", () => {
    expect(normalizeOptionValue("tone", "professional")).toBe("professional");
    expect(normalizeOptionValue("age", AGE_ANY)).toBe(AGE_ANY);
  });

  it("keeps a numeric age range", () => {
    expect(normalizeOptionValue("age", "25-45")).toBe("25-45");
  });

  it("clears anything unrecognised rather than keeping a dirty value", () => {
    expect(normalizeOptionValue("tone", "赶时髦")).toBe("");
    expect(normalizeOptionValue("gender", "whatever")).toBe("");
    expect(normalizeOptionValue("age", "老年人")).toBe("");
    expect(normalizeOptionValue("tone", "")).toBe("");
  });

  it("ignores surrounding whitespace and casing", () => {
    expect(normalizeOptionValue("tone", "  Professional  ")).toBe("professional");
    expect(normalizeOptionValue("gender", "MALE")).toBe("male");
  });
});

describe("the two sides cannot drift", () => {
  it("frontend and edge function import the same module instance", async () => {
    // The frontend path is a re-export of the edge function's file. If someone
    // ever forks it into a second copy, these stop being identical.
    const shared = await import("../../supabase/functions/_shared/copy-options");
    const viaFrontend = await import("@/lib/copywriter/options");
    expect(viaFrontend.OPTION_LABELS).toBe(shared.OPTION_LABELS);
    expect(viaFrontend.TONE_KEYS).toBe(shared.TONE_KEYS);
  });
});
