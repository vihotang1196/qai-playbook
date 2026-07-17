import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/i18n/LanguageContext";
import { RB_PLATFORMS } from "@/lib/review-boost/platforms";
import {
  getCampaign,
  listPlatforms,
  saveCampaign,
  type RBPlatformLink,
} from "@/lib/reviewBoost";

/**
 * Create / edit a campaign
 * (`/review-boost/location/:locationId/campaigns/{new|:id/edit}`).
 *
 * A campaign carries its OWN business info (fed to the AI) + a thank-you page,
 * and points at ONE already-configured platform link (integration_id, from the
 * Platforms page). All reads/writes scoped to this location via the `rb` fn.
 */
type FormState = {
  name: string;
  business_name: string;
  industry: string;
  category: string;
  features: string; // one selling point per line → signature_features[]
  logo_url: string;
  integration_id: string; // "" = none picked
  thank_you_mode: "message" | "url";
  thank_you_message: string;
  redirect_url: string;
  is_active: boolean;
};

const EMPTY: FormState = {
  name: "",
  business_name: "",
  industry: "",
  category: "",
  features: "",
  logo_url: "",
  integration_id: "",
  thank_you_mode: "message",
  thank_you_message: "",
  redirect_url: "",
  is_active: true,
};

export default function LocationCampaignCreate() {
  const { locationId, id } = useParams();
  const isEdit = !!id;
  const { lang } = useLang();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [links, setLinks] = useState<RBPlatformLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Any saved link (all have a URL now) can receive customers.
  const usableLinks = useMemo(
    () => links.filter((l) => (l.review_url || "").trim()),
    [links],
  );

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!locationId) return;
      setLoading(true);
      try {
        const [pf, campaign] = await Promise.all([
          listPlatforms(locationId),
          isEdit ? getCampaign(locationId, id!) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setLinks(pf);
        if (isEdit) {
          if (!campaign) {
            toast.error(lang === "cn" ? "找不到这个活动" : "Campaign not found");
            navigate(`/review-boost/location/${locationId}/campaigns`);
            return;
          }
          setForm({
            name: campaign.name ?? "",
            business_name: campaign.business_name ?? "",
            industry: campaign.industry ?? "",
            category: campaign.category ?? "",
            features: (campaign.signature_features ?? []).join("\n"),
            logo_url: campaign.logo_url ?? "",
            integration_id: campaign.integration_id ?? "",
            thank_you_mode: campaign.thank_you_mode === "url" ? "url" : "message",
            thank_you_message: campaign.thank_you_message ?? "",
            redirect_url: campaign.redirect_url ?? "",
            is_active: campaign.is_active ?? true,
          });
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId, id, isEdit, lang, navigate]);

  const submit = async () => {
    if (!locationId) return;
    if (!form.name.trim()) {
      toast.error(lang === "cn" ? "请填活动名" : "Please enter a campaign name");
      return;
    }
    // The platform a customer is sent to comes from the chosen link.
    const chosen = usableLinks.find((l) => l.id === form.integration_id);

    setSaving(true);
    try {
      const saved = await saveCampaign(locationId, {
        id: isEdit ? id : undefined,
        name: form.name.trim(),
        platform: chosen?.platform ?? "google",
        integration_id: form.integration_id || null,
        business_name: form.business_name.trim() || null,
        industry: form.industry.trim() || null,
        category: form.category.trim() || null,
        signature_features: form.features
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        logo_url: form.logo_url.trim() || null,
        thank_you_mode: form.thank_you_mode,
        thank_you_message: form.thank_you_mode === "message" ? form.thank_you_message : null,
        redirect_url: form.thank_you_mode === "url" ? form.redirect_url.trim() || null : null,
        is_active: form.is_active,
      });
      toast.success(lang === "cn" ? "已保存" : "Saved");
      navigate(`/review-boost/location/${locationId}/campaigns/${saved.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const listUrl = `/review-boost/location/${locationId}/campaigns`;

  if (loading) {
    return (
      <div className="glass-card rounded-2xl px-5 py-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> {lang === "cn" ? "加载中…" : "Loading…"}
      </div>
    );
  }

  const label = (cn: string, en: string) => (lang === "cn" ? cn : en);

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <Link to={listUrl} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> {label("返回活动列表", "Back to campaigns")}
        </Link>
        <h1 className="text-2xl font-display font-bold mt-2">
          {isEdit ? label("编辑活动", "Edit campaign") : label("新建活动", "New campaign")}
        </h1>
      </div>

      {/* ── Campaign basics ─────────────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1.5">{label("活动名 *", "Campaign name *")}</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={label("例如：Glow Beauty — 母亲节好评", "e.g. Glow Beauty — Mother's Day reviews")}
            className="glass-input w-full px-4 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">{label("Logo 图片链接（选填）", "Logo image URL (optional)")}</label>
          <input
            value={form.logo_url}
            onChange={(e) => set("logo_url", e.target.value)}
            placeholder="https://…/logo.png"
            className="glass-input w-full px-4 py-2.5 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {label("现在先贴图片链接；上传功能以后做。", "Paste an image URL for now; uploads come later.")}
          </p>
        </div>
      </section>

      {/* ── Business info (fed to the AI) ───────────────────────────── */}
      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="font-display font-semibold">{label("商家资料", "Business info")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {label(
              "这次活动要夸的商家/产品——AI 写好评时会照着这些来写。",
              "The business/product this campaign praises — the AI writes reviews from this.",
            )}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">{label("商家名", "Business name")}</label>
            <input
              value={form.business_name}
              onChange={(e) => set("business_name", e.target.value)}
              placeholder={label("例如：Glow Beauty", "e.g. Glow Beauty")}
              className="glass-input w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">{label("行业", "Industry")}</label>
            <input
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
              placeholder={label("例如：美容 / 餐饮", "e.g. Beauty / F&B")}
              className="glass-input w-full px-4 py-2.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">{label("品类（选填）", "Category (optional)")}</label>
          <input
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder={label("例如：面部护理、美甲", "e.g. facials, nails")}
            className="glass-input w-full px-4 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">{label("卖点 / 招牌（一行一个）", "Selling points (one per line)")}</label>
          <textarea
            value={form.features}
            onChange={(e) => set("features", e.target.value)}
            rows={4}
            placeholder={label("专业手法\n环境舒适\n价格实惠", "Skilled staff\nCozy space\nGreat value")}
            className="glass-input w-full px-4 py-2.5 text-sm resize-y"
          />
        </div>
      </section>

      {/* ── Platform (which link the customer is sent to) ───────────── */}
      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div>
          <h2 className="font-display font-semibold">{label("评价链接", "Review link")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {label(
              "顾客写完评价后跳去哪条链接（哪家店）。选项来自「平台」页里的链接。",
              "Which link (which branch) the customer is sent to. Options come from the links on the Platforms page.",
            )}
          </p>
        </div>
        {usableLinks.length === 0 ? (
          <div className="rounded-xl bg-amber-500/10 px-4 py-3 flex items-start gap-2 text-sm">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              {label("还没有可选的链接。先去 ", "No links yet. First add one on the ")}
              <Link to={`/review-boost/location/${locationId}/platforms`} className="text-primary font-medium underline">
                {label("平台页", "Platforms page")}
              </Link>
              {label(" 添加一条评价链接。", ", then add a review link.")}
            </span>
          </div>
        ) : (
          <select
            value={form.integration_id}
            onChange={(e) => set("integration_id", e.target.value)}
            className="glass-input w-full px-4 py-2.5 text-sm"
          >
            <option value="">{label("— 暂不指定 —", "— none yet —")}</option>
            {RB_PLATFORMS.map((p) => {
              const group = usableLinks.filter((l) => l.platform === p.id);
              if (group.length === 0) return null;
              return (
                <optgroup key={p.id} label={p.label[lang]}>
                  {group.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label ? l.label : l.review_url}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
      </section>

      {/* ── Thank-you page ──────────────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="font-display font-semibold">{label("感谢页", "Thank-you page")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {label("顾客发完评价后看到什么。", "What the customer sees after posting the review.")}
          </p>
        </div>
        <div className="flex gap-2">
          {(["message", "url"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => set("thank_you_mode", mode)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors ${
                form.thank_you_mode === mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {mode === "message" ? label("显示一段感谢文案", "Show a thank-you message") : label("跳转到网址", "Redirect to a URL")}
            </button>
          ))}
        </div>
        {form.thank_you_mode === "message" ? (
          <textarea
            value={form.thank_you_message}
            onChange={(e) => set("thank_you_message", e.target.value)}
            rows={4}
            placeholder={label("谢谢你的评价！🎉\n凭此页到店可领一杯饮料 🥤", "Thank you for your review! 🎉\nShow this page in-store for a free drink 🥤")}
            className="glass-input w-full px-4 py-2.5 text-sm resize-y"
          />
        ) : (
          <input
            value={form.redirect_url}
            onChange={(e) => set("redirect_url", e.target.value)}
            placeholder="https://wa.me/60123456789"
            className="glass-input w-full px-4 py-2.5 text-sm"
          />
        )}
      </section>

      {/* ── Active toggle + save ────────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-display font-semibold text-sm">{label("启用活动", "Campaign active")}</p>
          <p className="text-xs text-muted-foreground">
            {label("停用后二维码扫码不再生成评价。", "When paused, scanning the QR won't generate reviews.")}
          </p>
        </div>
        <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {isEdit ? label("保存修改", "Save changes") : label("建立活动", "Create campaign")}
        </button>
        <Link to={listUrl} className="text-sm text-muted-foreground hover:text-foreground px-2">
          {label("取消", "Cancel")}
        </Link>
      </div>
    </div>
  );
}
