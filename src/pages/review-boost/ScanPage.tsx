import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Copy, Send, RefreshCw, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { RB_PLATFORMS } from "@/lib/review-boost/platforms";
import {
  scanReview,
  regenerateReview,
  markPosted,
  type RBScanResult,
  type RBReviewLanguage,
} from "@/lib/reviewBoost";

/**
 * PUBLIC customer scan page (`/scan/:code`) — the core loop. Mobile-first,
 * coral-glass, rendered OUTSIDE the site Layout (no navbar/footer).
 *
 * Flow: scan → AI writes one 5-star review (first thing shown, auto-copied
 * best-effort) → "copy & continue" opens the campaign's review link → customer
 * pastes + posts → "I posted it" sets posted=true → thank-you / redirect.
 */
const MAX_REGEN = 3;

const LANGS: { id: RBReviewLanguage; label: string }[] = [
  { id: "cn", label: "华文" },
  { id: "en", label: "English" },
  { id: "ms", label: "Malay" },
];

const TUTORIAL: Record<string, { cn: string; en: string }> = {
  google_maps: {
    cn: "到 Google 后，点评分处选 5 颗星 → 长按输入框「粘贴」→ 按发布。",
    en: "On Google: tap 5 stars → long-press the box and Paste → Post.",
  },
  facebook: {
    cn: "到 Facebook 主页评论区 → 长按「粘贴」评价 → 发布。",
    en: "On the Facebook page: long-press to Paste your review → Post.",
  },
  shopee: {
    cn: "到 Shopee 订单/店铺评价 → 选 5 星 → 长按「粘贴」→ 提交。",
    en: "On Shopee: pick 5 stars → long-press to Paste → Submit.",
  },
  custom: {
    cn: "到评价页面 → 长按「粘贴」评价 → 提交。",
    en: "On the review page: long-press to Paste → Submit.",
  },
};

