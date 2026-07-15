import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Plus, Megaphone, QrCode, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { RB_PLATFORMS } from "@/lib/review-boost/platforms";
import { listCampaigns, campaignShortCode, type RBCampaign } from "@/lib/reviewBoost";

/**
 * Campaigns list (`/review-boost/location/:locationId/campaigns`) — all of THIS
 * sub-account's review campaigns. Scoped to the URL location_id via the `rb`
 * edge function; the customer only ever sees its own campaigns.
 */
const platformLabel = (id: string, lang: "cn" | "en") =>
  RB_PLATFORMS.find((p) => p.id === id)?.label[lang] ?? id;

export default function LocationCampaigns() {
  const { locationId } = useParams();
  const { lang } = useLang();
  const [campaigns, setCampaigns] = useState<RBCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!locationId) return;
      setLoading(true);
      try {
        const rows = await listCampaigns(locationId);
        if (!cancelled) setCampaigns(rows);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load campaigns");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const base = `/review-boost/location/${locationId}/campaigns`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">{lang === "cn" ? "活动" : "Campaigns"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "cn"
              ? "每个活动是一个独立的商家/产品，会生成自己的二维码。"
              : "Each campaign is an independent business/product with its own QR code."}
          </p>
        </div>
        <Link
          to={`${base}/new`}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          <Plus className="w-4 h-4" />
          {lang === "cn" ? "新建活动" : "New campaign"}
        </Link>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl px-5 py-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> {lang === "cn" ? "加载中…" : "Loading…"}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass-card rounded-2xl px-5 py-12 flex flex-col items-center text-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <Megaphone className="w-6 h-6" />
          </div>
          <p className="font-display font-semibold">
            {lang === "cn" ? "还没有活动" : "No campaigns yet"}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {lang === "cn"
              ? "建一个活动，填好商家资料、选一个平台，就能拿到扫码用的二维码。"
              : "Create a campaign, fill in the business info, pick a platform, and you'll get a scannable QR code."}
          </p>
          <Link
            to={`${base}/new`}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white mt-1"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <Plus className="w-4 h-4" />
            {lang === "cn" ? "新建活动" : "New campaign"}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const code = campaignShortCode(c);
            const scans = c.rb_qr_codes?.[0]?.scan_count ?? 0;
            return (
              <Link
                key={c.id}
                to={`${base}/${c.id}`}
                className="glass-card rounded-2xl p-4 flex items-center gap-4 group"
              >
                <div className="w-11 h-11 rounded-xl bg-white shadow-sm border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Megaphone className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold truncate">{c.name}</p>
                    {!c.is_active && (
                      <span className="text-[11px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0">
                        {lang === "cn" ? "已停用" : "Paused"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {platformLabel(c.platform, lang)}
                    {c.business_name ? <span className="text-muted-foreground/60"> · {c.business_name}</span> : null}
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end text-right shrink-0">
                  <span className="text-sm font-semibold">{scans}</span>
                  <span className="text-[11px] text-muted-foreground">{lang === "cn" ? "扫码" : "scans"}</span>
                </div>
                {code && (
                  <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground font-mono shrink-0">
                    <QrCode className="w-3.5 h-3.5" />
                    {code}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
