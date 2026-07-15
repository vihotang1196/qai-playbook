import RBStub from "./RBStub";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Phase 0 page stubs for Review Boost. Each will be replaced by the real page
 * in its phase (see PROGRESS-REVIEW-BOOST.md). Bilingual via useLang().
 *
 *  Admin pages (inside <Layout>): Campaigns, Platforms, SubAccounts,
 *    CampaignDetail, Location* , Auth.
 *  Public pages (outside <Layout>): ScanPage, ThankYouPage — isPublic.
 */
type Bi = { cn: string; en: string };
const mk = (title: Bi, subtitle: Bi, phase: string, isPublic = false) =>
  function StubPage() {
    const { lang } = useLang();
    return (
      <RBStub title={title[lang]} subtitle={subtitle[lang]} phase={phase} isPublic={isPublic} />
    );
  };

/* ── Admin ───────────────────────────────────────────────────────────── */
export const Campaigns = mk(
  { cn: "活动", en: "Campaigns" },
  { cn: "建立与管理二维码好评活动。", en: "Create and manage QR review campaigns." },
  "Phase 5",
);
export const Platforms = mk(
  { cn: "平台", en: "Platforms" },
  { cn: "配置各评价平台（Google／Facebook／Shopee）与链接。", en: "Configure review platforms (Google / Facebook / Shopee) and links." },
  "Phase 4",
);
export const SubAccounts = mk(
  { cn: "子账号", en: "Sub-accounts" },
  { cn: "从 GoHighLevel 同步的门店列表。", en: "Locations synced from GoHighLevel." },
  "Phase 3",
);
export const CampaignDetail = mk(
  { cn: "活动详情", en: "Campaign detail" },
  { cn: "单个活动的评价、二维码与统计。", en: "A campaign's reviews, QR code and stats." },
  "Phase 5",
);
export const LocationCampaigns = mk(
  { cn: "门店活动", en: "Location campaigns" },
  { cn: "该门店的所有好评活动。", en: "All review campaigns for this location." },
  "Phase 5",
);
export const LocationCampaignCreate = mk(
  { cn: "建立／编辑活动", en: "Create / edit campaign" },
  { cn: "设定平台、门店资料、二维码与感谢页。", en: "Set platform, business info, QR and thank-you page." },
  "Phase 5",
);
export const LocationDashboard = mk(
  { cn: "门店面板", en: "Location dashboard" },
  { cn: "扫码次数、生成数与发布率统计。", en: "Scans, generations and posted-rate analytics." },
  "Phase 9",
);
export const LocationSettings = mk(
  { cn: "门店设置", en: "Location settings" },
  { cn: "门店品牌与偏好设定。", en: "Location branding and preferences." },
  "Phase 5",
);
// (Email/password login removed — identity comes from GHL via the URL
//  location_id; see src/lib/ghl.ts + useLocationContext.)

/* ── Public (outside Layout) ─────────────────────────────────────────── */
export const ScanPage = mk(
  { cn: "生成你的评价", en: "Crafting your review" },
  { cn: "扫码后 AI 会当场帮你写好一条五星评价。", en: "After scanning, AI writes you a 5-star review on the spot." },
  "Phase 7",
  true,
);
export const ThankYouPage = mk(
  { cn: "谢谢你的评价！", en: "Thank you for your review!" },
  { cn: "感谢页 / 优惠券 / 跳转。", en: "Thank-you page / voucher / redirect." },
  "Phase 7",
  true,
);
