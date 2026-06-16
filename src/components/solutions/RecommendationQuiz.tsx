import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageContext";
import { ArrowRight, ArrowLeft, Sparkles, Users, MessageCircle, Calendar, ShoppingBag, Globe } from "lucide-react";

type SolutionId = "one-to-many" | "one-to-one" | "service" | "retail" | "ecommerce";

const questions = [
  {
    cn: "你的收入主要来自哪里？",
    en: "Where does your revenue mainly come from?",
    options: [
      { cn: "A. 同时服务很多人（课程 / 讲座 / 社群）", en: "A. Serving many people at once (courses / talks / communities)", value: "A" },
      { cn: "B. 每次只服务一个客户（成交 / 咨询 / 销售）", en: "B. Serving one client at a time (closing / consulting / sales)", value: "B" },
      { cn: "C. 到店或现场提供服务", en: "C. Providing on-site or in-store services", value: "C" },
      { cn: "D. 卖实体产品（门店 or 电商）", en: "D. Selling physical products (retail or e-commerce)", value: "D" },
    ],
  },
  {
    cn: "客户需要「见你」才会成交吗？",
    en: "Do clients need to meet you to close a deal?",
    options: [
      { cn: "A. 需要（面对面 / 强关系）", en: "A. Yes (face-to-face / strong relationships)", value: "A" },
      { cn: "B. 不需要（线上即可）", en: "B. No (online is fine)", value: "B" },
    ],
  },
  {
    cn: "你的产品是「人」还是「货」？",
    en: "Is your product 'you' or 'goods'?",
    options: [
      { cn: "A. 我本人 / 我的专业 / 服务", en: "A. Myself / my expertise / services", value: "A" },
      { cn: "B. 实体产品 / 商品", en: "B. Physical products / goods", value: "B" },
    ],
  },
  {
    cn: "成交是否依赖「信任建立」？",
    en: "Does closing depend on building trust?",
    options: [
      { cn: "A. 很依赖（需要聊天、解释、跟进）", en: "A. Very much (needs chat, explanation, follow-up)", value: "A" },
      { cn: "B. 不太需要（看了就买）", en: "B. Not really (see and buy)", value: "B" },
    ],
  },
  {
    cn: "你是否会同时服务很多客户？",
    en: "Do you serve many clients at the same time?",
    options: [
      { cn: "A. 是（一个时间对很多人）", en: "A. Yes (many people at once)", value: "A" },
      { cn: "B. 不是（一次一个客户）", en: "B. No (one client at a time)", value: "B" },
    ],
  },
];

const resultMap: Record<SolutionId, { icon: typeof Users; cn: string; en: string; descCn: string; descEn: string }> = {
  "one-to-many": { icon: Users, cn: "一对多成交 — 规模化成交", en: "One-to-Many — Scale Your Closing", descCn: "你的业务模式适合同时服务多人，用 AI 帮你批量管理对话与成交流程。", descEn: "Your business model fits serving many people at once. Use AI to manage conversations and closing at scale." },
  "one-to-one": { icon: MessageCircle, cn: "一对一成交 — 每一段对话都能成交", en: "One-to-One — Close Every Conversation", descCn: "你的业务核心是与客户一对一沟通，AI 可以帮你提升每次对话的成交率。", descEn: "Your business revolves around 1-on-1 conversations. AI helps you close more deals in every chat." },
  "service": { icon: Calendar, cn: "服务行业 — 自动填满你的预约表", en: "Service — Auto-Fill Your Bookings", descCn: "你的业务依赖预约与回访，AI 可以帮你自动化整个预约流程。", descEn: "Your business relies on bookings and follow-ups. AI automates your entire appointment flow." },
  "retail": { icon: ShoppingBag, cn: "实体零售 — 让每个顾客持续回来消费", en: "Retail — Keep Customers Coming Back", descCn: "你有实体门店或线下销售，AI 帮你唤醒老客户并促进复购。", descEn: "You have a physical store or offline sales. AI helps reactivate old customers and drive repeat purchases." },
  "ecommerce": { icon: Globe, cn: "电商 — 不增加人手，也能扩大规模", en: "E-commerce — Scale Without Hiring", descCn: "你的业务以线上销售为主，AI 帮你处理大量客户对话与售后。", descEn: "Your business is mainly online sales. AI handles high-volume conversations and after-sales." },
};

