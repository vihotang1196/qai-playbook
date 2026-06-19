import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Zap, Users, BookOpen, Shield, MessageCircle, BarChart3, Bot, Star, Clock, DollarSign, Sparkles } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

/* ─── Animate on scroll hook ─── */
const useInView = (threshold = 0.15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
};

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  return (
    <section className={className}>
      {children}
    </section>
  );
};

/* ─── Bilingual helper type ─── */
type T = { en: string; cn: string };
const tx = (lang: "en" | "cn", t: T) => t[lang];

/* ─── Quiz ─── */
const quizQuestions: { q: T; options: T[] }[] = [
  {
    q: { en: "How many leads do you handle daily?", cn: "你每天处理多少潜在客户？" },
    options: [
      { en: "Less than 10", cn: "少于 10 个" },
      { en: "10–50", cn: "10–50 个" },
      { en: "50+", cn: "50 个以上" },
    ],
  },
  {
    q: { en: "Do you have a team?", cn: "你有团队吗？" },
    options: [
      { en: "No", cn: "没有" },
      { en: "Small team", cn: "小团队" },
      { en: "Full team", cn: "完整团队" },
    ],
  },
  {
    q: { en: "What do you want most?", cn: "你最想要什么？" },
    options: [
      { en: "Save time", cn: "节省时间" },
      { en: "Learn system", cn: "学习系统" },
      { en: "Scale fast", cn: "快速扩展" },
    ],
  },
];

function computeRecommendation(a: number[]): "dfy" | "dwy" {
  let score = 0;
  if (a[0] === 2) score += 2;
  if (a[0] === 1) score += 1;
  if (a[1] === 0) score += 2;
  if (a[1] === 1) score += 1;
  if (a[2] === 0) score += 2;
  if (a[2] === 2) score += 1;
  return score >= 4 ? "dfy" : "dwy";
}

/* ─── Floating Cards (Hero) ─── */
const FloatingCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`absolute rounded-2xl border border-border/30 bg-background/80 backdrop-blur-xl shadow-2xl p-4 ${className}`}>
    {children}
  </div>
);

