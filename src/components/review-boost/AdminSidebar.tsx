import { NavLink } from "react-router-dom";
import { LayoutDashboard, Megaphone, Layers, Star } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { useLocationContext } from "@/hooks/useLocationContext";

// No `end` on these: the three destinations are siblings, not nested, so exact
// matching buys nothing — and it is right for Campaigns to stay highlighted while
// you are inside /campaigns/new. The JSX used to pass `end={it.end}` for a field
// no item ever declared, which was always `undefined` at runtime and a type error
// at build time.
type Item = { to: string; icon: typeof LayoutDashboard; label: { cn: string; en: string } };

/**
 * Sub-account sidebar — ONLY shown when a location_id is present (the customer's
 * own admin). No agency/god-view nav here; that lives in the Admin Portal.
 */
export default function AdminSidebar() {
  const { lang } = useLang();
  const { isCustomerView, locationId } = useLocationContext();

  if (!isCustomerView || !locationId) return null;

  const items: Item[] = [
    { to: `/review-boost/location/${locationId}/dashboard`, icon: LayoutDashboard, label: { cn: "面板", en: "Dashboard" } },
    { to: `/review-boost/location/${locationId}/campaigns`, icon: Megaphone, label: { cn: "活动", en: "Campaigns" } },
    { to: `/review-boost/location/${locationId}/platforms`, icon: Layers, label: { cn: "平台", en: "Platforms" } },
  ];

  return (
    <aside className="shrink-0 md:w-56 w-full">
      <div className="glass-card rounded-2xl p-3 md:sticky md:top-24">
        <div className="flex items-center gap-2 px-2 pb-3 mb-2 border-b border-border/40">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#fed50a] shrink-0"
            style={{ background: "#141414" }}
          >
            <Star className="w-4 h-4" />
          </div>
          <span className="font-display font-semibold text-sm">Review Boost</span>
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-[#fed50a]/25 text-[#141414] font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`
              }
            >
              <it.icon className="w-4 h-4 shrink-0" />
              {it.label[lang]}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
