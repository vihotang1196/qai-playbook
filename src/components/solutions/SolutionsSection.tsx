import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageContext";
import { Users, MessageCircle, Calendar, ShoppingBag, Globe, ArrowRight, Play, Sparkles, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import RecommendationQuiz from "./RecommendationQuiz";

const filters = [
  { id: "all", cn: "全部", en: "All" },
  { id: "one-to-many", cn: "一对多成交", en: "One-to-Many" },
  { id: "one-to-one", cn: "一对一成交", en: "One-to-One" },
  { id: "service", cn: "服务行业", en: "Service" },
  { id: "retail", cn: "实体零售", en: "Retail" },
  { id: "ecommerce", cn: "电商", en: "E-commerce" },
];

const cards = [
  {
    id: "one-to-many",
    icon: Users,
    title: { cn: "规模化成交", en: "Scale Your Closing" },
    subtitle: { cn: "一次成交 10–100 人，同时保持个性化沟通", en: "Close 10–100 people at once while keeping it personal" },
    industries: {
      cn: ["课程 / Webinar / 工作坊", "招商 / 招代理 / 直销", "保险 / 房地产"],
      en: ["Courses / Webinar / Workshops", "Recruiting / Agencies / Direct Sales", "Insurance / Real Estate"],
    },
    features: {
      cn: ["AI 批量对话管理", "WhatsApp 群成交流程", "自动跟进潜在客户", "智能成交话术推荐"],
      en: ["AI batch conversation management", "WhatsApp group closing flow", "Auto follow-up leads", "Smart closing script suggestions"],
    },
    guidelineUrl: "https://qiai.notion.site/27528b270a6d81f3a8a8c59da5918f89?v=27528b270a6d8121bc3d000c36e7e626&source=copy_link",
    videoUrl: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba702445e39cd1c7426b5a.mp4",
    videoCta: { cn: "观看深度教学（60分钟）", en: "Watch Full Training (60 min)" },
    videoTitle: { cn: "完整系统讲解", en: "Full System Walkthrough" },
    videoSub: { cn: "教你如何在 24 小时内部署并开始成交", en: "Deploy and start closing within 24 hours" },
  },
  {
    id: "one-to-one",
    icon: MessageCircle,
    title: { cn: "每一段对话都能成交", en: "Close Every Conversation" },
    subtitle: { cn: "把每一个潜在客户变成高成交机会", en: "Turn every lead into a high-value opportunity" },
    industries: {
      cn: ["装修 / 贷款 / 买车 / 签证"],
      en: ["Renovation / Loans / Auto / Visa"],
    },
    features: {
      cn: ["AI 回复建议", "客户意图识别", "自动跟进提醒", "成交阶段管理"],
      en: ["AI reply suggestions", "Customer intent detection", "Auto follow-up reminders", "Deal stage management"],
    },
    guidelineUrl: "https://qiai.notion.site/27528b270a6d81e5bf03f4b813271cef?v=27528b270a6d81a6b403000cc01f08aa&source=copy_link",
    videoUrl: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba701d45e39c292c426b04.mp4",
    videoCta: { cn: "观看完整流程", en: "Watch Full Flow" },
    videoTitle: { cn: "完整系统讲解", en: "Full System Walkthrough" },
    videoSub: { cn: "教你如何在 24 小时内部署并开始成交", en: "Deploy and start closing within 24 hours" },
  },
  {
    id: "service",
    icon: Calendar,
    title: { cn: "自动填满你的预约表", en: "Auto-Fill Your Bookings" },
    subtitle: { cn: "把聊天转化为预约与回访", en: "Turn chats into appointments and repeat visits" },
    industries: {
      cn: ["美容 / 理发 / 理疗 / 整骨 / 汽车护理"],
      en: ["Beauty / Hair / Therapy / Chiropractic / Auto Care"],
    },
    features: {
      cn: ["自动预约回复", "客户回访提醒", "复购自动化", "WhatsApp 自动回复"],
      en: ["Auto appointment replies", "Customer follow-up reminders", "Repeat purchase automation", "WhatsApp auto-reply"],
    },
    guidelineUrl: "https://qiai.notion.site/27528b270a6d81978b2bc28879d5cada?v=27528b270a6d81b388e5000c69139032&source=copy_link",
    videoUrl: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba7024329b456ad8558284.mp4",
    videoCta: { cn: "观看设置指南", en: "Watch Setup Guide" },
    videoTitle: { cn: "完整系统讲解", en: "Full System Walkthrough" },
    videoSub: { cn: "教你如何在 24 小时内部署并开始成交", en: "Deploy and start closing within 24 hours" },
  },
  {
    id: "retail",
    icon: ShoppingBag,
    title: { cn: "让每个顾客持续回来消费", en: "Keep Customers Coming Back" },
    subtitle: { cn: "把到店与聊天转化为长期客户", en: "Turn walk-ins and chats into loyal customers" },
    industries: {
      cn: ["餐饮 / 服装 / Gadget"],
      en: ["F&B / Fashion / Gadgets"],
    },
    features: {
      cn: ["促销自动推送", "老客户唤醒", "AI 商品推荐", "营销活动发送"],
      en: ["Auto promo push", "Dormant customer reactivation", "AI product recommendations", "Campaign broadcasts"],
    },
    guidelineUrl: "https://qiai.notion.site/27528b270a6d818abf5ece7f94f16605?v=27528b270a6d81629425000ccdbef461&source=copy_link",
    videoUrl: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba702445e39c4746426b5b.mp4",
    videoCta: { cn: "观看策略讲解", en: "Watch Strategy Guide" },
    videoTitle: { cn: "完整系统讲解", en: "Full System Walkthrough" },
    videoSub: { cn: "教你如何在 24 小时内部署并开始成交", en: "Deploy and start closing within 24 hours" },
  },
  {
    id: "ecommerce",
    icon: Globe,
    title: { cn: "不增加人手，也能扩大规模", en: "Scale Without Hiring" },
    subtitle: { cn: "用 AI 处理大量客户对话", en: "Let AI handle high-volume conversations" },
    industries: {
      cn: ["电商 / DTC 品牌"],
      en: ["E-commerce / DTC Brands"],
    },
    features: {
      cn: ["AI 客服", "FAQ 自动回复", "弃单挽回（Abandoned Cart）", "AI 销售助手"],
      en: ["AI customer service", "FAQ auto-reply", "Abandoned cart recovery", "AI sales assistant"],
    },
    guidelineUrl: "https://qiai.notion.site/27528b270a6d81dca2add8176ba0c66d?v=27528b270a6d81908dbe000cfac77d67&source=copy_link",
    videoUrl: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba702068d19866cc820421.mp4",
    videoCta: { cn: "观看系统教学", en: "Watch System Tutorial" },
    videoTitle: { cn: "完整系统讲解", en: "Full System Walkthrough" },
    videoSub: { cn: "教你如何在 24 小时内部署并开始成交", en: "Deploy and start closing within 24 hours" },
  },
];

const SolutionsSection = () => {
  const { lang, hideSubtitles } = useLang();
  const [activeFilter, setActiveFilter] = useState("all");
  const [videoModal, setVideoModal] = useState<number | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("solution-animate-in");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    cardRefs.current.forEach((ref) => ref && observer.observe(ref));
    return () => observer.disconnect();
  }, [activeFilter]);

  const filtered = activeFilter === "all" ? cards : cards.filter((c) => c.id === activeFilter);

  return (
    <>
    <section id="solutions" className="vision-section py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4 fade-up">
            Solutions by Business Model
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground fade-up fade-up-delay-1">
            {lang === "cn" ? "为你的成交方式而打造" : "Built for How You Close"}
          </h1>
          {!hideSubtitles && (
            <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto fade-up fade-up-delay-2">
              {lang === "cn"
                ? "无论你是做群体成交、1对1销售，还是规模化经营，QIAI 都能匹配你的赚钱模式"
                : "Whether you close in groups, 1-on-1, or at scale — QIAI matches your revenue model"}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-14 fade-up fade-up-delay-3">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border ${
                activeFilter === f.id
                  ? "bg-foreground text-background border-foreground shadow-lg"
                  : "bg-background/60 text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground backdrop-blur-sm"
              }`}
            >
              {f[lang]}
            </button>
          ))}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                ref={(el) => { cardRefs.current[i] = el; }}
                className="group relative rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl p-7 transition-all duration-500 hover:shadow-2xl hover:shadow-accent/10 hover:-translate-y-1 hover:border-accent/20 opacity-0 translate-y-6"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {/* Glow on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative z-10">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-5 group-hover:bg-accent/10 transition-colors duration-300">
                    <Icon size={22} className="text-foreground/70 group-hover:text-accent-foreground" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">
                    {card.title[lang]}
                  </h3>
                  {!hideSubtitles && (
                    <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                      {card.subtitle[lang]}
                    </p>
                  )}

                  {/* Industries */}
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
                      {lang === "cn" ? "适用行业" : "Industries"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {card.industries[lang].map((ind) => (
                        <span
                          key={ind}
                          className="text-xs px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mb-6 space-y-2">
                    {card.features[lang].map((feat) => (
                      <div key={feat} className="flex items-start gap-2 text-sm text-foreground/80">
                        <Sparkles size={14} className="mt-0.5 text-accent-foreground/50 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="accent"
                      size="sm"
                      className="w-full group/btn"
                      onClick={() => window.open(card.guidelineUrl, "_blank")}
                    >
                      <ExternalLink size={14} className="mr-1" />
                      {lang === "cn" ? "查看 Guideline" : "View Guideline"}
                      <ArrowRight size={14} className="ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => setVideoModal(i)}
                    >
                      <Play size={14} className="mr-1" />
                      {card.videoCta[lang]}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 6th Card - AI Recommendation CTA */}
          {activeFilter === "all" && (
            <div
              ref={(el) => { cardRefs.current[filtered.length] = el; }}
              className="group relative rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl p-7 transition-all duration-500 hover:shadow-2xl hover:shadow-accent/10 hover:-translate-y-1 hover:border-accent/20 opacity-0 translate-y-6 flex flex-col items-center justify-center text-center"
              style={{ animationDelay: `${filtered.length * 0.1}s` }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                  <Sparkles size={28} className="text-accent-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground tracking-tight mb-3">
                  {lang === "cn" ? "不确定你的业务适合哪一种？" : "Not sure which fits your business?"}
                </h3>
                {!hideSubtitles && (
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    {lang === "cn" ? "让 AI 帮你推荐最适合的成交模式" : "Let AI recommend the best closing model for you"}
                  </p>
                )}
                <Button variant="accent" size="lg" className="group/cta" onClick={() => setQuizOpen(true)}>
                  <Sparkles size={16} className="mr-1" />
                  {lang === "cn" ? "获取 AI 推荐" : "Get AI Recommendation"}
                  <ArrowRight size={16} className="ml-1 transition-transform group-hover/cta:translate-x-0.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>

      {/* Video Modal */}
      <Dialog open={videoModal !== null} onOpenChange={() => setVideoModal(null)}>
        <DialogContent className="max-w-3xl !fixed !left-[50%] !top-[50%] !translate-x-[-50%] !translate-y-[-50%]">
          <DialogHeader>
            <DialogTitle>
              {videoModal !== null ? filtered[videoModal]?.videoTitle[lang] : ""}
            </DialogTitle>
            <DialogDescription>
              {videoModal !== null ? filtered[videoModal]?.videoSub[lang] : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-foreground/5 rounded-lg overflow-hidden">
            {videoModal !== null && filtered[videoModal]?.videoUrl && (
              <video
                src={filtered[videoModal].videoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Modal */}
      <RecommendationQuiz
        open={quizOpen}
        onOpenChange={setQuizOpen}
        onResult={(id) => setActiveFilter(id)}
      />
    </>
  );
};

export default SolutionsSection;
