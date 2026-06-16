import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Monitor, MessageSquare, Shield, Users, Lock, Heart, ListOrdered, Smartphone, Zap, CreditCard, Copy, Check } from "lucide-react";
import { useState } from "react";

interface QuickLinkPopoutProps {
  type: "whatsapp" | "virtual" | "sms-guideline" | "wa-vs-waba" | "payex-senangpay";
  lang: "cn" | "en";
}

const CopyableUrl = ({ url }: { url: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-xs font-mono">
      <span className="truncate flex-1">{url}</span>
      <button onClick={handleCopy} className="flex-shrink-0 text-accent hover:text-accent/80 transition-colors">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
};

const WhatsAppContent = ({ lang }: { lang: "cn" | "en" }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-2 text-accent">
      <Clock size={16} />
      <span className="text-sm font-semibold">
        {lang === "cn" ? "服务时间" : "Service Hours"}
      </span>
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
      <p>{lang === "cn" ? "星期一至星期五 10AM - 6PM" : "Mon–Fri 10AM – 6PM"}</p>
      <p>{lang === "cn" ? "星期六 10AM - 1PM" : "Sat 10AM – 1PM"}</p>
    </div>

    <div className="h-px bg-border" />

    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
      <p>{lang === "cn"
        ? "我们有专业的技术客服，随时为你解答你在 Technical 遇到的问题"
        : "Our professional support team is ready to help with any technical issues"}</p>
      <p>{lang === "cn"
        ? "过程中会引导你去看在我们 50+ 的培训视频里面直接解答你的问题"
        : "We'll guide you to our 50+ training videos to answer your questions directly"}</p>
      <p>{lang === "cn"
        ? "如果你的问题不在我们的技术影片里，我们也会透过给予解决方案"
        : "If your question isn't covered in our videos, we'll provide custom solutions"}</p>
      <p>{lang === "cn"
        ? '在深度的了解过程中包括 "语音、文字、截图、影片" 给你明确的指导'
        : "In-depth support includes voice, text, screenshots, and video guidance"}</p>
    </div>

    <Button
      variant="accent"
      size="lg"
      className="w-full mt-2"
      onClick={() => window.open("https://wa.me/601112436811", "_blank")}
    >
      <MessageSquare size={16} />
      {lang === "cn" ? "联系客服" : "Contact Support"}
      <ArrowRight size={16} />
    </Button>
  </div>
);

const guidelines = [
  {
    icon: ListOrdered,
    title: { cn: "Priority-Based Support", en: "Priority-Based Support" },
    desc: { cn: "先到先服务，公平高效。所有请求将按照提交顺序处理，确保每位用户都能获得及时回应。", en: "First come, first served. All requests are processed in order." },
  },
  {
    icon: MessageSquare,
    title: { cn: "Clear & Structured Communication", en: "Clear & Structured Communication" },
    desc: { cn: "请尽量完整、具体地描述你的问题，这将帮助我们更快理解并提供精准支持。", en: "Please describe your issue clearly for faster resolution." },
  },
  {
    icon: Shield,
    title: { cn: "Respectful Interaction", en: "Respectful Interaction" },
    desc: { cn: "请以尊重与礼貌的方式交流，共同营造高效、友善的环境。", en: "Communicate with respect for a productive environment." },
  },
  {
    icon: Heart,
    title: { cn: "Patience Matters", en: "Patience Matters" },
    desc: { cn: "在高峰时段，可能需要稍作等待。感谢你的耐心与理解。", en: "During peak hours, wait times may be longer. Thank you for your patience." },
  },
  {
    icon: Users,
    title: { cn: "Be Considerate of Others", en: "Be Considerate of Others" },
    desc: { cn: "请避免长时间占用沟通资源，提前整理好你的问题将更高效。", en: "Prepare your questions in advance to be efficient." },
  },
  {
    icon: Lock,
    title: { cn: "Privacy First", en: "Privacy First" },
    desc: { cn: "请勿分享任何敏感或私人信息，例如密码、身份证号码等。", en: "Do not share sensitive information such as passwords or IDs." },
  },
];

const VirtualClassroomContent = ({ lang }: { lang: "cn" | "en" }) => (
  <div className="flex flex-col gap-4">
    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
      <p>{lang === "cn"
        ? "如果在深度聊天中问题没有被解答，我们就会以 ZOOM 的方式让你分享屏幕再跟你去沟通功能设定的地方"
        : "If your issue isn't resolved via chat, we'll use Zoom screen-sharing to walk through settings with you"}</p>
      <p>{lang === "cn"
        ? "直到问题被满意的去解决为止才会离开"
        : "We stay until the problem is fully resolved"}</p>
    </div>

    <div className="flex items-center gap-2 text-accent">
      <Clock size={16} />
      <span className="text-sm font-semibold">
        {lang === "cn" ? "服务时间" : "Service Hours"}
      </span>
    </div>
    <p className="text-sm text-muted-foreground">
      {lang === "cn" ? "星期一至星期五 3:00PM - 5:00PM" : "Mon–Fri 3:00PM – 5:00PM"}
    </p>

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

    <Button
      variant="accent"
      size="lg"
      className="w-full mt-2"
      onClick={() => window.open("https://meet.goto.com/qaivirtual-walkin", "_blank")}
    >
      <Monitor size={16} />
      {lang === "cn" ? "进入虚拟教室" : "Enter Virtual Classroom"}
      <ArrowRight size={16} />
    </Button>
  </div>
);

const smsSteps = [
  {
    step: "Step 1",
    title: { cn: "Reload QR", en: "Reload QR" },
    desc: { cn: "点击 Reload QR 按钮刷新二维码", en: "Click the Reload QR button to refresh the QR code" },
  },
  {
    step: "Step 2",
    title: { cn: "Press OK", en: "Press OK" },
    desc: { cn: "在弹出的提示中点击 OK", en: "Click OK on the prompt" },
  },
  {
    step: "Step 3",
    title: { cn: "Wait for QR Change", en: "Wait for QR Change" },
    desc: { cn: "等待二维码更新后用手机扫描", en: "Wait for QR to update, then scan with your phone" },
  },
  {
    step: "Step 4",
    title: { cn: "Wait Syncing Finish", en: "Wait Syncing Finish" },
    desc: { cn: "等待同步完成即可使用", en: "Wait for syncing to complete" },
  },
];

const smsUsageSections = [
  {
    icon: Zap,
    title: { cn: "Automation Action", en: "Automation Action" },
    desc: { cn: "在 Automation 中使用 Send SMS 发送 WhatsApp 消息（Drip Mode: 1人/分钟）", en: "Use Send SMS in Automation to send WhatsApp messages (Drip Mode: 1ppl/min)" },
  },
  {
    icon: Users,
    title: { cn: "Bulk SMS 群发", en: "Bulk SMS Broadcast" },
    desc: { cn: "通过 Bulk SMS 功能群发 WhatsApp 消息（Drip Mode: 1人/分钟）", en: "Send broadcast WhatsApp messages via Bulk SMS (Drip Mode: 1ppl/min)" },
  },
  {
    icon: MessageSquare,
    title: { cn: "Internal Notification", en: "Internal Notification" },
    desc: { cn: "设置内部通知，通过 WhatsApp 发送系统提醒给团队成员", en: "Set up internal notifications to send system alerts to team members via WhatsApp" },
  },
];

const SMSGuidelineContent = ({ lang }: { lang: "cn" | "en" }) => (
  <div className="flex flex-col gap-4">
    <p className="text-sm font-semibold text-accent">
      {lang === "cn" ? "WhatsApp/WhatsApp Business 连接指南" : "WhatsApp/WhatsApp Business Setup Guide"}
    </p>

    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
      {/* QR Connection Steps */}
      <p className="text-xs font-semibold text-foreground">
        {lang === "cn" ? "🔗 连接 WhatsApp" : "🔗 Connect WhatsApp"}
      </p>
      {smsSteps.map((s, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
            <span className="text-[10px] font-bold text-accent">{i + 1}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{s.title[lang]}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{s.desc[lang]}</p>
          </div>
        </div>
      ))}

      <div className="h-px bg-border my-2" />

      {/* How to use */}
      <p className="text-xs font-semibold text-foreground">
        {lang === "cn" ? "📲 如何使用" : "📲 How to Use"}
      </p>
      <p className="text-xs text-muted-foreground">
        {lang === "cn" ? "SMS = WhatsApp/WhatsApp Business 平台" : "SMS = WhatsApp/WhatsApp Business Platform"}
      </p>
      {smsUsageSections.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
              <Icon size={14} className="text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{s.title[lang]}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{s.desc[lang]}</p>
            </div>
          </div>
        );
      })}

      <div className="h-px bg-border my-2" />

      {/* Tips */}
      <div className="bg-accent/5 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">
          {lang === "cn" ? "💡 重要提示" : "💡 Important Tips"}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "一个账号默认只有一个 WhatsApp 集成，一个管理员可以访问此页面。如需更多管理员，请联系技术团队。"
            : "One account has one default WhatsApp integration. Contact the tech team for more admin access."}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "如果每天发送量超过 200 条，建议升级至 WhatsApp Business API (WABA)。"
            : "If sending 200+ messages daily, consider upgrading to WhatsApp Business API (WABA)."}
        </p>
      </div>

      <div className="h-px bg-border my-2" />

      {/* Account banned */}
      <div className="bg-destructive/5 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">
          {lang === "cn" ? "⚠️ WhatsApp 账号被封怎么办？" : "⚠️ WhatsApp Account Banned?"}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "如果显示 \"This account is not allowed to use WhatsApp\"，可以尝试申诉："
            : "If you see \"This account is not allowed to use WhatsApp\", you can appeal:"}
        </p>
        <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
          <li>{lang === "cn" ? "打开 WhatsApp → 点击 Contact Us" : "Open WhatsApp → Click Contact Us"}</li>
          <li>{lang === "cn" ? "说明号码、认为被误封、会遵守规则" : "Explain your number, possible misban, commitment to rules"}</li>
          <li>{lang === "cn" ? "等待几天，WhatsApp 会通过 email 回复" : "Wait a few days for WhatsApp's email response"}</li>
        </ol>
      </div>
    </div>

  </div>
);

