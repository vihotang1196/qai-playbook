import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy anon Supabase client. Created on first use so a missing .env doesn't
 * crash the whole app at import time — only the features that call it fail,
 * with a clear message. The frontend only ever uses the ANON key; all
 * privileged data access goes through edge functions (service role).
 */
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env",
    );
  }
  _client = createClient(url, key);
  return _client;
}
