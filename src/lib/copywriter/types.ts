import type { Language } from "./i18n";

export type { Language };

/** The questionnaire payload the survey collects and the generator consumes. */
export interface SurveyInput {
  language: Language;
  productName: string;
  productDesc: string;
  price: string;
  usp: string;
  ageRange: string;
  gender: string;
  occupation: string;
  painPoint: string;
  dream: string;
  testimonials?: string;
  cta: string;
  tone: string;
}

/**
 * One row as the history LIST returns it. Deliberately without `input` and
 * `result`: the list endpoint omits them because a full row is 6-8KB and a page
 * of twenty would be a ~150KB payload for a screen showing only titles.
 */
export interface HistoryItem {
  id: string;
  /** May be null on rows stored before the questionnaire was captured — the UI
   *  must fall back to the date rather than render an empty title. */
  product_name: string | null;
  language: Language;
  created_at: string;
}

/** A full row, as history.get returns it. */
export interface HistoryDetail extends HistoryItem {
  /** Null when this row predates questionnaire capture. That is exactly what
   *  greys out "use as template" — there is nothing to put back in the form. */
  input: SurveyInput | null;
  result: GenerateResult;
}

/** The AI generation result. Mirrors the JSON the Edge Function returns
 *  (Phase 1). Kept in sync with the `generate-copy` function's schema. */
export type GenerateResult = {
  language: Language;
  adScript: {
    segments: Array<{
      stage: string;
      content: string;
    }>;
  };
  adCopy: string;
  funnel: Array<{ section: string; content: string }>;
  automationMessages: {
    whatsapp: {
      greeting: string;
      dayBefore: string;
      currentDay: string;
    };
    email: {
      greeting: { subject: string; body: string };
      dayBefore: { subject: string; body: string };
      currentDay: { subject: string; body: string };
    };
  };
};
