import { useEffect, useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_TOOLS } from "@/lib/admin/tools";
import { listAudit, type AdminAuditEntry } from "@/lib/adminApi";

/**
 * Admin audit log (`/admin/audit`) — who changed what, when. Read-only; data
 * comes from the requireAdmin-gated `admin` edge fn.
 */
const toolName = (key: string | null) =>
  (key && ADMIN_TOOLS.find((t) => t.key === key)?.name.cn) || key || "";

export default function AdminAudit() {
  const [rows, setRows] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAudit(200)
      .then((a) => !cancelled && setRows(a))
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : "加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const describe = (r: AdminAuditEntry): string => {
    const who = r.admin_email || "某管理员";
    const biz = r.business_name || r.target_location_id || "";
    if (r.action === "set_tool_access") {
      const to = r.detail?.to;
      return `${who} 把「${biz}」的 ${toolName(r.tool_key)} ${to ? "开启" : "关闭"}了`;
    }
    if (r.action === "sync_locations") {
      return `${who} 从 GHL 同步了子账号（${r.detail?.total ?? "?"} 个）`;
    }
    return `${who} · ${r.action}`;
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-slate-300" />
        <h1 className="text-xl font-semibold">审计日志</h1>
      </div>
      <p className="text-sm text-slate-400 mt-1">谁改了谁的权限、谁触发了同步。</p>

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 py-10">
          <Loader2 className="w-5 h-5 animate-spin" /> 加载中…
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400 py-10 text-center">还没有记录。</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 flex items-center gap-3">
              <span className="text-sm text-slate-200 flex-1 min-w-0">{describe(r)}</span>
              <span className="text-[11px] text-slate-500 shrink-0">{new Date(r.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
