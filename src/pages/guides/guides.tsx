import { useState } from "react";
import { CreditCard, MessageSquare, Users, Zap, Copy, Check } from "lucide-react";

/**
 * Guide content — full-page versions of the three help guides that used to live
 * in the cramped navbar hover-popout (QuickLinkPopout). Same bilingual content
 * (steps, comparison table, embedded videos, copyable URLs) but WITHOUT the
 * inner max-h scroll boxes, so each flows naturally on its own /guides/:slug
 * page. This module is the single source of truth for the guides.
 */

type Lang = "cn" | "en";

const CopyableUrl = ({ url }: { url: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        /* clipboard blocked — the url is still visible for manual copy */
      },
    );
  };
  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm font-mono">
      <span className="truncate flex-1">{url}</span>
      <button onClick={handleCopy} className="flex-shrink-0 text-accent hover:text-accent/80 transition-colors" aria-label="copy">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
};

const smsSteps = [
  { title: { cn: "Reload QR", en: "Reload QR" }, desc: { cn: "点击 Reload QR 按钮刷新二维码", en: "Click the Reload QR button to refresh the QR code" } },
  { title: { cn: "Press OK", en: "Press OK" }, desc: { cn: "在弹出的提示中点击 OK", en: "Click OK on the prompt" } },
  { title: { cn: "Wait for QR Change", en: "Wait for QR Change" }, desc: { cn: "等待二维码更新后用手机扫描", en: "Wait for QR to update, then scan with your phone" } },
  { title: { cn: "Wait Syncing Finish", en: "Wait Syncing Finish" }, desc: { cn: "等待同步完成即可使用", en: "Wait for syncing to complete" } },
];

const smsUsageSections = [
  { icon: Zap, title: { cn: "Automation Action", en: "Automation Action" }, desc: { cn: "在 Automation 中使用 Send SMS 发送 WhatsApp 消息（Drip Mode: 1人/分钟）", en: "Use Send SMS in Automation to send WhatsApp messages (Drip Mode: 1ppl/min)" } },
  { icon: Users, title: { cn: "Bulk SMS 群发", en: "Bulk SMS Broadcast" }, desc: { cn: "通过 Bulk SMS 功能群发 WhatsApp 消息（Drip Mode: 1人/分钟）", en: "Send broadcast WhatsApp messages via Bulk SMS (Drip Mode: 1ppl/min)" } },
  { icon: MessageSquare, title: { cn: "Internal Notification", en: "Internal Notification" }, desc: { cn: "设置内部通知，通过 WhatsApp 发送系统提醒给团队成员", en: "Set up internal notifications to send system alerts to team members via WhatsApp" } },
];

function SMSGuidelineContent({ lang }: { lang: Lang }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-base font-semibold text-accent">
        {lang === "cn" ? "WhatsApp/WhatsApp Business 连接指南" : "WhatsApp/WhatsApp Business Setup Guide"}
      </p>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">{lang === "cn" ? "🔗 连接 WhatsApp" : "🔗 Connect WhatsApp"}</p>
        <div className="space-y-3">
          {smsSteps.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
                <span className="text-[11px] font-bold text-accent">{i + 1}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{s.title[lang]}</p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{s.desc[lang]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <p className="text-sm font-semibold text-foreground mb-1">{lang === "cn" ? "📲 如何使用" : "📲 How to Use"}</p>
        <p className="text-sm text-muted-foreground mb-3">{lang === "cn" ? "SMS = WhatsApp/WhatsApp Business 平台" : "SMS = WhatsApp/WhatsApp Business Platform"}</p>
        <div className="space-y-3">
          {smsUsageSections.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
                  <Icon size={15} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.title[lang]}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{s.desc[lang]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-accent/5 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">{lang === "cn" ? "💡 重要提示" : "💡 Important Tips"}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "一个账号默认只有一个 WhatsApp 集成，一个管理员可以访问此页面。如需更多管理员，请联系技术团队。"
            : "One account has one default WhatsApp integration. Contact the tech team for more admin access."}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "如果每天发送量超过 200 条，建议升级至 WhatsApp Business API (WABA)。"
            : "If sending 200+ messages daily, consider upgrading to WhatsApp Business API (WABA)."}
        </p>
      </div>

      <div className="bg-destructive/5 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">{lang === "cn" ? "⚠️ WhatsApp 账号被封怎么办？" : "⚠️ WhatsApp Account Banned?"}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? '如果显示 "This account is not allowed to use WhatsApp"，可以尝试申诉：'
            : 'If you see "This account is not allowed to use WhatsApp", you can appeal:'}
        </p>
        <ol className="text-sm text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
          <li>{lang === "cn" ? "打开 WhatsApp → 点击 Contact Us" : "Open WhatsApp → Click Contact Us"}</li>
          <li>{lang === "cn" ? "说明号码、认为被误封、会遵守规则" : "Explain your number, possible misban, commitment to rules"}</li>
          <li>{lang === "cn" ? "等待几天，WhatsApp 会通过 email 回复" : "Wait a few days for WhatsApp's email response"}</li>
        </ol>
      </div>
    </div>
  );
}

