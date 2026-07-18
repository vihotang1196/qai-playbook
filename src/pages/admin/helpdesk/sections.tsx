import { Wrench } from "lucide-react";

/**
 * Phase 0 placeholders for the Helpdesk admin sections. Each renders inside the
 * HelpdeskAdminShell (which sits inside the Admin Portal's AdminLayout, so login
 * + chrome already exist). Each phase replaces the relevant stub with the real
 * page.
 */
function Stub({ title, desc, phase }: { title: string; desc: string; phase: string }) {
  return (
    <div className="glass-card rounded-2xl p-8 text-center">
      <div className="vision-chip mx-auto mb-4">
        <Wrench className="w-3 h-3" /> 即将上线 · {phase}
      </div>
      <h2 className="text-lg font-display font-semibold mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">{desc}</p>
    </div>
  );
}

export const HdKnowledge = () => (
  <Stub title="知识库" desc="文章与文件夹的增删改查；从 Notion 同步导入正文与图片。" phase="P3 · P4" />
);
export const HdConversations = () => (
  <Stub title="对话" desc="查看访客与 AI 的聊天记录、👍 👎 反馈。" phase="P7" />
);
export const HdAnalytics = () => (
  <Stub title="分析" desc="AI 答题率、热门问题、按 Sub Account 归因。" phase="P7" />
);
export const HdUpdates = () => (
  <Stub title="产品更新" desc="发布产品动态与 FAQ，挂件里向用户展示。" phase="P8" />
);
export const HdSettings = () => (
  <Stub title="设置" desc="挂件品牌（标题／颜色／logo）与 Notion 连接设置。" phase="P4 · P9" />
);
