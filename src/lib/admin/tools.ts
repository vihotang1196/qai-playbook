// Platform tool registry — the single source of truth for which tools the Admin
// Portal knows about. Drives the per-tool access toggles + (later) stats. Adding
// a new tool = one entry here (and, server-side, the KNOWN_TOOLS set in the
// `admin` edge fn).
//
// `live: false` = shown as a placeholder ("即将") but not yet toggleable/metered.

export type ToolKey = "review_boost" | "copywriter" | "offline_event" | "helpdesk";

export type AdminTool = {
  key: ToolKey;
  name: { cn: string; en: string };
  live: boolean;
};

export const ADMIN_TOOLS: AdminTool[] = [
  { key: "review_boost", name: { cn: "Review Boost", en: "Review Boost" }, live: true },
  // live:true so the per-location toggle is usable — REQUIRED for the canary
  // whitelist. This flag only controls the Admin Portal toggle; the customer nav
  // entry is separate (still hidden in Navbar.tsx until the owner opens it).
  { key: "copywriter", name: { cn: "文案生成器", en: "Copywriter" }, live: true },
  // Helpdesk content stays agency-wide shared; this toggle only controls who may
  // OPEN the help center (needed for the canary rollout).
  { key: "helpdesk", name: { cn: "帮助中心", en: "Helpdesk" }, live: true },
  // Live from P3: the customer /events flow enforces per-location access
  // (hasToolAccess) server-side in the `oe` edge fn.
  { key: "offline_event", name: { cn: "Offline Event", en: "Offline Event" }, live: true },
];
