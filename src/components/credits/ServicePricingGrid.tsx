import { useState } from "react";
import { useLang } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const services = [
  {
    title: bi("Email Resell Settings", "邮件转售设置"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/6967623702f1bea84560db0e.png",
    price: "$0.0014 / email",
    value: bi("$10 ≈ 7,145 emails", "$10 ≈ 7,145 封邮件"),
  },
  {
    title: bi("Premium Triggers & Actions", "高级触发器与操作"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/6967620502f1be529b60d5ba.png",
    price: "$0.02 / execution",
    value: bi("$10 ≈ 500 executions", "$10 ≈ 500 次执行"),
  },
  {
    title: bi("Email Verification", "邮箱验证"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/6967608eb9e85ca81d354001.png",
    price: "$0.005 / verification",
    value: bi("$10 ≈ 2,000 verifications", "$10 ≈ 2,000 次验证"),
  },
  {
    title: bi("Content AI", "内容 AI"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69676052a3a1146528139420.png",
    price: "$0.18 / 1K words · $0.12 / image",
    value: bi("$10 ≈ 55,555 words or 85 images", "$10 ≈ 55,555 字或 85 张图片"),
  },
  {
    title: bi("Workflow AI Models", "工作流 AI 模型"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/6967601e02f1be97d66088ae.png",
    price: "$1.20 / 750K input · $4.80 / 750K output",
    value: bi("$10 ≈ 6.25M input words", "$10 ≈ 625 万输入字"),
  },
  {
    title: bi("Conversation & Voice AI", "对话与语音 AI"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69675fe789a60e5675424775.png",
    price: "$0.04 / msg · $0.26 / min voice",
    value: bi("$10 ≈ 250 msgs or 40 min calls", "$10 ≈ 250 条消息或 40 分钟通话"),
  },
  {
    title: bi("WhatsApp Business API", "WhatsApp 商业 API"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69675fbe41565282a655a291.png",
    price: "$0.0962 / usage",
    value: bi("$10 ≈ 105 usages", "$10 ≈ 105 次使用"),
  },
  {
    title: bi("Review AI", "评论 AI"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69675f8da3a114d78d137901.png",
    price: "$0.02 / response",
    value: bi("$10 ≈ 500 responses", "$10 ≈ 500 条回复"),
  },
  {
    title: bi("Funnel AI", "漏斗 AI"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69675f29a3a1140d91136ec4.png",
    price: "$1.98 / funnel",
    value: bi("$10 ≈ 5 funnels", "$10 ≈ 5 个漏斗"),
  },
  {
    title: bi("Agent Studio", "Agent Studio"),
    image: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69675e934156524c68557f16.png",
    price: "$0.50 / 750K words",
    value: bi("$10 ≈ 1,500,000 words", "$10 ≈ 150 万字"),
  },
  {
    title: bi("Ask AI", "Ask AI"),
    image: "",
    price: "$4.22 / 1,000,000 Tokens",
    value: bi("$10 ≈ 1,000,000 Tokens", "$10 ≈ 1,000,000 Tokens"),
  },
  {
    title: bi("AI Studio", "AI Studio"),
    image: "",
    price: "$4.22 / 1,000,000 Tokens",
    value: bi("$10 ≈ 1,000,000 Tokens", "$10 ≈ 1,000,000 Tokens"),
  },
];

const ServicePricingGrid = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (b: Bi) => b[lang];

  const [activeImg, setActiveImg] = useState<string | null>(null);

  return (
    <section className="max-w-6xl mx-auto px-6 mb-24">
      {/* Fullscreen overlay */}
      {activeImg && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer" onClick={() => setActiveImg(null)}>
          <img
            src={activeImg}
            alt=""
            className="max-h-[50vh] max-w-[80vw] object-contain drop-shadow-2xl"
          />
        </div>
      )}

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

      <div className="grid sm:grid-cols-2 gap-6">
        {services.map((s, i) => (
          <Card
            key={i}
            className="group border border-border/60 bg-card shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            <CardContent className="p-0">
              {/* Image */}
              {s.image && (
                <div
                  className="w-full aspect-[16/9] flex items-center justify-center bg-secondary/40 cursor-zoom-in overflow-hidden"
                  onClick={() => setActiveImg(s.image)}
                >
                  <img
                    src={s.image}
                    alt={l(s.title)}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Content */}
              <div className="px-7 pb-7 pt-5">
                <h3 className="font-semibold text-lg mb-3">{l(s.title)}</h3>
                <p className="text-sm text-muted-foreground font-mono mb-4">{s.price}</p>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    {l(s.value)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom highlight */}
      <div className="max-w-2xl mx-auto mt-14 rounded-2xl bg-gradient-to-br from-secondary/80 to-secondary/40 border border-border/40 p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">
          {l(bi("Simple rule", "简单规则"))}
        </p>
        <p className="text-lg font-bold mb-1">
          {l(bi("If AI does the work → Uses credits", "AI 做的 → 消耗额度"))}
        </p>
        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
          {l(bi("If you do it manually → Free", "你手动做的 → 免费"))}
        </p>
      </div>
    </section>
  );
};

export default ServicePricingGrid;
