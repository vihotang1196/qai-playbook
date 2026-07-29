import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { GenerateResult, SurveyInput } from "./types";

// Fatal errors that a retry can't fix (bad config / key / input). Everything
// else — incomplete output, truncation, model overload, upstream 429, network —
// is a transient hiccup worth one more independent attempt.
function isFatal(message: string): boolean {
  return (
    /not configured/i.test(message) ||
    /ANTHROPIC_API_KEY/i.test(message) ||
    /Missing product/i.test(message) ||
    /缺少产品资料/.test(message)
  );
}

/** Server-side refusals that retrying would only make worse: our own per-account
 *  quota, a missing identity, or the tool being switched off for this account.
 *  Flagged by machine-readable `code` (never by matching display text) so the
 *  retry loop can't burn three attempts on a hard "no". */
const NO_RETRY_CODES = new Set(["quota_exceeded", "location_required", "tool_disabled"]);

type TaggedError = Error & { noRetry?: boolean };

async function invokeGenerateCopy(
  input: SurveyInput,
  locationId: string,
  requestId?: string,
): Promise<GenerateResult> {
  const supabase = getSupabase();

  const { data, error } = await supabase.functions.invoke<GenerateResult>("generate-copy", {
    // locationId identifies the sub-account: the server requires it, checks the
    // tool is enabled for them, and meters/rate-limits per account.
    // requestId is per-BROWSER, not per-account, and is what recoverCopy matches
    // on — see the comment there.
    body: { ...input, locationId, requestId },
  });

  if (error) {
    // For non-2xx responses supabase-js gives a FunctionsHttpError whose
    // `context` is the raw Response — dig out the function's { error } message.
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.error) {
          const e: TaggedError = new Error(body.error);
          if (body?.code && NO_RETRY_CODES.has(body.code)) e.noRetry = true;
          throw e;
        }
      } catch (inner) {
        if (inner instanceof Error && inner.message) throw inner;
      }
    }
    throw new Error(error.message || "Generation failed");
  }

  if (!data) {
    throw new Error("AI returned empty");
  }

  return data;
}

/**
 * Call the `generate-copy` Supabase Edge Function (which calls Claude) and
 * return the generated ad + funnel copy. Throws an Error with a human-readable
 * message the UI can toast.
 *
 * Claude's tool use occasionally returns a malformed field (e.g. funnel as a
 * badly-escaped string) → the function reports "incomplete output". We retry up
 * to 3 times: each call is an independent request with its own timeout budget,
 * so retrying here (not in the Edge Function) avoids the ~150s idle limit.
 */
export async function generateCopy(
  input: SurveyInput,
  locationId: string,
  requestId?: string,
): Promise<GenerateResult> {
  const MAX_ATTEMPTS = 3;
  let lastError: TaggedError = new Error("Generation failed");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await invokeGenerateCopy(input, locationId, requestId);
    } catch (e) {
      lastError = (e instanceof Error ? e : new Error(String(e))) as TaggedError;
      // A quota/identity/access refusal is a hard no — retrying would just spend
      // three round-trips to be told the same thing.
      if (lastError.noRetry || isFatal(lastError.message) || attempt === MAX_ATTEMPTS) break;
    }
  }

  throw lastError;
}

/**
 * Ask the server whether a generation this browser started ever finished.
 *
 * A generation runs ~2 minutes and is billed the moment it starts. If the tab is
 * refreshed, backgrounded, or loses signal, the fetch dies but the Edge Function
 * runs to completion and Anthropic still charges for it. This collects that
 * paid-for result instead of the customer paying a second time.
 *
 * Matches on `requestId` — minted per browser — NOT on locationId, which is the
 * sub-account and is shared by everyone working under that client. Keyed on the
 * account, "the newest result" would hand one person the product details another
 * person just typed in.
 *
 * Returns null when nothing has landed yet (still running, or it failed).
 */
export async function recoverCopy(
  locationId: string,
  requestId: string,
): Promise<GenerateResult | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke<{ result: GenerateResult | null }>(
    "generate-copy",
    { body: { action: "recover", locationId, requestId } },
  );
  // Recovery is a best-effort convenience on top of a normal flow — if the
  // lookup itself fails, say "nothing yet" rather than surfacing an error for a
  // request the customer never made.
  if (error) return null;
  return data?.result ?? null;
}

/**
 * Call the `generate-voice` Edge Function (MiniMax TTS) for one narration
 * segment. Returns an mp3 data URL to feed into an <audio> element.
 */
export async function generateVoice(
  text: string,
  language: "zh" | "en" | "ms",
  locationId: string,
): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase.functions.invoke<{ dataUrl: string }>("generate-voice", {
    // Same identity rule as generate-copy: MiniMax TTS costs money, so the
    // server requires a location_id and meters/limits per account.
    body: { text, language, locationId },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.error) throw new Error(body.error);
      } catch (inner) {
        if (inner instanceof Error && inner.message) throw inner;
      }
    }
    throw new Error(error.message || "Voice generation failed");
  }

  if (!data?.dataUrl) {
    throw new Error("Voice generation returned empty");
  }

  return data.dataUrl;
}
