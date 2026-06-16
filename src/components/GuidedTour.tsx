import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowRight } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

interface TourStep {
  targetId: string;
  title: { cn: string; en: string };
  description: { cn: string; en: string };
}

const tourSteps: TourStep[] = [
  {
    targetId: "navbar-nav",
    title: { cn: "导航菜单", en: "Navigation Menu" },
    description: { cn: "这是导航栏，你可以快速跳转到各个板块和页面，还能切换语言、字体大小和深色模式。", en: "This is the navigation bar — quickly jump to any section or page, switch language, font size, and dark mode." },
  },
  {
    targetId: "featured",
    title: { cn: "精选内容", en: "Featured Content" },
    description: { cn: "这里是我们精选的课程和最新直播回放，帮你快速找到最有价值的内容。", en: "Here you'll find curated courses and the latest live session replays." },
  },
  {
    targetId: "start-here",
    title: { cn: "成长路径", en: "Growth Path" },
    description: { cn: "四步成长路径，从基础到蜕变，帮你系统化学习与执行。", en: "A four-step journey from fundamentals to transformation." },
  },
  {
    targetId: "courses",
    title: { cn: "课程中心", en: "Course Hub" },
    description: { cn: "系统化的课程内容，包含广告设计、广告设置、成交策略和文案攻略。", en: "Structured courses covering ad design, ad setup, closing strategy, and copywriting." },
  },
  {
    targetId: "coaching",
    title: { cn: "Coaching Night", en: "Coaching Night" },
    description: { cn: "每周在线直播培训，查看时间表、观看回放，随时参与学习。", en: "Weekly live coaching sessions — view the schedule, watch replays, and join anytime." },
  },
  {
    targetId: "milestone",
    title: { cn: "里程碑", en: "Milestones" },
    description: { cn: "查看你的成长里程碑，每个阶段都有清晰的目标和行动指南。", en: "Track your growth milestones with clear goals and action guides at each stage." },
  },
  {
    targetId: "solutions",
    title: { cn: "解决方案", en: "Solutions" },
    description: { cn: "根据你的业务需求，探索适合你的一对多或一对一成交方案。", en: "Explore one-to-many or one-to-one solutions tailored to your business needs." },
  },
  {
    targetId: "nav-dfy",
    title: { cn: "DFY 页面", en: "DFY Page" },
    description: { cn: "DFY（Done-For-You）代运营服务页面，了解我们如何帮你全程搞定。", en: "The Done-For-You service page — learn how we handle everything for you." },
  },
  {
    targetId: "nav-credits",
    title: { cn: "额度页面", en: "Credits Page" },
    description: { cn: "查看各项服务的额度价格，了解如何灵活使用你的服务额度。", en: "View credit pricing for each service and learn how to use your credits flexibly." },
  },
  {
    targetId: "nav-upgrade",
    title: { cn: "升级页面", en: "Upgrade Page" },
    description: { cn: "了解如何升级你的系统和服务，解锁更多强大功能。", en: "Learn how to upgrade your system and services to unlock more powerful features." },
  },
  {
    targetId: "nav-affiliate",
    title: { cn: "伙伴页面", en: "Affiliate Page" },
    description: { cn: "加入我们的 AI 伙伴计划，利用 AI 系统赚取被动收入。", en: "Join our AI affiliate program and earn passive income with our AI system." },
  },
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
}

const GuidedTour = ({ isOpen, onClose }: GuidedTourProps) => {
  const { lang } = useLang();
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setHighlight(null);
      return;
    }

    const target = document.getElementById(tourSteps[step].targetId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });

    const measure = () => {
      const rect = target.getBoundingClientRect();
      const pad = 12;
      setHighlight({
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
    };

    const timeout = setTimeout(measure, 400);

    const onUpdate = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onUpdate, true);
    window.addEventListener("resize", onUpdate);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onUpdate, true);
      window.removeEventListener("resize", onUpdate);
    };
  }, [isOpen, step]);

  if (!isOpen) return null;

  const current = tourSteps[step];
  const isLast = step === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlight && (
              <rect
                x={highlight.left}
                y={highlight.top}
                width={highlight.width}
                height={highlight.height}
                rx="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={onClose}
        />
      </svg>

      {highlight && (
        <div
          className="absolute rounded-2xl ring-2 ring-accent/80 transition-all duration-500 ease-out pointer-events-none"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[101] w-[90vw] max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-accent" : i < step ? "w-3 bg-accent/40" : "w-3 bg-border"
                }`}
              />
            ))}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="mb-1 text-[10px] font-semibold tracking-widest uppercase text-accent-foreground">
          {step + 1}/{tourSteps.length}
        </div>
        <h3 className="text-lg font-bold tracking-tight">{current.title[lang]}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{current.description[lang]}</p>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {lang === "cn" ? "跳过" : "Skip"}
          </button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              if (isLast) {
                onClose();
              } else {
                setStep((s) => s + 1);
              }
            }}
          >
            {isLast
              ? lang === "cn" ? "明白了" : "Got it"
              : lang === "cn" ? "明白，下一项" : "Got it, next"
            }
            {!isLast && <ArrowRight size={14} />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
