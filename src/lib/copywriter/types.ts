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