const wabaComparisonRows = [
  { label: { cn: "使用方式", en: "Usage" }, wa: { cn: "手机 App 手动操作", en: "Manual via phone app" }, waba: { cn: "系统后台自动化发送与管理", en: "Automated via backend system" } },
  { label: { cn: "适合对象", en: "For" }, wa: { cn: "小商家、个人客服", en: "Small businesses, personal" }, waba: { cn: "企业团队、规模化沟通", en: "Enterprise teams, scaled comms" } },
  { label: { cn: "回复方式", en: "Reply" }, wa: { cn: "人工回复", en: "Manual only" }, waba: { cn: "人工 + AI 自动回复", en: "Manual + AI auto-reply" } },
  { label: { cn: "多人共用", en: "Multi-user" }, wa: { cn: "❌ 不支持", en: "❌ No" }, waba: { cn: "✅ 多客服同时在线", en: "✅ Multi-agent online" } },
  { label: { cn: "自动化", en: "Automation" }, wa: { cn: "❌ 几乎没有", en: "❌ Almost none" }, waba: { cn: "✅ 提醒、跟进、营销", en: "✅ Reminders, follow-up, marketing" } },
  { label: { cn: "群发功能", en: "Broadcast" }, wa: { cn: "❌ 不支持", en: "❌ Not supported" }, waba: { cn: "✅ Template 合法群发", en: "✅ Template-based broadcast" } },
  { label: { cn: "费用", en: "Cost" }, wa: { cn: "免费", en: "Free" }, waba: { cn: "按 Meta 官方对话收费", en: "Per Meta conversation pricing" } },
];

