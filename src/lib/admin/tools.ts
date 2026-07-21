// Platform tool registry — the single source of truth for which tools the Admin
// Portal knows about. Drives the per-tool access toggles + (later) stats. Adding
// a new tool = one entry here (and, server-side, the KNOWN_TOOLS set in the
// `admin` edge fn).
//
// `live: false` = shown as a placeholder ("即将") but not yet toggleable/metered
// (e.g. the copywriter, which has no per-location identity yet).

export type ToolKey = "review_boost" | "copywriter" | "offline_event";

export type AdminTool = {
  key: ToolKey;
  name: { cn: string; en: string };
  live: boolean;
};

export const ADMIN_TOOLS: AdminTool[] = [
  { key: "review_boost", name: { cn: "Review Boost", en: "Review Boost" }, live: true },
  { key: "copywriter", name: { cn: "文案生成器", en: "Copywriter" }, live: false },
  // Registered now (P0). Flip to live:true in P3 when per-location access is
  // actually enforced (hasToolAccess) in the customer booking flow.
  { key: "offline_event", name: { cn: "Offline Event", en: "Offline Event" }, live: false },
];
