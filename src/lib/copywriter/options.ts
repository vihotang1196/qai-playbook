/**
 * Survey option keys + labels, re-exported for the frontend.
 *
 * The definitions live in `supabase/functions/_shared/copy-options.ts` because
 * the edge function CAN'T import from `src/` (only its own directory ships to
 * Deno) while the frontend CAN import from anywhere in the repo. Putting the
 * single source of truth on the side with the tighter constraint is what lets
 * both sides share ONE table instead of keeping two in sync by hand.
 *
 * This file exists so app code keeps a normal `@/lib/copywriter/...` import
 * instead of reaching across the tree with a relative path.
 */
export {
  TONE_KEYS,
  GENDER_KEYS,
  CTA_KEYS,
  AGE_ANY,
  OPTION_LABELS,
  isOptionKey,
  normalizeOptionValue,
  optionLabel,
} from "../../../supabase/functions/_shared/copy-options";

export type {
  OptionLang,
  OptionGroup,
  ToneKey,
  GenderKey,
  CtaKey,
} from "../../../supabase/functions/_shared/copy-options";
