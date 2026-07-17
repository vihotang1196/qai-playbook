import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Loader2,
  ArrowLeft,
  Pencil,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Star,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RB_PLATFORMS } from "@/lib/review-boost/platforms";
import {
  getCampaign,
  deleteCampaign,
  listGenerations,
  previewReviews,
  campaignShortCode,
  type RBCampaign,
  type RBGeneration,
  type RBReviewSample,
  type RBReviewLanguage,
} from "@/lib/reviewBoost";

/**
 * Campaign detail (`/review-boost/location/:locationId/campaigns/:id`) — the
 * campaign's info, its scan link (short_code → /scan/:code), and its AI-review
 * history (empty until the Phase 7 scan flow writes generations). Own location
 * only, via the `rb` fn.
 */
const platformLabel = (id: string, lang: "cn" | "en") =>
  RB_PLATFORMS.find((p) => p.id === id)?.label[lang] ?? id;

export default function CampaignDetail() {
  const { locationId, id } = useParams();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<RBCampaign | null>(null);
  const [generations, setGenerations] = useState<RBGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AI review preview (admin test — nothing is saved to the DB).
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<RBReviewLanguage>("cn");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [samples, setSamples] = useState<RBReviewSample[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!locationId || !id) return;
      setLoading(true);
      try {
        const c = await getCampaign(locationId, id);
        if (cancelled) return;
        if (!c) {
          toast.error(lang === "cn" ? "找不到这个活动" : "Campaign not found");
          navigate(`/review-boost/location/${locationId}/campaigns`);
          return;
        }
        setCampaign(c);
        const gens = await listGenerations(locationId, id);
        if (!cancelled) setGenerations(gens);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load campaign");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId, id, lang, navigate]);

  const label = (cn: string, en: string) => (lang === "cn" ? cn : en);
  const listUrl = `/review-boost/location/${locationId}/campaigns`;

  if (loading) {
    return (
      <div className="glass-card rounded-2xl px-5 py-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> {label("加载中…", "Loading…")}
      </div>
    );
  }
  if (!campaign) return null;

  const code = campaignShortCode(campaign);
  const scanUrl = code ? `${window.location.origin}/scan/${code}` : null;
  const scans = campaign.rb_qr_codes?.[0]?.scan_count ?? 0;

  const copyScan = async () => {
    if (!scanUrl) return;
    try {
      await navigator.clipboard.writeText(scanUrl);
      setCopied(true);
      toast.success(label("已复制链接", "Link copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(label("复制失败，请手动复制", "Copy failed — copy it manually"));
    }
  };

  const remove = async () => {
    if (!locationId || !id) return;
    if (!window.confirm(label("确定删除这个活动？二维码和历史会一起删掉，无法恢复。", "Delete this campaign? Its QR code and history are removed permanently."))) {
      return;
    }
    setDeleting(true);
    try {
      await deleteCampaign(locationId, id);
      toast.success(label("已删除", "Deleted"));
      navigate(listUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  const runPreview = async (lang: RBReviewLanguage) => {
    if (!locationId || !id) return;
    setPreviewLang(lang);
    setPreviewLoading(true);
    try {
      const reviews = await previewReviews(locationId, id, { language: lang, count: 3 });
      setSamples(reviews);
      if (reviews.length === 0) toast.error(label("没有生成结果，请再试一次", "No reviews generated — try again"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const openPreview = () => {
    setSamples([]);
    setPreviewOpen(true);
    runPreview(previewLang);
  };

  const copySample = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      toast.success(label("已复制", "Copied"));
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    } catch {
      toast.error(label("复制失败", "Copy failed"));
    }
  };

  const LANGS: { id: RBReviewLanguage; label: string }[] = [
    { id: "cn", label: "华文" },
    { id: "en", label: "English" },
    { id: "ms", label: "Malay" },
  ];

  const features = campaign.signature_features ?? [];

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <Link to={listUrl} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> {label("返回活动列表", "Back to campaigns")}
        </Link>
      </div>

      {/* ── Header + actions ────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
          {campaign.logo_url ? (
            <img src={campaign.logo_url} alt="" className="w-full h-full object-contain" />
          ) : (
            <Star className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold truncate">{campaign.name}</h1>
            {!campaign.is_active && (
              <span className="text-[11px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0">
                {label("已停用", "Paused")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {platformLabel(campaign.platform, lang)}
            <span className="text-muted-foreground/60"> · {scans} {label("次扫码", "scans")}</span>
          </p>
          {/* D — which platform link (which branch) this campaign points at. */}
          <p className="text-xs mt-1">
            {campaign.integration ? (
              <span className="text-muted-foreground">
                {label("指向：", "→ ")}
                <span className="text-foreground font-medium">
                  {platformLabel(campaign.integration.platform, lang)}
                  {campaign.integration.label ? ` · ${campaign.integration.label}` : ` · ${campaign.integration.review_url}`}
                </span>
              </span>
            ) : (
              <span className="text-amber-600">{label("未指定评价链接", "No review link set")}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`${listUrl}/${campaign.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium border border-border/60 hover:border-border"
          >
            <Pencil className="w-4 h-4" /> {label("编辑", "Edit")}
          </Link>
          <button
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center justify-center rounded-xl w-9 h-9 border border-border/60 text-muted-foreground hover:text-red-500 hover:border-red-500/40 disabled:opacity-60"
            aria-label={label("删除", "Delete")}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Scan link ───────────────────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">{label("扫码链接", "Scan link")}</h2>
        </div>
        {scanUrl ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={scanUrl}
                className="glass-input flex-1 px-4 py-2.5 text-sm font-mono"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                onClick={copyScan}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {label("复制", "Copy")}
              </button>
              <a
                href={scanUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl w-10 h-10 border border-border/60 text-muted-foreground hover:text-primary shrink-0"
                aria-label={label("打开", "Open")}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              {label("二维码 / 可打印海报在 Phase 8 做，先用这个链接测试扫码流程。", "The QR image / printable poster comes in Phase 8 — use this link to test the scan flow for now.")}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{label("这个活动还没有扫码短码。", "This campaign has no scan code yet.")}</p>
        )}
      </section>

      {/* ── AI review preview (试生成) ───────────────────────────────── */}
      <section className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold">{label("AI 好评预览", "AI review preview")}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {label(
              "看看 AI 会为这个活动写出什么样的评价（顾客扫码看到的就是这种）。只是试看，不会保存。",
              "See what the AI writes for this campaign (this is what customers see when they scan). Preview only — nothing is saved.",
            )}
          </p>
        </div>
        <button
          onClick={openPreview}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          <Sparkles className="w-4 h-4" />
          {label("试生成", "Try it")}
        </button>
      </section>

      {/* ── Business info summary ───────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-semibold">{label("商家资料", "Business info")}</h2>
        <dl className="text-sm space-y-2">
          <Row label={label("商家名", "Business name")} value={campaign.business_name} lang={lang} />
          <Row label={label("行业", "Industry")} value={campaign.industry} lang={lang} />
          <Row label={label("品类", "Category")} value={campaign.category} lang={lang} />
        </dl>
        {features.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1.5">{label("卖点 / 招牌", "Selling points")}</p>
            <div className="flex flex-wrap gap-1.5">
              {features.map((f, i) => (
                <span key={i} className="text-xs rounded-full px-2.5 py-1 bg-primary/10 text-primary">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Generation history (placeholder until Phase 7) ──────────── */}
      <section className="glass-card rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-semibold">{label("生成历史", "Review history")}</h2>
        {generations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {label("还没有生成记录。顾客扫码生成评价后，会显示在这里。", "No reviews generated yet. Once customers scan and generate reviews, they show up here.")}
          </p>
        ) : (
          <div className="space-y-2">
            {generations.map((g) => (
              <div key={g.id} className="rounded-xl border border-border/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-500 text-xs">{"★".repeat(g.rating)}</span>
                  {g.posted && (
                    <span className="text-[11px] rounded-full px-2 py-0.5 bg-green-500/10 text-green-600">
                      {label("已发布", "Posted")}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {new Date(g.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">{g.review_text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── AI review preview dialog ─────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {label("AI 好评预览", "AI review preview")}
            </DialogTitle>
            <DialogDescription>
              {label(
                "顾客扫码时看到的就是这种评价。换语言或点「再写一批」看更多样子。",
                "This is what customers see when they scan. Switch language or regenerate for more.",
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Language switch */}
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => runPreview(l.id)}
                disabled={previewLoading}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium border transition-colors disabled:opacity-60 ${
                  previewLang === l.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-border"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {previewLoading ? (
              <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                {label("AI 正在写…", "AI is writing…")}
              </div>
            ) : samples.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {label("还没有结果", "No results yet")}
              </div>
            ) : (
              samples.map((s, i) => (
                <div key={i} className="rounded-xl border border-border/50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-amber-500 text-xs">★★★★★</span>
                    {s.persona && (
                      <span className="text-[11px] rounded-full px-2 py-0.5 bg-primary/10 text-primary truncate">
                        {s.persona}
                      </span>
                    )}
                    <button
                      onClick={() => copySample(s.review_text, i)}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary shrink-0"
                    >
                      {copiedIdx === i ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {label("复制", "Copy")}
                    </button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.review_text}</p>
                </div>
              ))
            )}
          </div>

          {/* Regenerate */}
          <button
            onClick={() => runPreview(previewLang)}
            disabled={previewLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {label("再写一批", "Regenerate")}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, lang }: { label: string; value: string | null; lang: "cn" | "en" }) {
  return (
    <div className="flex gap-3">
      <dt className="text-muted-foreground w-24 shrink-0">{label}</dt>
      <dd className="flex-1">{value || <span className="text-muted-foreground/50">{lang === "cn" ? "（未填）" : "(empty)"}</span>}</dd>
    </div>
  );
}
