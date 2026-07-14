import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public frontend config — the anon key is safe to ship to the browser.
// Set these in a local `.env` (see .env.example); never put service-role
// keys or the Anthropic key here.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

/**
 * Lazily create the Supabase client. Kept lazy so a missing `.env` doesn't
 * crash the whole app at import time — only features that actually call
 * Supabase surface a clear error.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
    );
  }
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}
