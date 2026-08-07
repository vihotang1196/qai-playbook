import { useState } from "react";
import { useLang } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MessageCircleQuestion, Sparkles, type LucideIcon } from "lucide-react";

import thumbEmailResell from "@/assets/credits/email-resell-settings.webp";
import thumbPremiumTriggers from "@/assets/credits/premium-triggers-actions.webp";
import thumbEmailVerification from "@/assets/credits/email-verification.webp";
import thumbContentAi from "@/assets/credits/content-ai.webp";
import thumbWorkflowAi from "@/assets/credits/workflow-ai-models.webp";
import thumbConversationAi from "@/assets/credits/conversation-voice-ai.webp";
import thumbWhatsappApi from "@/assets/credits/whatsapp-business-api.webp";
import thumbReviewAi from "@/assets/credits/review-ai.webp";
import thumbFunnelAi from "@/assets/credits/funnel-ai.webp";
import thumbAgentStudio from "@/assets/credits/agent-studio.webp";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

/**
 * Each service carries TWO images on purpose:
 *
 *   thumb — a 400×225 webp bundled with the app (src/assets/credits). ~6 KB each,
 *           63 KB for all ten. These are what the grid renders.
 *   full  — the untouched 1920×1080 PNG on the CDN, 344–765 KB each. Fetched
 *           ONLY when someone opens the preview.
 *
 * The originals used to be the card images: 5.34 MB of 1920px PNGs downloaded to
 * be drawn into ~290px boxes. The CDN has no image pipeline — `?width=`, `?w=`,
 * `?tr=w-` and `?fm=webp` were all tried and every one returns the full-size PNG
 * unchanged — so the small versions are generated ahead of time and committed.
 *
 * Adding a service means adding its thumbnail to src/assets/credits too. If that
 * is ever a burden, the fallback is `icon` below, not a 1920px card image.
 */
type Service = {
  title: Bi;
  price: string;
  value: Bi;
  thumb?: string;
  full?: string;
  /** For services with no screenshot at all — see the placeholder note below. */
  icon?: LucideIcon;
};

const CDN = "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/";

const services: Service[] = [
  {
    title: bi("Email Resell Settings", "邮件转售设置"),
    thumb: thumbEmailResell,
    full: `${CDN}6967623702f1bea84560db0e.png`,
    price: "$0.0014 / email",
    value: bi("$10 ≈ 7,145 emails", "$10 ≈ 7,145 封邮件"),
  },
  {
    title: bi("Premium Triggers & Actions", "高级触发器与操作"),
    thumb: thumbPremiumTriggers,
    full: `${CDN}6967620502f1be529b60d5ba.png`,
    price: "$0.02 / execution",
    value: bi("$10 ≈ 500 executions", "$10 ≈ 500 次执行"),
  },
  {
    title: bi("Email Verification", "邮箱验证"),
    thumb: thumbEmailVerification,
    full: `${CDN}6967608eb9e85ca81d354001.png`,
    price: "$0.005 / verification",
    value: bi("$10 ≈ 2,000 verifications", "$10 ≈ 2,000 次验证"),
  },
  {
    title: bi("Content AI", "内容 AI"),
    thumb: thumbContentAi,
    full: `${CDN}69676052a3a1146528139420.png`,
    price: "$0.18 / 1K words · $0.12 / image",
    value: bi("$10 ≈ 55,555 words or 85 images", "$10 ≈ 55,555 字或 85 张图片"),
  },
  {
    title: bi("Workflow AI Models", "工作流 AI 模型"),
    thumb: thumbWorkflowAi,
    full: `${CDN}6967601e02f1be97d66088ae.png`,
    price: "$1.20 / 750K input · $4.80 / 750K output",
    value: bi("$10 ≈ 6.25M input words", "$10 ≈ 625 万输入字"),
  },
  {
    title: bi("Conversation & Voice AI", "对话与语音 AI"),
    thumb: thumbConversationAi,
    full: `${CDN}69675fe789a60e5675424775.png`,
    price: "$0.04 / msg · $0.26 / min voice",
    value: bi("$10 ≈ 250 msgs or 40 min calls", "$10 ≈ 250 条消息或 40 分钟通话"),
  },
  {
    title: bi("WhatsApp Business API", "WhatsApp 商业 API"),
    thumb: thumbWhatsappApi,
    full: `${CDN}69675fbe41565282a655a291.png`,
    price: "$0.0962 / usage",
    value: bi("$10 ≈ 105 usages", "$10 ≈ 105 次使用"),
  },
  {
    title: bi("Review AI", "评论 AI"),
    thumb: thumbReviewAi,
    full: `${CDN}69675f8da3a114d78d137901.png`,
    price: "$0.02 / response",
    value: bi("$10 ≈ 500 responses", "$10 ≈ 500 条回复"),
  },
  {
    title: bi("Funnel AI", "漏斗 AI"),
    thumb: thumbFunnelAi,
    full: `${CDN}69675f29a3a1140d91136ec4.png`,
    price: "$1.98 / funnel",
    value: bi("$10 ≈ 5 funnels", "$10 ≈ 5 个漏斗"),
  },
  {
    title: bi("Agent Studio", "Agent Studio"),
    thumb: thumbAgentStudio,
    full: `${CDN}69675e934156524c68557f16.png`,
    price: "$0.50 / 750K words",
    value: bi("$10 ≈ 1,500,000 words", "$10 ≈ 150 万字"),
  },
  // No screenshot exists for these two. They get an icon block of the same 16:9
  // size so the grid keeps its shape — a short card among tall ones reads as a
  // rendering fault. The block is deliberately NOT clickable: there is no larger
  // image behind it, and opening an empty viewer is worse than not offering one.
  {
    title: bi("Ask AI", "Ask AI"),
    icon: MessageCircleQuestion,
    price: "$4.22 / 1,000,000 Tokens",
    value: bi("$10 ≈ 1,000,000 Tokens", "$10 ≈ 1,000,000 Tokens"),
  },
  {
    title: bi("AI Studio", "AI Studio"),
    icon: Sparkles,
    price: "$4.22 / 1,000,000 Tokens",
    value: bi("$10 ≈ 1,000,000 Tokens", "$10 ≈ 1,000,000 Tokens"),
  },
];

