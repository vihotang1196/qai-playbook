// Supabase Edge Function (Deno) — MiniMax text-to-speech for ad-script narration.
//
// Ported from the old TanStack Start voice.functions.ts. Same MiniMax contract
// (t2a_v2, model speech-02-hd, mp3), adapted to Deno: hex audio → base64 without
// Node's Buffer, plus CORS for browser calls.
//
// Secrets (set by the project owner, never in the frontend):
//   supabase secrets set MINIMAX_API_KEY=...
//   supabase secrets set MINIMAX_GROUP_ID=...
//   supabase secrets set MINIMAX_VOICE_ID_ZH=...   # default voice
//   (optional) MINIMAX_VOICE_ID_EN / MINIMAX_VOICE_ID_MS for per-language voices

const MINIMAX_MODEL = "speech-02-hd";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Language = "zh" | "en" | "ms";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** hex string → base64, chunked so large audio doesn't overflow the call stack. */
function hexToBase64(hex: string): string {
  const len = Math.floor(hex.length / 2);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function voiceIdFor(lang: Language): string {
  return (
    Deno.env.get(`MINIMAX_VOICE_ID_${lang.toUpperCase()}`) ||
    Deno.env.get("MINIMAX_VOICE_ID_ZH") ||
    "viho_zh_001"
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Parse + validate input
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  const lang: Language =
    raw.language === "en" || raw.language === "ms" ? raw.language : "zh";

  if (!text) {
    return json({ error: lang === "en" ? "No text to read" : "没有可朗读的文本" }, 400);
  }
  if (text.length > 2000) {
    return json({ error: lang === "en" ? "Text too long (max 2000 chars)" : "文本过长（上限 2000 字）" }, 400);
  }

  const apiKey = Deno.env.get("MINIMAX_API_KEY");
  const groupId = Deno.env.get("MINIMAX_GROUP_ID");
  if (!apiKey || !groupId) {
    return json({ error: "Server misconfigured: MiniMax credentials not set" }, 500);
  }

  const url = `https://api.minimax.io/v1/t2a_v2?GroupId=${encodeURIComponent(groupId)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        text,
        voice_setting: {
          voice_id: voiceIdFor(lang),
          speed: 1.0,
          vol: 1.0,
          pitch: 0,
        },
        audio_setting: {
          format: "mp3",
          sample_rate: 32000,
        },
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    return json({ error: `Failed to reach MiniMax: ${msg}` }, 502);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return json({ error: `MiniMax ${res.status}: ${detail}` }, 502);
  }

  let payload: {
    data?: { audio?: string };
    base_resp?: { status_code?: number; status_msg?: string };
  };
  try {
    payload = await res.json();
  } catch {
    return json({ error: lang === "en" ? "MiniMax returned an unreadable response" : "MiniMax 返回无法解析" }, 502);
  }

  const hex = payload.data?.audio;
  if (!hex) {
    const msg = payload.base_resp?.status_msg || "no audio data";
    return json({ error: `MiniMax: ${msg}` }, 502);
  }

  return json({ dataUrl: `data:audio/mp3;base64,${hexToBase64(hex)}` });
});
