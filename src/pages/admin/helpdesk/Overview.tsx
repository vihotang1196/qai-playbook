import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  FolderTree,
  MessagesSquare,
  HelpCircle,
  Megaphone,
  Loader2,
  Plug,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getOverview, type HelpdeskOverview } from "@/lib/helpdeskAdmin";

/**
 * Helpdesk admin landing (`/admin/helpdesk`). P2: proves the authenticated data
 * path — pulls LIVE counts from the hd_ tables through the requireAdmin-gated
 * `helpdesk-admin` edge fn (the frontend never touches the tables directly).
 * Counts are mostly 0 until content lands from P3 (knowledge) / P4 (Notion).
 */
export default function HelpdeskOverview() {
  const [data, setData] = useState<HelpdeskOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOverview()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#141414] shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm">加载总览失败</p>
          <p className="text-sm text-muted-foreground mt-0.5">{err ?? "无数据"}</p>
        </div>
      </div>
    );
  }

  const c = data.counts;
  const tiles = [
    { icon: BookOpen, label: "文章", value: c.articles, to: "/admin/helpdesk/knowledge" },
    { icon: FolderTree, label: "文件夹", value: c.folders, to: "/admin/helpdesk/knowledge" },
    { icon: MessagesSquare, label: "对话", value: c.conversations, to: "/admin/helpdesk/conversations" },
    { icon: HelpCircle, label: "FAQ", value: c.faq, to: "/admin/helpdesk/updates" },
    { icon: Megaphone, label: "产品更新", value: c.updates, to: "/admin/helpdesk/updates" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="glass-card rounded-2xl p-4 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#fed50a] mb-3"
              style={{ background: "#141414" }}
            >
              <t.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-display font-bold tabular-nums">{t.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.label}</p>
          </Link>
        ))}
      </div>

      {/* Notion connection state (never shows the key itself). */}
      <div className="glass-card rounded-2xl p-5 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#fed50a] shrink-0"
          style={{ background: "#141414" }}
        >
          <Plug className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm">Notion 同步</p>
          <p className="text-sm text-muted-foreground">
            {data.notion.connected
              ? `已连接 · ${data.notion.databases} 个数据库`
              : "未连接——在「设置」里填 Notion 密钥后，可从 Notion 导入文章（P4）。"}
          </p>
        </div>
        {data.notion.connected ? (
          <CheckCircle2 className="w-5 h-5 text-[#141414] shrink-0" />
        ) : (
          <Link to="/admin/helpdesk/settings" className="text-xs font-medium text-foreground hover:opacity-80 shrink-0">
            去设置
          </Link>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        数据实时来自帮助中心数据库（经管理员鉴权的后端读取，前端不直连数据表）。现在多为 0 是正常的——从 P3 起会有内容。
      </p>
    </div>
  );
}
