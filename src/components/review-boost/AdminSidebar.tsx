import { NavLink } from "react-router-dom";
import { LayoutDashboard, Megaphone, Layers, Star } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { useLocationContext } from "@/hooks/useLocationContext";

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
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
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
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-[rgba(255,61,110,0.10)] text-primary font-medium"
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
