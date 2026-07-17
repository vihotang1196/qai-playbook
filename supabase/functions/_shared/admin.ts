// ════════════════════════════════════════════════════════════════════════
// Shared admin-auth helper for the Admin Portal (platform-wide, all tools).
//
// requireAdmin(req) is the ONE gate every privileged admin operation goes
// through: it validates the caller's Supabase session JWT server-side (via the
// auth server), then confirms that user is in the platform_admins allowlist
// (service role). Returns the admin row, or null if the caller is not a signed-
// in admin. Never trust the frontend — the frontend hiding a button is not
// security; this check is.
// ════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { serviceClient } from "./ghl.ts";

export type AdminIdentity = {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string;
};

export async function requireAdmin(req: Request): Promise<AdminIdentity | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new Error("Supabase env not configured");

  // Validate the JWT against the auth server. The anon key is a valid JWT but
  // resolves to no user here, so it can't impersonate an admin.
  const authClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return null;

  // Membership check runs with the service role (platform_admins has no
  // anon/authenticated RLS policy).
  const sb = serviceClient();
  const { data, error: aErr } = await sb
    .from("platform_admins")
    .select("user_id, email, name, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!data) return null;

  return {
    user_id: data.user_id as string,
    email: (data.email as string) ?? user.email ?? null,
    name: (data.name as string) ?? null,
    role: (data.role as string) ?? "admin",
  };
}