const WAvsWABAContent = ({ lang }: { lang: "cn" | "en" }) => (
  <div className="flex flex-col gap-4">
    <p className="text-sm text-muted-foreground leading-relaxed">
      {lang === "cn"
        ? "很多顾客以为 WhatsApp 和 WhatsApp Business API 是一样的，其实差别非常大。"
        : "Many think WhatsApp and WhatsApp Business API are the same, but they're very different."}
    </p>

    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
      {/* Key benefits */}
      <div className="bg-accent/5 rounded-lg p-3 space-y-1.5">
        <p className="text-xs font-semibold text-foreground">
          {lang === "cn" ? "升级 WABA 后，您会获得：" : "After upgrading to WABA, you get:"}
        </p>
        {[
          { cn: "多个客服同时在线处理客户", en: "Multiple agents handling customers simultaneously" },
          { cn: "自动化系统发送提醒、跟进、通知", en: "Automated reminders, follow-ups, notifications" },
          { cn: "客户聊天记录自动保存进 CRM", en: "Chat records auto-saved to CRM" },
          { cn: "官方合规通道，更稳定、不容易封号", en: "Official compliant channel, more stable" },
          { cn: "可搭配 AI 自动回复与营销流程", en: "AI auto-reply and marketing workflows" },
        ].map((item, i) => (
          <p key={i} className="text-xs text-muted-foreground leading-relaxed">✅ {item[lang]}</p>
        ))}
      </div>

      {/* Comparison table */}
      <p className="text-xs font-semibold text-foreground mt-2">
        {lang === "cn" ? "📊 对比表" : "📊 Comparison"}
      </p>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-3 bg-muted/50 text-[10px] font-semibold text-foreground">
          <div className="px-2 py-1.5 border-r border-border">{lang === "cn" ? "项目" : "Feature"}</div>
          <div className="px-2 py-1.5 border-r border-border">WA/WA BS</div>
          <div className="px-2 py-1.5 text-accent">WABA</div>
        </div>
        {wabaComparisonRows.map((row, i) => (
          <div key={i} className="grid grid-cols-3 text-[10px] text-muted-foreground border-t border-border">
            <div className="px-2 py-1.5 border-r border-border font-medium text-foreground">{row.label[lang]}</div>
            <div className="px-2 py-1.5 border-r border-border">{row.wa[lang]}</div>
            <div className="px-2 py-1.5">{row.waba[lang]}</div>
          </div>
        ))}
      </div>

      {/* Pricing info */}
      <div className="bg-accent/5 rounded-lg p-3 space-y-1.5 mt-2">
        <p className="text-xs font-semibold text-foreground">
          {lang === "cn" ? "💰 WABA 收费说明" : "💰 WABA Pricing"}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "WABA 费用由 Meta 官方收取，非额外收费。系统通过官方 API 发送信息。"
            : "WABA fees are charged by Meta, not extra. System sends via official API."}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "客户发消息给您：❌ 不收费 | 24小时内回复：通常不额外收费 | 超24小时发 Template：✅ 会收费"
            : "Customer messages you: ❌ Free | Reply within 24h: Usually free | Template after 24h: ✅ Charged"}
        </p>
      </div>
    </div>

  </div>
);