/* ─── Page ─── */
const DFY = () => {
  const { lang, hideSubtitles } = useLang();
  const [quizStep, setQuizStep] = useState(-1);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<"dfy" | "dwy" | null>(null);

  const handleQuizAnswer = (idx: number) => {
    const next = [...quizAnswers, idx];
    setQuizAnswers(next);
    if (next.length === 3) {
      setQuizResult(computeRecommendation(next));
    } else {
      setQuizStep(quizStep + 1);
    }
  };

  const resetQuiz = () => { setQuizStep(-1); setQuizAnswers([]); setQuizResult(null); };

  return (
    <>
      {/* ─── SECTION 1: HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">

        <FloatingCard className="hidden lg:block top-32 left-[8%] w-48">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle size={14} className="text-green-500" />
            <span className="text-[10px] font-medium text-muted-foreground">WhatsApp Chat</span>
          </div>
          <div className="space-y-1.5">
            <div className="bg-green-500/10 rounded-lg px-3 py-1.5 text-[11px] text-foreground">
              {lang === "cn" ? "你好！我有兴趣 👋" : "Hi! I'm interested 👋"}
            </div>
            <div className="bg-accent/20 rounded-lg px-3 py-1.5 text-[11px] text-foreground ml-4">
              {lang === "cn" ? "太好了！这是我们的特别优惠..." : "Great! Here's our special offer..."}
            </div>
          </div>
        </FloatingCard>

        <FloatingCard className="hidden lg:block top-48 right-[8%] w-44">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={14} className="text-accent-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">
              {lang === "cn" ? "AI 自动化" : "AI Automation"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-foreground">
              {lang === "cn" ? "正在自动回复 23 条对话" : "Auto-replying to 23 chats"}
            </span>
          </div>
        </FloatingCard>

        <FloatingCard className="hidden lg:block bottom-32 right-[15%] w-48">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-accent-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">
              {lang === "cn" ? "数据分析" : "Analytics"}
            </span>
          </div>
          <div className="text-lg font-bold text-foreground">+340%</div>
          <div className="text-[10px] text-muted-foreground">
            {lang === "cn" ? "本月转化率" : "Conversion rate this month"}
          </div>
        </FloatingCard>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/5 mb-8">
            <Sparkles size={14} className="text-accent-foreground" />
            <span className="text-xs font-medium text-accent-foreground">
              {lang === "cn" ? "AI 驱动销售系统" : "AI-Powered Sales System"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6" style={{ lineHeight: '1.6' }}>
            {lang === "cn" ? (
              <>
                把你的 WhatsApp 变成{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-foreground to-accent">销售机器</span>
                {" "}— 无需雇人
              </>
            ) : (
              <>
                Turn Your WhatsApp Into a{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-foreground to-accent">Sales Machine</span>
                {" "}— Without Hiring a Team
              </>
            )}
          </h1>
          {!hideSubtitles && (
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              {lang === "cn"
                ? "QAI 为你搭建或指导你打造 AI 销售系统，让你自动转化更多客户"
                : "QAI builds or guides your AI sales system so you can convert more customers automatically"}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#smart-choice">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base px-8 py-6 shadow-[0_0_30px_rgba(254,213,10,0.3)]">
                {lang === "cn" ? "开始配置" : "Get My Setup"}
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </a>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="font-semibold text-base px-8 py-6">
                {lang === "cn" ? "了解运作方式" : "See How It Works"}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: SMART CHOICE QUIZ ─── */}
      <Section className="py-24 sm:py-32">
        <div id="smart-choice" className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground font-semibold mb-4">
            {lang === "cn" ? "智能选择" : "Smart Choice"}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {lang === "cn" ? "不确定你需要什么？" : "Not Sure What You Need?"}
          </h2>
          {!hideSubtitles && (
            <p className="text-muted-foreground mb-12">
              {lang === "cn" ? "回答几个问题，找到最适合你业务的方案" : "Answer a few quick questions and get the best plan for your business"}
            </p>
          )}

          <div className="max-w-lg mx-auto">
            {quizStep === -1 && !quizResult && (
              <Button size="lg" onClick={() => setQuizStep(0)} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold px-10 py-6 shadow-[0_0_30px_rgba(254,213,10,0.2)]">
                <Sparkles size={18} className="mr-2" /> {lang === "cn" ? "开始测试" : "Start Quiz"}
              </Button>
            )}

            {quizStep >= 0 && !quizResult && (
              <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 text-left space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Q{quizStep + 1} / 3</span>
                  <div className="h-1.5 w-24 bg-foreground/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${((quizStep + 1) / 3) * 100}%` }} />
                  </div>
                </div>
                <h3 className="text-lg font-semibold">{tx(lang, quizQuestions[quizStep].q)}</h3>
                <div className="space-y-3">
                  {quizQuestions[quizStep].options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuizAnswer(i)}
                      className="w-full text-left px-5 py-4 rounded-xl border border-border/50 bg-background/60 text-sm hover:border-accent/50 hover:bg-accent/5 transition-all"
                    >
                      {tx(lang, opt)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {quizResult && (
              <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-sm p-8 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto">
                  {quizResult === "dfy" ? <Zap size={28} className="text-accent-foreground" /> : <BookOpen size={28} className="text-accent-foreground" />}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    {lang === "cn" ? "我们推荐" : "We Recommend"}
                  </p>
                  <h3 className="text-2xl font-bold">
                    {quizResult === "dfy"
                      ? (lang === "cn" ? "全包服务 (Done For You)" : "Done For You")
                      : (lang === "cn" ? "陪跑指导 (Do With You)" : "Do With You")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {quizResult === "dfy"
                    ? (lang === "cn" ? "根据你的回答，全包服务方案能最快节省你的时间并取得成果" : "Based on your answers, the DFY plan will save you time and get you results fastest.")
                    : (lang === "cn" ? "根据你的回答，陪跑指导方案让你在我们的指导下学习并搭建自己的系统" : "Based on your answers, the DWY plan lets you learn and build your own system with our guidance.")}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={resetQuiz} className="flex-1">
                    {lang === "cn" ? "重新测试" : "Retake"}
                  </Button>
                  <a href="#choose-path" className="flex-1">
                    <Button size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                      {lang === "cn" ? "继续此方案" : "Continue With This Plan"} <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ─── SECTION 3: PRICING ─── */}
      <Section className="py-24 sm:py-32">
        <div id="choose-path" className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground font-semibold mb-4">
              {lang === "cn" ? "选择你的路径" : "Choose Your Path"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {lang === "cn" ? "选择你想要的成长方式" : "Choose The Way You Want To Grow"}
            </h2>
            {!hideSubtitles && (
              <p className="text-muted-foreground max-w-xl mx-auto">
                {lang === "cn" ? "无论你想让我们帮你搞定，还是自己动手搭建 — 我们都为你准备好了" : "Whether you want it done for you, or build it yourself — we've got you covered"}
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            {/* CARD 1 — Basic DFY */}
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-7 space-y-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/5 text-[11px] font-medium">
                {lang === "cn" ? "入门" : "Starter"}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">{lang === "cn" ? "基础搭建" : "Basic Setup"}</h3>
              {!hideSubtitles && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {lang === "cn" ? "适合想要快速建立自动化的小企业" : "For small businesses who want a quick automation setup"}
                </p>
              )}
              </div>
              <div className="text-3xl font-extrabold">RM998<span className="text-base font-medium text-muted-foreground">++</span></div>
              <ul className="space-y-2.5">
                {(lang === "cn"
                  ? ["1对1 咨询", "表单 + 自动化设置", "3 次调整", "Q.AI 活跃用户"]
                  : ["1-1 Consultation", "Form + Automation Setup", "3 Adjustments", "Active Q.AI User"]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check size={14} className="text-accent-foreground mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="https://wa.me/601154050265" target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full font-semibold py-5">
                  {lang === "cn" ? "开始" : "Get Started"} <ArrowRight size={14} className="ml-1" />
                </Button>
              </a>
            </div>

            {/* CARD 2 — DWY (MAIN) */}
            <div className="relative rounded-2xl border-2 border-accent/60 bg-card/80 backdrop-blur-sm p-8 space-y-5 hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(254,213,10,0.2)] transition-all duration-300 sm:col-span-2 lg:col-span-1 scale-[1.05] origin-bottom z-10">
              <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider shadow-lg">
                🔥 {lang === "cn" ? "最受欢迎" : "Most Popular"}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-[11px] font-medium text-accent-foreground">
                <Star size={12} /> {lang === "cn" ? "最受欢迎" : "Most Popular"}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">{lang === "cn" ? "一起搭建" : "Build With Us"}</h3>
              {!hideSubtitles && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {lang === "cn" ? "在我们的指导下学习、搭建并拥有你的 AI 销售系统" : "Learn, build and own your AI sales system with our guidance"}
                </p>
              )}
              </div>
              <div className="text-3xl font-extrabold">RM1388<span className="text-base font-medium text-muted-foreground">+</span></div>
              <ul className="space-y-2.5">
                {(lang === "cn"
                  ? ["验证过的模版", "AI 操作手册", "每周指导", "WhatsApp 自动化系统", "漏斗框架", "社群支持", "直播答疑"]
                  : ["Proven templates", "AI playbooks", "Weekly guidance", "WhatsApp automation system", "Funnel framework", "Community support", "Live Q&A sessions"]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check size={14} className="text-accent-foreground mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="https://wa.me/601154050265" target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold py-5 shadow-[0_0_20px_rgba(254,213,10,0.3)]">
                  {lang === "cn" ? "开始搭建" : "Start Building"} <ArrowRight size={14} className="ml-1" />
                </Button>
              </a>
              <p className="text-[11px] text-muted-foreground text-center !mt-3">
                {lang === "cn" ? "大多数客户从这里开始，然后升级到全包服务" : "Most clients start here before upgrading to Done For You"}
              </p>
            </div>

            {/* CARD 3 — Full Funnel DFY */}
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-7 space-y-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-[11px] font-medium text-accent-foreground">
                <BarChart3 size={12} /> {lang === "cn" ? "适合扩展" : "Best For Scaling"}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">{lang === "cn" ? "完整漏斗搭建" : "Full Funnel Setup"}</h3>
              {!hideSubtitles && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {lang === "cn" ? "适合准备用完整漏斗自动化来扩展的企业" : "For businesses ready to scale with full funnel automation"}
                </p>
              )}
              </div>
              <div className="text-3xl font-extrabold">RM2998<span className="text-base font-medium text-muted-foreground">++</span></div>
              <ul className="space-y-2.5">
                {(lang === "cn"
                  ? ["1对1 咨询", "漏斗 + 自动化设置", "3 次调整", "Q.AI 活跃用户"]
                  : ["1-1 Consultation", "Funnel + Automation Setup", "3 Adjustments", "Active Q.AI User"]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check size={14} className="text-accent-foreground mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="https://wa.me/601154050265" target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-foreground text-background hover:bg-foreground/90 font-semibold py-5">
                  {lang === "cn" ? "搭建我的漏斗" : "Build My Funnel"} <ArrowRight size={14} className="ml-1" />
                </Button>
              </a>
            </div>

            {/* CARD 4 — Custom DFY */}
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-7 space-y-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/5 text-[11px] font-medium">
                <Shield size={12} /> {lang === "cn" ? "高级" : "Advanced"}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">{lang === "cn" ? "定制方案" : "Custom Solution"}</h3>
              {!hideSubtitles && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {lang === "cn" ? "适合复杂或大规模的业务需求" : "For complex or high-scale business needs"}
                </p>
              )}
              </div>
              <div className="text-3xl font-extrabold">{lang === "cn" ? "联系我们" : "Let's Talk"}</div>
              <ul className="space-y-2.5">
                {(lang === "cn"
                  ? ["完整系统搭建", "定制自动化", "专属支持"]
                  : ["Full system setup", "Custom automation", "Dedicated support"]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check size={14} className="text-accent-foreground mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="https://wa.me/601154050265" target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full font-semibold py-5">
                  {lang === "cn" ? "联系我们" : "Talk To Us"} <ArrowRight size={14} className="ml-1" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── SECTION 4: COMPARISON TABLE ─── */}
      <Section className="py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground font-semibold mb-4">
              {lang === "cn" ? "对比" : "Compare"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">
              {lang === "cn" ? "哪个更适合你？" : "Which One Fits You Best?"}
            </h2>
          </div>

          <div className="rounded-2xl border border-border/50 overflow-hidden">
            <div className="grid grid-cols-3 bg-foreground/5">
              <div className="p-4" />
              <div className="p-4 text-center font-semibold text-sm">{lang === "cn" ? "全包服务" : "Done For You"}</div>
              <div className="p-4 text-center font-semibold text-sm border-l border-border/30 bg-accent/5">{lang === "cn" ? "陪跑指导" : "Do With You"}</div>
            </div>
            {[
              { label: { en: "Speed", cn: "速度" }, dfy: { en: "Fastest", cn: "最快" }, dwy: { en: "Medium", cn: "中等" }, icon: Clock },
              { label: { en: "Effort", cn: "投入精力" }, dfy: { en: "Very Low", cn: "非常低" }, dwy: { en: "Medium", cn: "中等" }, icon: Zap },
              { label: { en: "Learning", cn: "学习程度" }, dfy: { en: "None", cn: "无需学习" }, dwy: { en: "High", cn: "深入学习" }, icon: BookOpen },
              { label: { en: "Cost", cn: "费用" }, dfy: { en: "Higher", cn: "较高" }, dwy: { en: "Lower", cn: "较低" }, icon: DollarSign },
              { label: { en: "Best for", cn: "适合人群" }, dfy: { en: "Busy founders", cn: "忙碌的创业者" }, dwy: { en: "Builders & learners", cn: "行动派 & 学习者" }, icon: Users },
            ].map((row, i) => (
              <div key={row.label.en} className={`grid grid-cols-3 ${i % 2 === 0 ? "bg-background" : "bg-foreground/[0.02]"}`}>
                <div className="p-4 flex items-center gap-2 text-sm font-medium">
                  <row.icon size={14} className="text-muted-foreground" />
                  {tx(lang, row.label)}
                </div>
                <div className="p-4 text-center text-sm text-muted-foreground">{tx(lang, row.dfy)}</div>
                <div className="p-4 text-center text-sm text-muted-foreground border-l border-border/30 bg-accent/[0.03]">{tx(lang, row.dwy)}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── SECTION 5: HOW IT WORKS ─── */}
      <Section className="py-24 sm:py-32">
        <div id="how-it-works" className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground font-semibold mb-4">
              {lang === "cn" ? "流程" : "Process"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">
              {lang === "cn" ? "简单 3 步系统" : "Simple 3-Step System"}
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: "01", title: { en: "Choose Your Path", cn: "选择你的路径" }, desc: { en: "Pick DFY or DWY based on your needs", cn: "根据需求选择全包服务或陪跑指导" }, icon: Sparkles },
              { step: "02", title: { en: "We Build or Guide", cn: "我们搭建或指导" }, desc: { en: "Get your AI sales system set up", cn: "搭建你的 AI 销售系统" }, icon: Bot },
              { step: "03", title: { en: "You Scale & Earn", cn: "你扩展 & 盈利" }, desc: { en: "Watch your revenue grow on autopilot", cn: "看着你的收入自动增长" }, icon: BarChart3 },
            ].map((s, i) => (
              <div key={s.step} className="relative text-center group">
                {i < 2 && (
                  <div className="hidden sm:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-border to-transparent" />
                )}
                <div className="w-20 h-20 rounded-2xl bg-foreground/5 border border-border/30 flex items-center justify-center mx-auto mb-6 group-hover:bg-accent/10 group-hover:border-accent/30 transition-all">
                  <s.icon size={28} className="text-foreground/70 group-hover:text-accent-foreground transition-colors" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent-foreground font-bold mb-2">
                  {lang === "cn" ? `步骤 ${s.step}` : `Step ${s.step}`}
                </p>
                <h3 className="text-lg font-bold mb-2">{tx(lang, s.title)}</h3>
                {!hideSubtitles && <p className="text-sm text-muted-foreground">{tx(lang, s.desc)}</p>}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── SECTION 6: SOCIAL PROOF ─── */}
      <Section className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground font-semibold mb-4">
              {lang === "cn" ? "真实案例" : "Proof"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">
              {lang === "cn" ? "深受企业主信赖" : "Trusted By Business Owners"}
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                name: "Sarah L.", role: { en: "E-commerce Owner", cn: "电商老板" },
                text: { en: "QAI's DFY service saved me 20+ hours a week. My WhatsApp now closes deals while I sleep.", cn: "QAI 的全包服务每周帮我节省 20+ 小时。我的 WhatsApp 现在在我睡觉时也能成交" },
                stars: 5,
              },
              {
                name: "James T.", role: { en: "Service Provider", cn: "服务商" },
                text: { en: "The DWY program taught me everything. I now run my own AI sales system with confidence.", cn: "陪跑指导教会了我一切。我现在能自信地运营自己的 AI 销售系统" },
                stars: 5,
              },
              {
                name: "Michelle K.", role: { en: "Retail Business", cn: "零售企业" },
                text: { en: "From 3 sales a day to 15. The automation is incredible and the ROI paid for itself in a week.", cn: "从每天 3 单到 15 单。自动化太强大了，一周内就回本了" },
                stars: 5,
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-4 hover:border-border hover:shadow-lg transition-all duration-300">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} className="fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{tx(lang, t.text)}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{tx(lang, t.role)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 grid sm:grid-cols-3 gap-6">
            {[
              { label: { en: "Average ROI", cn: "平均投资回报" }, value: "340%", sub: { en: "within 30 days", cn: "30 天内" } },
              { label: { en: "Leads Converted", cn: "已转化客户" }, value: "12,000+", sub: { en: "and counting", cn: "持续增长中" } },
              { label: { en: "Time Saved", cn: "节省时间" }, value: "20hrs", sub: { en: "per week average", cn: "每周平均" } },
            ].map((s) => (
              <div key={s.label.en} className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-6 text-center">
                <p className="text-3xl font-extrabold text-foreground mb-1">{s.value}</p>
                <p className="text-sm font-medium text-foreground/80">{tx(lang, s.label)}</p>
                <p className="text-xs text-muted-foreground mt-1">{tx(lang, s.sub)}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── SECTION 7: RISK REVERSAL ─── */}
      <Section className="py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-8">
            <Shield size={32} className="text-accent-foreground" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {lang === "cn" ? "零风险，全是回报" : "Zero Risk. All Upside."}
          </h2>
          {!hideSubtitles && (
            <p className="text-muted-foreground mb-12">
              {lang === "cn" ? "我们对交付成果充满信心" : "We're confident in what we deliver"}
            </p>
          )}

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { title: { en: "7-Day Guarantee", cn: "7 天保障" }, desc: { en: "Not satisfied? Full refund, no questions asked", cn: "不满意？全额退款，无需理由" } },
              { title: { en: "Free Strategy Call", cn: "免费策略通话" }, desc: { en: "Talk to our team before you commit", cn: "在你决定之前，先和我们团队聊聊" } },
              { title: { en: "No Commitment", cn: "无需承诺" }, desc: { en: "Start small, scale when you're ready", cn: "先小规模开始，准备好了再扩展" } },
            ].map((item) => (
              <div key={item.title.en} className="rounded-xl border border-border/50 p-6 space-y-2">
                <Check size={20} className="text-accent-foreground mx-auto" />
                <h3 className="font-semibold text-sm">{tx(lang, item.title)}</h3>
                <p className="text-xs text-muted-foreground">{tx(lang, item.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── SECTION 8: FINAL CTA ─── */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl mx-auto px-6">
          <div className="glass-panel p-10 md:p-14 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-6">
              {lang === "cn" ? "今天就启动你的 AI 销售系统" : "Start Your AI Sales System Today"}
            </h2>
            {!hideSubtitles && (
              <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
                {lang === "cn" ? "无论你想全包服务还是自己搭建 — 我们都能帮你" : "Whether you want it done for you or build it yourself — we've got you"}
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="https://wa.me/601154050265" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="font-bold text-base px-10 py-6">
                  {lang === "cn" ? "立即开始" : "Get Started Now"} <ArrowRight size={18} className="ml-2" />
                </Button>
              </a>
              <a href="https://wa.me/601154050265" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="font-semibold text-base px-10 py-6">
                  {lang === "cn" ? "联系我们" : "Talk To Us"}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </>
  );
};

export default DFY;
