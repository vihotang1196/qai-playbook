import { Link } from "react-router-dom";
import { ArrowRight, PenLine, MessageCircle, Star, Wrench, type LucideIcon } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

interface ToolCard {
  key: string;
  icon: LucideIcon;
  title: { cn: string; en: string };
  desc: { cn: string; en: string };
  /** When set the card is clickable and links here; otherwise it's a Coming Soon placeholder. */
  href?: string;
}

const tools: ToolCard[] = [
  {
    key: "copywriter",
    icon: PenLine,
    title: { cn: "QAI 广告 & Funnel 文案生成器", en: "QAI Ad & Funnel Copy Generator" },
    desc: {
      cn: "填一份简短问卷，一键生成广告脚本、Caption 与 9 段 Funnel 文案。",
      en: "Fill a short survey to generate ad scripts, captions & 9-section funnel copy.",
    },
    href: "/copywriter",
  },
  {
    key: "whatsapp",
    icon: MessageCircle,
    title: { cn: "WhatsApp 文案生成器", en: "WhatsApp Copy Generator" },
    desc: {
      cn: "为 WhatsApp 私讯与群发快速生成高转化文案。",
      en: "Generate high-converting copy for WhatsApp DMs & broadcasts.",
    },
  },
  {
    key: "review-boost",
    icon: Star,
    title: { cn: "Review Boost", en: "Review Boost" },
    desc: {
      cn: "轻松收集并放大真实好评，建立客户信任。",
      en: "Collect and amplify authentic reviews to build customer trust.",
    },
  },
];

const Tools = () => {
  const { lang } = useLang();

  return (
    <main className="pt-24 pb-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="btn-gradient mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl">
            <Wrench className="h-7 w-7" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {lang === "cn" ? "小工具" : "Tools"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {lang === "cn"
              ? "为你的营销加速的一组 AI 小工具，更多功能陆续上线。"
              : "A set of AI tools to speed up your marketing — with more on the way."}
          </p>
        </div>

        {/* Tool grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const title = tool.title[lang];
            const desc = tool.desc[lang];

            // Clickable tool
            if (tool.href) {
              return (
                <Link key={tool.key} to={tool.href} className="block h-full">
                  <article className="glass-card flex h-full flex-col p-7">
                    <div className="btn-gradient mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
                      <Icon className="h-7 w-7" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                    <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      {lang === "cn" ? "进入工具" : "Open tool"}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </article>
                </Link>
              );
            }

            // Coming Soon placeholder — dimmed, no hover, not clickable.
            // Outer wrapper keeps the not-allowed cursor; the inner card disables
            // pointer events so the glass-card hover lift never fires.
            return (
              <div
                key={tool.key}
                className="h-full cursor-not-allowed"
                aria-disabled={true}
                title={lang === "cn" ? "即将推出" : "Coming soon"}
              >
                <article className="glass-card pointer-events-none flex h-full flex-col p-7 opacity-60 grayscale">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  <span className="mt-5 inline-flex w-fit items-center rounded-full bg-foreground/10 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {lang === "cn" ? "即将推出" : "Coming Soon"}
                  </span>
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
};

export default Tools;
