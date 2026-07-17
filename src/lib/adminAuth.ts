import { getSupabase } from "@/lib/supabase";

// Admin Portal auth helpers. The frontend only holds the session; whether the
// signed-in user is actually an admin is decided SERVER-SIDE by the `admin`
// edge function (requireAdmin → platform_admins allowlist). The UI trusts that,
// never a local flag.

export type AdminIdentity = {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string;
};

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export async function hasSession(): Promise<boolean> {
  const { data } = await getSupabase().auth.getSession();
  return !!data.session;
}

/**
 * Resolve the current admin identity, or null if the caller isn't a signed-in
 * admin. functions.invoke auto-attaches the session access token, which the
 * `admin` fn validates + checks against the allowlist (403 → not an admin).
 */
export async function whoami(): Promise<AdminIdentity | null> {
  if (!(await hasSession())) return null;
  const { data, error } = await getSupabase().functions.invoke("admin", {
    body: { action: "whoami" },
  });
  if (error) return null; // 403 / network → treat as not-admin
  return (data as { admin?: AdminIdentity })?.admin ?? null;
}
