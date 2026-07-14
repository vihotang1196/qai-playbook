import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { GenerateResult, SurveyInput } from "./types";

/**
 * Call the `generate-copy` Supabase Edge Function (which calls Claude) and
 * return the generated ad + funnel copy. Throws an Error with a human-readable
 * message the UI can toast.
 */
export async function generateCopy(input: SurveyInput): Promise<GenerateResult> {
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