export default function ScanPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { lang } = useLang();
  const label = (cn: string, en: string) => (lang === "cn" ? cn : en);

  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<RBScanResult | null>(null);
  const [reviewLang, setReviewLang] = useState<RBReviewLanguage>("cn");
  const [busy, setBusy] = useState(false); // regenerate / language switch in flight
  const [regenCount, setRegenCount] = useState(0);
  const [hasOpened, setHasOpened] = useState(false);
  const [posting, setPosting] = useState(false);
  const started = useRef(false); // guard StrictMode double-invoke / re-render

  useEffect(() => {
    if (started.current || !code) return;
    started.current = true;
    (async () => {
      try {
        const r = await scanReview(code, "cn");
        setResult(r);
        try {
          await navigator.clipboard.writeText(r.generation.review_text);
        } catch {
          /* mobile blocks clipboard without a gesture — the button copy is what counts */
        }
      } catch (e) {
        setErrorCode(e instanceof Error ? e.message : "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const platformDef = result?.platform ? RB_PLATFORMS.find((p) => p.id === result.platform!.platform) : null;
  const platformName = platformDef?.label[lang] ?? label("评价平台", "the review page");
  const reviewUrl = result?.platform?.review_url || null;

  const regenerate = async (nextLang: RBReviewLanguage) => {
    if (!code || !result || busy) return;
    if (regenCount >= MAX_REGEN) {
      toast.message(label("已经换了几条啦，挑一条最像你的吧 🙂", "That's a few tries — pick the one that fits you 🙂"));
      return;
    }
    setBusy(true);
    setReviewLang(nextLang);
    try {
      const gen = await regenerateReview(code, result.generation.id, nextLang);
      setResult({ ...result, generation: gen });
      setRegenCount((c) => c + 1);
      try {
        await navigator.clipboard.writeText(gen.review_text);
      } catch {
        /* best-effort */
      }
    } catch (e) {
      toast.error(mapError(e, label));
    } finally {
      setBusy(false);
    }
  };

  const copyAndContinue = async () => {
    if (!reviewUrl) {
      toast.error(label("商家还没设置评价链接", "The business hasn't set a review link yet"));
      return;
    }
    // Open synchronously inside the gesture so mobile doesn't block the tab.
    const tab = window.open(reviewUrl, "_blank");
    try {
      await navigator.clipboard.writeText(result!.generation.review_text);
      toast.success(label("好评已复制！到那边长按粘贴就行 📋", "Copied! Long-press to paste on the next page 📋"));
    } catch {
      toast.message(label("已打开评价页 — 长按粘贴你的评价", "Opened the review page — long-press to paste"));
    }
    setHasOpened(true);
    if (!tab) window.location.href = reviewUrl; // popup blocked → same-tab fallback
  };

  const iPosted = async () => {
    if (!result) return;
    if (!hasOpened) {
      toast.error(label("请先点上面的按钮去发布，再回来 🙂", "Open the review page first, then come back 🙂"));
      return;
    }
    setPosting(true);
    try {
      await markPosted(result.generation.id);
    } catch {
      /* non-fatal — still send them to the thank-you */
    }
    if (result.campaign.thank_you_mode === "url" && result.campaign.redirect_url) {
      window.location.href = result.campaign.redirect_url;
    } else {
      navigate(`/thank-you/${result.generation.id}`);
    }
  };

  // ── Loading / error screens ──────────────────────────────────────────
  if (loading) {
    return (
      <ScanShell>
        <div className="glass-card rounded-3xl p-10 text-center">
          <Loader2 className="w-9 h-9 text-[#141414] animate-spin mx-auto mb-4" />
          <p className="font-display font-semibold text-lg">{label("AI 正在写你的评价…", "Writing your review…")}</p>
          <p className="text-sm text-muted-foreground mt-1">{label("马上就好 ✨", "Just a moment ✨")}</p>
        </div>
      </ScanShell>
    );
  }

  if (errorCode || !result) {
    const msg =
      errorCode === "inactive"
        ? label("这个二维码已停用了。", "This QR code is no longer active.")
        : errorCode === "tool_disabled"
        ? label("此活动暂不可用。", "This campaign is currently unavailable.")
        : errorCode === "rate_limited"
        ? label("现在太多人在用了，请等一下再扫。", "Too many requests right now — please try again shortly.")
        : label("出了点问题，请再扫一次。", "Something went wrong — please scan again.");
    return (
      <ScanShell>
        <div className="glass-card rounded-3xl p-8 text-center max-w-sm">
          <p className="text-lg font-display font-semibold mb-1">{label("哎呀", "Oops")}</p>
          <p className="text-sm text-muted-foreground">{msg}</p>
        </div>
      </ScanShell>
    );
  }

  return (
    <ScanShell>
      <div className="w-full max-w-md mx-auto flex flex-col items-center">
        {/* Logo / brand */}
        {(result.campaign.logo_url) ? (
          <div className="glass-card rounded-2xl px-3 py-2 mb-3">
            <img src={result.campaign.logo_url} alt="" className="h-7 object-contain" />
          </div>
        ) : (
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#fed50a] mb-3"
            style={{ background: "#141414" }}
          >
            <Star className="w-5 h-5" />
          </div>
        )}
        {result.campaign.name && (
          <p className="text-sm text-muted-foreground mb-3">{result.campaign.name}</p>
        )}

        {/* Language switch */}
        <div className="flex gap-2 w-full mb-3">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => regenerate(l.id)}
              disabled={busy || reviewLang === l.id}
              className={`flex-1 rounded-xl px-2 py-1.5 text-xs font-medium border-2 transition-colors disabled:opacity-70 ${
                reviewLang === l.id
                  ? "border-[#141414] bg-[#fed50a] text-[#141414]"
                  : "border-[#141414]/20 bg-white text-muted-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Review card — the first thing they see */}
        <div className="glass-card rounded-3xl p-5 w-full mb-2 relative">
          <div className="text-[#fed50a] text-sm mb-2">★★★★★</div>
          {busy ? (
            <div className="py-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> {label("换一条…", "Rewriting…")}
            </div>
          ) : (
            <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
              {result.generation.review_text}
            </p>
          )}
        </div>

        {/* Regenerate */}
        <button
          onClick={() => regenerate(reviewLang)}
          disabled={busy || regenCount >= MAX_REGEN}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#141414] disabled:opacity-50 mb-4"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {label("换一条", "Try another")}
        </button>

        {/* Actions */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={copyAndContinue}
            className="btn-gradient w-full rounded-2xl py-3.5 px-4 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {hasOpened
              ? label(`已复制 — 继续去 ${platformName}`, `Copied — continue to ${platformName}`)
              : label(`复制好评并前往 ${platformName}`, `Copy review & continue to ${platformName}`)}
          </button>

          <button
            onClick={iPosted}
            disabled={!hasOpened || posting}
            className="w-full rounded-2xl py-3.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-2 border-[#141414] text-[#141414] bg-white disabled:opacity-40"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {label("我发了！", "I've posted it!")}
          </button>
        </div>

        {/* Paste tutorial */}
        {result.platform && (
          <div className="glass-card rounded-2xl p-4 w-full mt-4">
            <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-[#141414]" />
              {label("怎么发布", "How to post")}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {(TUTORIAL[result.platform.platform] || TUTORIAL.custom)[lang]}
            </p>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/60 mt-6">Powered by QiAi</p>
      </div>
    </ScanShell>
  );
}

function mapError(e: unknown, label: (cn: string, en: string) => string): string {
  const m = e instanceof Error ? e.message : "";
  if (m === "rate_limited") return label("太快啦，稍等一下再试。", "A bit too fast — try again shortly.");
  if (m === "expired") return label("这条评价过期了，请重新扫码。", "This review expired — please scan again.");
  return label("换的时候出错了，请再试一次。", "Couldn't rewrite — please try again.");
}

/** Full-screen Brutalist paper backdrop for the public customer pages. */
function ScanShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4"
      style={{
        backgroundColor: "#ffffff",
        backgroundImage: "radial-gradient(rgba(20,20,20,0.12) 1.6px, transparent 1.7px)",
        backgroundSize: "26px 26px",
      }}
    >
      {children}
    </div>
  );
}
