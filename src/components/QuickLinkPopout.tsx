import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Monitor, MessageSquare, Shield, Users, Lock, Heart, ListOrdered } from "lucide-react";

/**
 * Hover-popout cards. The three help GUIDES (WhatsApp SMS, WA vs WABA,
 * Payex/Senangpay) moved to full pages — see src/pages/guides/guides.tsx +
 * /guides/:slug. What remains here are the "WhatsApp Support" and "Virtual
 * Classroom" cards. NOTE: these two are not currently linked from anywhere
 * (kept for reference / possible reuse).
 */
interface QuickLinkPopoutProps {
  type: "whatsapp" | "virtual";
  lang: "cn" | "en";
}

const WhatsAppContent = ({ lang }: { lang: "cn" | "en" }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-2 text-accent">
      <Clock size={16} />
      <span className="text-sm font-semibold">{lang === "cn" ? "服务时间" : "Service Hours"}</span>
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
      <p>{lang === "cn" ? "星期一至星期五 10AM - 6PM" : "Mon–Fri 10AM – 6PM"}</p>
      <p>{lang === "cn" ? "星期六 10AM - 1PM" : "Sat 10AM – 1PM"}</p>
    </div>

    <div className="h-px bg-border" />

    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
      <p>{lang === "cn" ? "我们有专业的技术客服，随时为你解答你在 Technical 遇到的问题" : "Our professional support team is ready to help with any technical issues"}</p>
      <p>{lang === "cn" ? "过程中会引导你去看在我们 50+ 的培训视频里面直接解答你的问题" : "We'll guide you to our 50+ training videos to answer your questions directly"}</p>
      <p>{lang === "cn" ? "如果你的问题不在我们的技术影片里，我们也会透过给予解决方案" : "If your question isn't covered in our videos, we'll provide custom solutions"}</p>
      <p>{lang === "cn" ? '在深度的了解过程中包括 "语音、文字、截图、影片" 给你明确的指导' : "In-depth support includes voice, text, screenshots, and video guidance"}</p>
    </div>

    <Button variant="accent" size="lg" className="w-full mt-2" onClick={() => window.open("https://wa.me/601112436811", "_blank")}>
      <MessageSquare size={16} />
      {lang === "cn" ? "联系客服" : "Contact Support"}
      <ArrowRight size={16} />
    </Button>
  </div>
);

const guidelines = [
  { icon: ListOrdered, title: { cn: "Priority-Based Support", en: "Priority-Based Support" }, desc: { cn: "先到先服务，公平高效。所有请求将按照提交顺序处理，确保每位用户都能获得及时回应。", en: "First come, first served. All requests are processed in order." } },
  { icon: MessageSquare, title: { cn: "Clear & Structured Communication", en: "Clear & Structured Communication" }, desc: { cn: "请尽量完整、具体地描述你的问题，这将帮助我们更快理解并提供精准支持。", en: "Please describe your issue clearly for faster resolution." } },
  { icon: Shield, title: { cn: "Respectful Interaction", en: "Respectful Interaction" }, desc: { cn: "请以尊重与礼貌的方式交流，共同营造高效、友善的环境。", en: "Communicate with respect for a productive environment." } },
  { icon: Heart, title: { cn: "Patience Matters", en: "Patience Matters" }, desc: { cn: "在高峰时段，可能需要稍作等待。感谢你的耐心与理解。", en: "During peak hours, wait times may be longer. Thank you for your patience." } },
  { icon: Users, title: { cn: "Be Considerate of Others", en: "Be Considerate of Others" }, desc: { cn: "请避免长时间占用沟通资源，提前整理好你的问题将更高效。", en: "Prepare your questions in advance to be efficient." } },
  { icon: Lock, title: { cn: "Privacy First", en: "Privacy First" }, desc: { cn: "请勿分享任何敏感或私人信息，例如密码、身份证号码等。", en: "Do not share sensitive information such as passwords or IDs." } },
];

const VirtualClassroomContent = ({ lang }: { lang: "cn" | "en" }) => (
  <div className="flex flex-col gap-4">
    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
      <p>{lang === "cn" ? "如果在深度聊天中问题没有被解答，我们就会以 ZOOM 的方式让你分享屏幕再跟你去沟通功能设定的地方" : "If your issue isn't resolved via chat, we'll use Zoom screen-sharing to walk through settings with you"}</p>
      <p>{lang === "cn" ? "直到问题被满意的去解决为止才会离开" : "We stay until the problem is fully resolved"}</p>
    </div>

    <div className="flex items-center gap-2 text-accent">
      <Clock size={16} />
      <span className="text-sm font-semibold">{lang === "cn" ? "服务时间" : "Service Hours"}</span>
    </div>
    <p className="text-sm text-muted-foreground">{lang === "cn" ? "星期一至星期五 3:00PM - 5:00PM" : "Mon–Fri 3:00PM – 5:00PM"}</p>

    <div className="h-px bg-border" />

    <p className="text-xs font-semibold text-foreground mb-1">
      {lang === "cn" ? "为了提供高效且优质的服务体验，我们遵循以下原则" : "To provide efficient, high-quality service, we follow these principles"}
    </p>

    <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
      {guidelines.map((g, i) => {
        const Icon = g.icon;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
              <Icon size={14} className="text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                <span className="text-accent mr-1.5">0{i + 1}</span>
                {g.title[lang]}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{g.desc[lang]}</p>
            </div>
          </div>
        );
      })}
    </div>

    <Button variant="accent" size="lg" className="w-full mt-2" onClick={() => window.open("https://meet.goto.com/qaivirtual-walkin", "_blank")}>
      <Monitor size={16} />
      {lang === "cn" ? "进入虚拟教室" : "Enter Virtual Classroom"}
      <ArrowRight size={16} />
    </Button>
  </div>
);

const QuickLinkPopout = ({ type, lang }: QuickLinkPopoutProps) => {
  const titles: Record<string, { cn: string; en: string }> = {
    whatsapp: { cn: "WhatsApp 技术客服", en: "WhatsApp Support" },
    virtual: { cn: "虚拟教室", en: "Virtual Classroom" },
  };

  const contentMap: Record<string, React.ReactNode> = {
    whatsapp: <WhatsAppContent lang={lang} />,
    virtual: <VirtualClassroomContent lang={lang} />,
  };

  return (
    <div className="w-[720px] max-w-[90vw] max-h-[80vh] overflow-y-auto overscroll-contain p-6 rounded-xl bg-card border border-border shadow-xl">
      <h3 className="text-base font-bold text-foreground mb-3 sticky top-0 bg-card pb-2 -mt-2 pt-2 z-10">
        {titles[type]?.[lang] || type}
      </h3>
      {contentMap[type]}
    </div>
  );
};

export default QuickLinkPopout;
