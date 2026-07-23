import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, Loader2, MessageSquare, Search, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { toast } from "sonner";
import {
  getConversation,
  listConversations,
  type ConversationDetail,
  type ConversationRow,
} from "@/lib/helpdeskAdmin";
import Markdown from "@/components/helpdesk/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Conversations admin (`/admin/helpdesk/conversations`). Lists real visitor
 * threads (excludes the internal admin-test channel by default; a toggle
 * includes them) and opens one to read the full thread + its 👍/👎 feedback.
 * All reads go through the requireAdmin-gated helpdesk-admin fn.
 */
const CHANNEL_LABEL: Record<string, string> = { web: "网页", widget: "帮助中心", "admin-test": "内部测试" };

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts.slice(0, 16).replace("T", " ");
  }
}

// Need 2 — who asked. Conversations created BEFORE the feature launched predate
// per-staff attribution, so an empty asker shows "—" (unknown); created after,
// an empty asker is a genuine anonymous visitor ("匿名访客").
const ASKER_CUTOFF = "2026-07-23T00:00:00Z";
function askerLabel(c: { asker_name: string | null; asker_email: string | null; created_at: string }): string {
  if (c.asker_name?.trim()) return c.asker_name.trim();
  if (c.asker_email?.trim()) return c.asker_email.trim();
  try {
    return new Date(c.created_at).getTime() >= new Date(ASKER_CUTOFF).getTime() ? "匿名访客" : "—";
  } catch {
    return "—";
  }
}

export default function HelpdeskConversations() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (selectedId) return <Thread id={selectedId} onBack={() => setSelectedId(null)} />;
  return <ConvList onOpen={setSelectedId} />;
}

function ConvList({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeTest, setIncludeTest] = useState(false);
  const [query, setQuery] = useState(""); // filter by staff (email/name) or visitor id

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      listConversations({ includeTest, query: query.trim(), limit: 100 })
        .then((r) => !cancelled && setRows(r))
        .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : "加载失败"))
        .finally(() => !cancelled && setLoading(false));
    }, query ? 300 : 0); // debounce while typing
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [includeTest, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">访客与 Angel AI 的聊天记录，最新在前。</p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 cursor-pointer">
          <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
          含内部测试
        </label>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="按 staff（邮箱/姓名）或访客 ID 搜索…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">还没有对话记录。</div>
      ) : (
        <div className="glass-card rounded-2xl divide-y divide-border/40">
          {rows.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c.id)}
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              <MessageSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{c.question || <span className="text-muted-foreground">（无提问）</span>}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  <span className="font-medium text-foreground">{askerLabel(c)}</span>
                  {` · ${fmt(c.updated_at)} · ${CHANNEL_LABEL[c.channel] || c.channel}`}
                  {c.business_name ? ` · ${c.business_name}` : c.location_id ? ` · ${c.location_id}` : ""}
                  {` · ${c.messageCount} 条`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getConversation(id)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : "加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const ratingByIndex = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of detail?.feedback || []) m.set(f.message_index, f.rating);
    return m;
  }, [detail]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> 返回列表
      </Button>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !detail ? (
        <div className="glass-card rounded-2xl p-6 text-sm">加载失败。</div>
      ) : (
        <div className="glass-card rounded-2xl p-4 sm:p-6">
          <div className="text-xs text-muted-foreground mb-4">
            {fmt(detail.conversation.created_at)} · {CHANNEL_LABEL[detail.conversation.channel] || detail.conversation.channel}
            {detail.conversation.business_name
              ? ` · ${detail.conversation.business_name}`
              : detail.conversation.location_id
                ? ` · ${detail.conversation.location_id}`
                : ""}
            {" · 提问人 "}
            <span className="font-medium text-foreground">{askerLabel(detail.conversation)}</span>
            {` · 访客 ${detail.conversation.visitor_id}`}
          </div>
          <div className="space-y-4">
            {detail.messages.map((m, i) => {
              const isUser = m.role === "user";
              const rating = ratingByIndex.get(i);
              return (
                <div key={i} className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isUser ? "bg-muted text-foreground" : "text-white"}`}
                    style={isUser ? undefined : { background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
                    <div className={`inline-block rounded-2xl px-3.5 py-2 text-left ${isUser ? "bg-primary text-primary-foreground" : "bg-muted/60"}`}>
                      {isUser ? <p className="text-sm whitespace-pre-wrap">{m.content}</p> : <Markdown>{m.content}</Markdown>}
                    </div>
                    {rating && (
                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1 justify-start">
                        {rating === "up" ? <ThumbsUp className="w-3.5 h-3.5 text-primary" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                        {rating === "up" ? "用户觉得有帮助" : "用户觉得没帮助"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