function computeResult(answers: string[]): SolutionId {
  // Q1 direct routing
  if (answers[0] === "A") return "one-to-many";
  if (answers[0] === "B") return "one-to-one";
  if (answers[0] === "C") return "service";

  // Q1 = D (product seller), continue with remaining answers
  const q2 = answers[1]; // meet? A=yes, B=no
  const q3 = answers[2]; // person or goods? A=person, B=goods
  const q4 = answers[3]; // trust? A=yes, B=no
  const q5 = answers[4]; // many at once? A=yes, B=no

  // Product seller scoring
  if (q2 === "A" && q4 === "A") return "retail"; // needs meeting + trust = retail
  if (q3 === "B" && q4 === "B") return "ecommerce"; // goods + no trust = ecommerce
  if (q5 === "A") return "one-to-many";
  if (q2 === "A") return "retail";
  return "ecommerce";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult?: (id: SolutionId) => void;
}

const RecommendationQuiz = ({ open, onOpenChange, onResult }: Props) => {
  const { lang } = useLang();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<SolutionId | null>(null);

  const isQ1Direct = answers[0] === "A" || answers[0] === "B" || answers[0] === "C";
  const totalSteps = isQ1Direct ? 1 : 5;

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[step] = value;
    setAnswers(newAnswers);

    // Q1 direct routing for A/B/C
    if (step === 0 && (value === "A" || value === "B" || value === "C")) {
      const res = computeResult([value]);
      setResult(res);
      onResult?.(res);
      return;
    }

    // Last question for D path
    if (step === 4) {
      const res = computeResult(newAnswers);
      setResult(res);
      onResult?.(res);
      return;
    }

    setStep(step + 1);
  };

  const handleReset = () => {
    setStep(0);
    setAnswers([]);
    setResult(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(handleReset, 300);
  };

  const currentQ = questions[step];
  const progress = result ? 100 : ((step + 1) / totalSteps) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent-foreground" />
            {lang === "cn" ? "AI 智能推荐" : "AI Recommendation"}
          </DialogTitle>
          <DialogDescription>
            {lang === "cn" ? "回答几个问题，找到最适合你的成交模式" : "Answer a few questions to find your best closing model"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-foreground rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {result ? (
          /* Result */
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto">
              {(() => { const Icon = resultMap[result].icon; return <Icon size={28} className="text-accent-foreground" />; })()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {lang === "cn" ? "推荐方案" : "Recommended Solution"}
              </p>
              <h3 className="text-xl font-bold text-foreground">
                {resultMap[result][lang]}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lang === "cn" ? resultMap[result].descCn : resultMap[result].descEn}
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleReset} className="flex-1">
                <ArrowLeft size={14} className="mr-1" />
                {lang === "cn" ? "重新测试" : "Retake"}
              </Button>
              <Button variant="accent" size="sm" onClick={handleClose} className="flex-1">
                {lang === "cn" ? "查看方案" : "View Solution"}
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          /* Question */
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Q{step + 1} / {totalSteps}
              </p>
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft size={12} />
                  {lang === "cn" ? "上一题" : "Back"}
                </button>
              )}
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {currentQ[lang]}
            </h3>
            <div className="space-y-2">
              {currentQ.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 text-sm ${
                    answers[step] === opt.value
                      ? "border-accent-foreground bg-accent/10 text-foreground"
                      : "border-border/50 bg-background/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {opt[lang]}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecommendationQuiz;