const wabaComparisonRows = [
  { label: { cn: "使用方式", en: "Usage" }, wa: { cn: "手机 App 手动操作", en: "Manual via phone app" }, waba: { cn: "系统后台自动化发送与管理", en: "Automated via backend system" } },
  { label: { cn: "适合对象", en: "For" }, wa: { cn: "小商家、个人客服", en: "Small businesses, personal" }, waba: { cn: "企业团队、规模化沟通", en: "Enterprise teams, scaled comms" } },
  { label: { cn: "回复方式", en: "Reply" }, wa: { cn: "人工回复", en: "Manual only" }, waba: { cn: "人工 + AI 自动回复", en: "Manual + AI auto-reply" } },
  { label: { cn: "多人共用", en: "Multi-user" }, wa: { cn: "❌ 不支持", en: "❌ No" }, waba: { cn: "✅ 多客服同时在线", en: "✅ Multi-agent online" } },
  { label: { cn: "自动化", en: "Automation" }, wa: { cn: "❌ 几乎没有", en: "❌ Almost none" }, waba: { cn: "✅ 提醒、跟进、营销", en: "✅ Reminders, follow-up, marketing" } },
  { label: { cn: "群发功能", en: "Broadcast" }, wa: { cn: "❌ 不支持", en: "❌ Not supported" }, waba: { cn: "✅ Template 合法群发", en: "✅ Template-based broadcast" } },
  { label: { cn: "费用", en: "Cost" }, wa: { cn: "免费", en: "Free" }, waba: { cn: "按 Meta 官方对话收费", en: "Per Meta conversation pricing" } },
];

function WAvsWABAContent({ lang }: { lang: Lang }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {lang === "cn"
          ? "很多顾客以为 WhatsApp 和 WhatsApp Business API 是一样的，其实差别非常大。"
          : "Many think WhatsApp and WhatsApp Business API are the same, but they're very different."}
      </p>

      <div className="bg-accent/5 rounded-xl p-4 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{lang === "cn" ? "升级 WABA 后，您会获得：" : "After upgrading to WABA, you get:"}</p>
        {[
          { cn: "多个客服同时在线处理客户", en: "Multiple agents handling customers simultaneously" },
          { cn: "自动化系统发送提醒、跟进、通知", en: "Automated reminders, follow-ups, notifications" },
          { cn: "客户聊天记录自动保存进 CRM", en: "Chat records auto-saved to CRM" },
          { cn: "官方合规通道，更稳定、不容易封号", en: "Official compliant channel, more stable" },
          { cn: "可搭配 AI 自动回复与营销流程", en: "AI auto-reply and marketing workflows" },
        ].map((item, i) => (
          <p key={i} className="text-sm text-muted-foreground leading-relaxed">✅ {item[lang]}</p>
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">{lang === "cn" ? "📊 对比表" : "📊 Comparison"}</p>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/50 text-xs font-semibold text-foreground">
            <div className="px-3 py-2 border-r border-border">{lang === "cn" ? "项目" : "Feature"}</div>
            <div className="px-3 py-2 border-r border-border">WA/WA BS</div>
            <div className="px-3 py-2 text-accent">WABA</div>
          </div>
          {wabaComparisonRows.map((row, i) => (
            <div key={i} className="grid grid-cols-3 text-xs text-muted-foreground border-t border-border">
              <div className="px-3 py-2 border-r border-border font-medium text-foreground">{row.label[lang]}</div>
              <div className="px-3 py-2 border-r border-border">{row.wa[lang]}</div>
              <div className="px-3 py-2">{row.waba[lang]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-accent/5 rounded-xl p-4 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{lang === "cn" ? "💰 WABA 收费说明" : "💰 WABA Pricing"}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "WABA 费用由 Meta 官方收取，非额外收费。系统通过官方 API 发送信息。"
            : "WABA fees are charged by Meta, not extra. System sends via official API."}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "客户发消息给您：❌ 不收费 | 24小时内回复：通常不额外收费 | 超24小时发 Template：✅ 会收费"
            : "Customer messages you: ❌ Free | Reply within 24h: Usually free | Template after 24h: ✅ Charged"}
        </p>
      </div>
    </div>
  );
}

function PayexSenangpayContent({ lang }: { lang: Lang }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {lang === "cn"
          ? "将 Payex 或 Senangpay 集成到系统中，需要在对应的支付平台设置以下 URL。"
          : "To integrate Payex or Senangpay, set the following URLs in the respective payment portal."}
      </p>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-accent" />
          <p className="text-sm font-semibold text-foreground">PAYEX</p>
        </div>
        <div className="rounded-xl overflow-hidden border border-border">
          <video src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/6953673773a5e0b193b2a4cc.mp4" controls className="w-full aspect-video" preload="metadata" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Return URL</p>
          <CopyableUrl url="https://payexqiai.com/success.php" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2">Callback URL</p>
          <CopyableUrl url="https://payexqiai.com/callback.php" />
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-accent" />
          <p className="text-sm font-semibold text-foreground">SENANGPAY</p>
        </div>
        <div className="rounded-xl overflow-hidden border border-border">
          <video src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/6953685ca61a7e20c1c93c5c.mp4" controls className="w-full aspect-video" preload="metadata" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Return URL</p>
          <CopyableUrl url="https://senangpayqiai.com/success.php" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2">Callback URL</p>
          <CopyableUrl url="https://senangpayqiai.com/callback.php" />
        </div>
      </div>
    </div>
  );
}

export type Guide = {
  slug: string;
  title: { cn: string; en: string };
  Content: ({ lang }: { lang: Lang }) => JSX.Element;
};

/** The guides shown in the navbar "指南 / Guides" dropdown → each opens its own
 *  full page at /guides/:slug. Add a guide here and it appears everywhere. */
export const GUIDES: Guide[] = [
  { slug: "whatsapp-sms", title: { cn: "WhatsApp SMS Guideline", en: "WhatsApp SMS Guideline" }, Content: SMSGuidelineContent },
  { slug: "wa-vs-waba", title: { cn: "WhatsApp vs WABA", en: "WhatsApp vs WABA" }, Content: WAvsWABAContent },
  { slug: "payex-senangpay", title: { cn: "Payex/Senangpay 集成指南", en: "Payex/Senangpay Integration" }, Content: PayexSenangpayContent },
];

export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);
