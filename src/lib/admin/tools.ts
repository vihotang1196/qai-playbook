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
  // Live from P3: the customer /events flow enforces per-location access
  // (hasToolAccess) server-side in the `oe` edge fn.
  { key: "offline_event", name: { cn: "Offline Event", en: "Offline Event" }, live: true },
];
