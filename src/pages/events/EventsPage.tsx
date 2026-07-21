import { useSearchParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Offline Event — CUSTOMER booking page (`/events`). Scaffold placeholder (P0).
 *
 * Identity = GHL `location_id` from the URL (trust-the-URL, same weak model as
 * Review Boost / Helpdesk). Entered via a GHL custom menu link
 * `/events?location_id={{location.id}}`. The real identity gate + tool-access
 * check + booking flow land in P3/P4. For now this just proves the route
 * renders inside the shared Layout (Playbook navbar + footer).
 */
export default function EventsPage() {
  const [params] = useSearchParams();
  const locationId = params.get("location_id")?.trim() || "";
  const { lang } = useLang();

  return (
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-3xl mx-auto">
        <div className="glass-card rounded-3xl px-6 py-12 flex flex-col items-center text-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <CalendarDays className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl">
              {lang === "cn" ? "线下活动报名" : "Offline Event Booking"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {lang === "cn"
                ? "此工具正在搭建中（选座 · 报名 · 收款 · 电子票 · 签到）。"
                : "This tool is under construction (seats · booking · payment · e-ticket · check-in)."}
            </p>
          </div>
          <p className="text-xs text-muted-foreground font-mono break-all">
            location_id: {locationId || "(none)"}
          </p>
        </div>
      </div>
    </div>
  );
}
