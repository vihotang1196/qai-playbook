import { getSupabase } from "@/lib/supabase";

// ════════════════════════════════════════════════════════════════════════
// SHARED, tool-neutral GHL identity helpers (frontend side).
//
// How identity works (matches the Lovable original + NurtureOS): the admin is
// embedded in GoHighLevel via a custom-menu-link iframe whose URL carries the
// current sub-account's location_id (a GHL merge field, e.g.
// `?location_id={{location.id}}`). We read it from the URL, then resolve the
// full location via the shared `ghl` edge function (service role).
//
// No SSO / decryption yet — identity is trust-the-URL for now, hardened later.
// ════════════════════════════════════════════════════════════════════════

/** Read the GHL location_id from the URL — path (/location/:id) or query. */
export function getLocationIdFromUrl(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "",
  search: string = typeof window !== "undefined" ? window.location.search : "",
): string {
  const m = pathname.match(/\/location\/([^/?#]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  const p = new URLSearchParams(search);
  return p.get("locationId") || p.get("location_id") || "";
}

/** Sub-account (customer) view vs the agency root. */
export function isCustomerView(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "",
  search: string = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  if (/\/location\//.test(pathname)) return true;
  const p = new URLSearchParams(search);
  return (
    p.get("view") === "customer" ||
    p.get("ghl") === "true" ||
    p.get("embed") === "true" ||
    !!p.get("locationId") ||
    !!p.get("location_id")
  );
}

const LOCATION_KEY = "pb_location_id";

/**
 * Persist the GHL location_id for the whole TAB SESSION the first time it's seen
 * in the URL. GHL opens Playbook with `?location_id=…` on entry, but the shared
 * navbar navigates with plain <a> links that DROP the query string — so without
 * this, clicking from the homepage into a tool would lose the identity and hit
 * the "open from QAI" block. Stashing it here lets every page recover it via
 * getStoredLocationId(). sessionStorage = per tab, cleared when the tab closes
 * (so a fresh manual visit with no id still correctly blocks).
 * (Ported from feat/helpdesk — shared, tool-neutral identity infra.)
 */
export function rememberLocationId(
  search: string = typeof window !== "undefined" ? window.location.search : "",
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "",
): void {
  try {
    const id = getLocationIdFromUrl(pathname, search);
    if (id) sessionStorage.setItem(LOCATION_KEY, id);
  } catch {
    /* sessionStorage unavailable (private mode / SSR) — URL-only fallback */
  }
}

/** The location_id stashed for this tab session (see rememberLocationId), or "". */
export function getStoredLocationId(): string {
  try {
    return sessionStorage.getItem(LOCATION_KEY) || "";
  } catch {
    return "";
  }
}

/** URL location_id if present, else the one stashed this tab session. Use this
 *  for tools reached via the shared navbar (which drops the query string). */
export function resolveLocationId(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "",
  search: string = typeof window !== "undefined" ? window.location.search : "",
): string {
  return getLocationIdFromUrl(pathname, search) || getStoredLocationId();
}

// ── GHL staff identity (Need 2 — helpdesk per-staff attribution) ─────────────
// The GHL Custom Menu Link can also carry the logged-in staff via merge fields:
//   ?location_id={{location.id}}&staff_email={{user.email}}&staff_name={{user.name}}
// ({{user.id}} is NOT a Custom-Menu-Link merge field, so email is the identifier.)
// Same trust-the-URL posture + tab-session persistence as location_id, so it
// survives the navbar's query-dropping navigation. Used for attribution only.
const STAFF_EMAIL_KEY = "pb_staff_email";
const STAFF_NAME_KEY = "pb_staff_name";

export type GhlStaff = { email: string; name: string };

/** Read staff_email / staff_name from the URL query. */
export function getStaffFromUrl(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): GhlStaff {
  const p = new URLSearchParams(search);
  return { email: (p.get("staff_email") || "").trim(), name: (p.get("staff_name") || "").trim() };
}

/** Stash staff identity for the tab session the first time it's in the URL (so
 *  it survives navbar navigation that drops the query string). Only writes when a
 *  value is present — never clears a previously-seen staff. */
export function rememberStaff(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): void {
  try {
    const { email, name } = getStaffFromUrl(search);
    if (email) sessionStorage.setItem(STAFF_EMAIL_KEY, email);
    if (name) sessionStorage.setItem(STAFF_NAME_KEY, name);
  } catch {
    /* sessionStorage unavailable — URL-only fallback */
  }
}

/** Staff from the URL if present, else the one stashed this tab session. */
export function resolveStaff(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): GhlStaff {
  const fromUrl = getStaffFromUrl(search);
  if (fromUrl.email || fromUrl.name) return fromUrl;
  try {
    return { email: sessionStorage.getItem(STAFF_EMAIL_KEY) || "", name: sessionStorage.getItem(STAFF_NAME_KEY) || "" };
  } catch {
    return { email: "", name: "" };
  }
}

const EMBED_KEY = "rb_embed";

function queryIsEmbed(search: string): boolean {
  const p = new URLSearchParams(search);
  return p.get("embed") === "true" || p.get("ghl") === "true";
}

/**
 * Persist embed mode for the tab session once it's seen in the URL. GHL loads
 * the iframe with `?embed=true` (or `?ghl=true`) only on the FIRST URL; in-app
 * navigation then drops the query string. Remembering it keeps the Playbook
 * chrome hidden for the whole iframe session instead of flashing back.
 */
export function rememberEmbed(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): void {
  try {
    if (queryIsEmbed(search)) sessionStorage.setItem(EMBED_KEY, "1");
  } catch {
    /* sessionStorage unavailable (private mode / SSR) — fall back to query only */
  }
}

/** Embedded inside the GHL iframe → hide the Playbook site chrome. */
export function isEmbed(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  if (queryIsEmbed(search)) return true;
  try {
    return sessionStorage.getItem(EMBED_KEY) === "1";
  } catch {
    return false;
  }
}

export type GhlLocation = {
  location_id: string;
  business_name: string | null;
  logo_url: string | null;
  niche: string | null;
  email: string | null;
  phone: string | null;
  is_enabled: boolean;
};

/** Call the shared `ghl` edge function (service role behind it). */
export async function callGhl<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("ghl", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export async function fetchLocation(locationId: string): Promise<GhlLocation | null> {
  const { location } = await callGhl<{ location: GhlLocation | null }>("getLocation", { locationId });
  return location;
}

// ── Per-sub-account default landing page (Need 1) ───────────────────────────
// Stored server-side keyed by location_id (pb_subaccount_prefs), so it's shared
// across everyone in the sub-account (not per-device). Read on Playbook entry to
// redirect; written by the navbar "set default page" button.

/** This sub-account's chosen default page path, or null if none set.
 *  Fail-safe: returns null on any error (→ caller falls back / no redirect). */
export async function getDefaultPage(locationId: string): Promise<string | null> {
  if (!locationId) return null;
  try {
    const { default_path } = await callGhl<{ default_path: string | null }>("getSubaccountPrefs", { locationId });
    return default_path ?? null;
  } catch {
    return null;
  }
}

/** Set (or clear, when path is "") this sub-account's default page. Throws on failure. */
export async function setDefaultPage(locationId: string, path: string): Promise<void> {
  if (!locationId) return;
  await callGhl("setSubaccountPrefs", { locationId, default_path: path });
}

// Agency-only operations (list ALL sub-accounts, toggle access, trigger sync)
// are intentionally NOT here — the customer app must not be able to call them.
// They move to the authenticated Admin Portal (real login + admin check).
// The underlying logic stays in supabase/functions/_shared/ghl.ts for that
// authenticated caller.
