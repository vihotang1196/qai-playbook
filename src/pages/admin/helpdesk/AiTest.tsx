import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Loader2, RotateCcw, Bot, User, FileText } from "lucide-react";
import { sendChat, type ChatSource } from "@/lib/helpdeskChat";
import Markdown from "@/components/helpdesk/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Turn = { role: "user" | "assistant"; content: string; sources?: ChatSource[] };

/**
 * Admin "AI 测试" page (`/admin/helpdesk/chat`). Lets the team try Angel AI
 * against the synced KB before the public widget (P6) ships. It calls the same
 * PUBLIC helpdesk-chat fn the widget will use, tagged channel="admin-test" so
 * P7 analytics can exclude these test conversations. Sources link to the
 * read-only article view.
 */
export default function HelpdeskAiTest() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const visitorId = useRef<string>(`admin-test-${crypto.randomUUID().slice(0, 8)}`);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", content: message }]);
    setSending(true);
    try {
      const reply = await sendChat({
        message,
        conversationId,
        visitorId: visitorId.current,
        channel: "admin-test",
      });
      setConversationId(reply.conversationId);
      setTurns((t) => [...t, { role: "assistant", content: reply.answer, sources: reply.sources }]);
    } catch (e) {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: `⚠️ 出错了：${e instanceof Error ? e.message : "请求失败"}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setTurns([]);
    setConversationId(null);
    visitorId.current = `admin-test-${crypto.randomUUID().slice(0, 8)}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          在这里试 Angel AI 答得好不好——用同一个公开聊天接口（标记为测试，不进真实统计）。
        </p>
        {turns.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={reset} disabled={sending}>
            <RotateCcw className="w-4 h-4" /> 新对话
          </Button>
        )}
      </div>

      <div className="glass-card rounded-2xl p-4">
        <div ref={scrollRef} className="max-h-[52vh] overflow-y-auto space-y-4 pr-1">
          {turns.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Bot className="w-8 h-8 mx-auto mb-3 opacity-50" />
              问点什么试试，例如「怎么设置 WhatsApp 活动？」
            </div>
          ) : (
            turns.map((t, i) => <Bubble key={i} turn={t} />)
          )}
          {sending && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Bot className="w-4 h-4" /> <Loader2 className="w-4 h-4 animate-spin" /> 正在找答案…
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入问题，回车发送"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()} className="gap-1.5 shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";
  const hasSources = !!turn.sources && turn.sources.length > 0;
  // Never show a blank/"not found" answer next to source guides (see the
  // helpdesk-chat source-aware fallback).
  const content =
    turn.content?.trim() || (hasSources ? "我找到几篇相关的指南 👇 点开下方链接查看完整的图文步骤。" : turn.content);
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          isUser ? "bg-muted text-foreground" : "text-[#fed50a]"
        }`}
        style={isUser ? undefined : { background: "#141414" }}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block rounded-2xl px-3.5 py-2 text-left ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted/60"
          }`}
        >
          {isUser ? <p className="text-sm whitespace-pre-wrap">{content}</p> : <Markdown>{content}</Markdown>}
        </div>
        {turn.sources && turn.sources.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 items-start">
            <p className="text-[11px] text-muted-foreground">相关指南：</p>
            {turn.sources.map((s) => (
              <Link
                key={s.id}
                to={`/admin/helpdesk/knowledge/${s.id}`}
                className="inline-flex items-center gap-1.5 text-xs text-foreground hover:opacity-80"
              >
                <FileText className="w-3.5 h-3.5" /> {s.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