const PayexSenangpayContent = ({ lang }: { lang: "cn" | "en" }) => (
  <div className="flex flex-col gap-4">
    <p className="text-sm text-muted-foreground leading-relaxed">
      {lang === "cn"
        ? "将 Payex 或 Senangpay 集成到系统中，需要在对应的支付平台设置以下 URL。"
        : "To integrate Payex or Senangpay, set the following URLs in the respective payment portal."}
    </p>

    {/* Payex */}
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CreditCard size={14} className="text-accent" />
        <p className="text-xs font-semibold text-foreground">PAYEX</p>
      </div>
      <div className="rounded-lg overflow-hidden border border-border mb-2">
        <video
          src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/6953673773a5e0b193b2a4cc.mp4"
          controls
          className="w-full aspect-video"
          preload="metadata"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Return URL</p>
        <CopyableUrl url="https://payexqiai.com/success.php" />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-2">Callback URL</p>
        <CopyableUrl url="https://payexqiai.com/callback.php" />
      </div>
    </div>

    <div className="h-px bg-border" />

    {/* Senangpay */}
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CreditCard size={14} className="text-accent" />
        <p className="text-xs font-semibold text-foreground">SENANGPAY</p>
      </div>
      <div className="rounded-lg overflow-hidden border border-border mb-2">
        <video
          src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/6953685ca61a7e20c1c93c5c.mp4"
          controls
          className="w-full aspect-video"
          preload="metadata"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Return URL</p>
         <CopyableUrl url="https://senangpayqiai.com/success.php" />
         <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-2">Callback URL</p>
         <CopyableUrl url="https://senangpayqiai.com/callback.php" />
      </div>
    </div>

  </div>
);

const QuickLinkPopout = ({ type, lang }: QuickLinkPopoutProps) => {
  const titles: Record<string, { cn: string; en: string }> = {
    whatsapp: { cn: "WhatsApp 技术客服", en: "WhatsApp Support" },
    virtual: { cn: "虚拟教室", en: "Virtual Classroom" },
    "sms-guideline": { cn: "WhatsApp SMS Guideline", en: "WhatsApp SMS Guideline" },
    "wa-vs-waba": { cn: "WhatsApp vs WABA", en: "WhatsApp vs WABA" },
    "payex-senangpay": { cn: "Payex/Senangpay 集成指南", en: "Payex/Senangpay Integration" },
  };

  const contentMap: Record<string, React.ReactNode> = {
    whatsapp: <WhatsAppContent lang={lang} />,
    virtual: <VirtualClassroomContent lang={lang} />,
    "sms-guideline": <SMSGuidelineContent lang={lang} />,
    "wa-vs-waba": <WAvsWABAContent lang={lang} />,
    "payex-senangpay": <PayexSenangpayContent lang={lang} />,
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
