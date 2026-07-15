import { Link } from "react-router-dom";
import { Megaphone, Store, Layers, LayoutDashboard, ArrowRight, Star } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Review Boost admin landing (`/review-boost`).
 *
 * Phase 0: a styled hub that links to each section so the tool is navigable
 * while the individual pages are still stubs. Sits inside the shared <Layout>.
 * (The public customer flow lives at /scan/:code, outside this admin area.)
 */
const sections = [
  {
    to: "/review-boost/campaigns",
    icon: Megaphone,
    title: { cn: "活动", en: "Campaigns" },
    desc: { cn: "建/管理二维码好评活动", en: "Create & manage QR review campaigns" },
    phase: "Phase 5",
  },
  {
    to: "/review-boost/platforms",
    icon: Layers,
    title: { cn: "平台", en: "Platforms" },
    desc: { cn: "配置各评价平台与链接", en: "Configure review platforms & links" },
    phase: "Phase 4",
  },
  {
    to: "/review-boost/sub-accounts",
    icon: Store,
    title: { cn: "子账号", en: "Sub-accounts" },
    desc: { cn: "从 GoHighLevel 同步的门店", en: "Locations synced from GoHighLevel" },
    phase: "Phase 3",
  },
  {
    to: "/review-boost/location/demo/dashboard",
    icon: LayoutDashboard,
    title: { cn: "门店面板", en: "Location dashboard" },
    desc: { cn: "扫码与生成数据统计", en: "Scan & generation analytics" },
    phase: "Phase 9",
  },
];

export default function ReviewBoostLanding() {
  const { lang } = useLang();

  return (
    <div className="min-h-screen px-6 pt-24 pb-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <Star className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">Review Boost</h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {lang === "cn"
              ? "顾客扫码 → AI 当场写好五星评价 → 一键跳去 Google／Facebook／Shopee 发布。帮商家快速累积真实好评。"
              : "Customers scan → AI writes a 5-star review on the spot → one tap to post it on Google / Facebook / Shopee. Helps businesses stack up real reviews fast."}
          </p>
        </div>

        {/* Section grid */}
        <div className="grid sm:grid-cols-2 gap-5">
          {sections.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="glass-card rounded-3xl p-6 flex items-start gap-4 group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white"
                style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
              >
                <s.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-semibold">{s.title[lang]}</h2>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{s.phase}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.desc[lang]}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground/70 mt-8">
          {lang === "cn"
            ? "骨架搭建中 · 各功能将分阶段上线"
            : "Scaffold in progress · features ship phase by phase"}
        </p>
      </div>
    </div>
  );
}