const ServicePricingGrid = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (b: Bi) => b[lang];

  /** The service whose full-size screenshot is open, if any. */
  const [preview, setPreview] = useState<Service | null>(null);

  return (
    // 1600px rather than a Tailwind step: the primary way customers reach this
    // page is inside the GHL iframe, which is ~1900px wide, and max-w-7xl (1280)
    // left a wide empty margin down both sides. The page's other two sections
    // are narrower (hero 4xl, Transparency 5xl) and always have been — they have
    // never shared a container, so widening this one aligns with nothing.
    //
    // Still FOUR columns, not five or six. 12 divides evenly by 4 and 6 but not
    // by 5, so five columns would strand two orphans in the last row. Six across
    // the full width lands back at ~286px per card — as tight as before — and
    // collapses to ~228px once the window drops to 1536, where the longest price
    // line stops fitting. Four at 1600 gives ~370px: a clean 3×4, more room for
    // the text, and the 400px thumbnails render just under 1:1.
    <section className="max-w-[1600px] mx-auto px-6 mb-24">
      <h2 className="text-3xl font-bold text-center mb-3">
        {l(bi("What Uses Credits?", "什么会使用额度？"))}
      </h2>
      {!hideSubtitles && (
        <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
          {l(bi(
            "Each AI-powered feature has transparent, pay-per-use pricing.",
            "每项 AI 功能均采用透明的按次计费方式。"
          ))}
        </p>
      )}

      {/* One column on phones, NOT two. The longest price line is
          "$1.20 / 750K input · $4.80 / 750K output"; in a half-width phone card
          it collapses into an unreadable stack, and the price is the thing this
          section exists to communicate. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {services.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-2xl bg-card transition-transform duration-300 hover:-translate-y-1"
              style={{ border: "2px solid #141414", boxShadow: "4px 4px 0 #141414" }}
            >
              {s.thumb ? (
                <button
                  type="button"
                  onClick={() => setPreview(s)}
                  aria-label={l(bi(`Enlarge ${s.title.en} screenshot`, `放大查看${s.title.cn}截图`))}
                  className="group relative block aspect-video w-full cursor-zoom-in overflow-hidden border-b-2 border-[#141414] bg-secondary/40"
                >
                  {/* width/height match the asset so the row never reflows while
                      the image loads. */}
                  <img
                    src={s.thumb}
                    width={400}
                    height={225}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-[#141414]/85 px-2 py-1 text-[10px] font-semibold tracking-wide text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {l(bi("Click to enlarge", "点击放大"))}
                  </span>
                </button>
              ) : (
                <div
                  aria-hidden
                  className="flex aspect-video w-full items-center justify-center border-b-2 border-[#141414] bg-[#141414]"
                >
                  {Icon && <Icon size={34} strokeWidth={1.75} className="text-[#fed50a]" />}
                </div>
              )}

              {/* Text is the point of this card, not the picture above it:
                  the name, the unit price and what $10 buys all stay at full
                  readable size, and the thumbnail shrank to make room. */}
              <div className="flex flex-1 flex-col gap-2.5 p-5">
                <h3 className="text-base font-bold leading-snug tracking-tight">{l(s.title)}</h3>
                <p className="font-mono text-[13px] leading-relaxed text-muted-foreground">
                  {s.price}
                </p>
                {/* mt-auto pins this to the bottom, so the $10 lines stay on one
                    row across cards whose titles and prices wrap differently. */}
                <div className="mt-auto rounded-lg border border-[#141414] bg-secondary px-3 py-2.5">
                  <p className="text-sm font-semibold text-foreground">{l(s.value)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom highlight */}
      <div className="max-w-2xl mx-auto mt-14 rounded-2xl bg-secondary border border-border/40 p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">
          {l(bi("Simple rule", "简单规则"))}
        </p>
        <p className="text-lg font-bold mb-1">
          {l(bi("If AI does the work → Uses credits", "AI 做的 → 消耗额度"))}
        </p>
        <p className="text-lg font-bold text-foreground">
          {l(bi("If you do it manually → Free", "你手动做的 → 免费"))}
        </p>
      </div>

      {/* Full-size preview. This replaced a hand-rolled overlay that capped the
          image at max-h-[50vh] — half the screen for a 1080px-tall screenshot,
          which is why enlarging never actually made the text legible. It also
          had no ESC, no focus trap and no scroll lock; with ten images to open
          and close, that was worth the swap to Dialog. */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="w-auto max-w-[92vw] p-2">
          <DialogTitle className="sr-only">{preview ? l(preview.title) : ""}</DialogTitle>
          {preview?.full && (
            <img
              src={preview.full}
              alt={l(preview.title)}
              className="max-h-[90vh] max-w-[92vw] w-auto rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ServicePricingGrid;
