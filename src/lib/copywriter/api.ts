import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { GenerateResult, SurveyInput } from "./types";

// Fatal errors that a retry can't fix (bad config / key / input). Everything
// else — incomplete output, truncation, overload, rate limit, network — is a
// transient/model hiccup worth one more independent attempt.
function isFatal(message: string): boolean {
  return (
    /not configured/i.test(message) ||
    /ANTHROPIC_API_KEY/i.test(message) ||
    /Missing product/i.test(message) ||
    /缺少产品资料/.test(message)
  );
}

async function invokeGenerateCopy(input: SurveyInput): Promise<GenerateResult> {
  const supabase = getSupabase();

  const { data, error } = await supabase.functions.invoke<GenerateResult>("generate-copy", {
    body: input,
  });

  if (error) {
    // For non-2xx responses supabase-js gives a FunctionsHttpError whose
    // `context` is the raw Response — dig out the function's { error } message.
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.error) throw new Error(body.error);
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
export async function generateCopy(input: SurveyInput): Promise<GenerateResult> {
  const MAX_ATTEMPTS = 3;
  let lastError: Error = new Error("Generation failed");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await invokeGenerateCopy(input);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (isFatal(lastError.message) || attempt === MAX_ATTEMPTS) break;
    }
  }

  throw lastError;
}

/**
 * Call the `generate-voice` Edge Function (MiniMax TTS) for one narration
 * segment. Returns an mp3 data URL to feed into an <audio> element.
 */
export async function generateVoice(
  text: string,
  language: "zh" | "en" | "ms",
): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase.functions.invoke<{ dataUrl: string }>("generate-voice", {
    body: { text, language },
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
