import { useEffect, useRef, useState } from "react";
import { Send, Loader2, RotateCcw, Bot, User, FileText, Sparkles } from "lucide-react";
import { sendChat, type ChatSource } from "@/lib/helpdeskChat";
import Markdown from "@/components/helpdesk/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Turn = { role: "user" | "assistant"; content: string; sources?: ChatSource[] };

/**
 * AI 问答 tab of the customer help center. Calls the same PUBLIC helpdesk-chat
 * fn as the admin test page, but tagged channel="widget" + the caller's
 * location_id (analytics only — content is not location-scoped). A source guide
 * under an answer opens that article IN THIS PAGE (via onOpenArticle), not a new
 * tab. visitorId persists in localStorage so a visitor's turns stay one thread.
 */

const VISITOR_KEY = "hd_visitor_id";
function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = `web-${crypto.randomUUID().slice(0, 12)}`;
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return `web-${crypto.randomUUID().slice(0, 12)}`;
  }
}

export default function HelpChat({
  lang,
  locationId,
  onOpenArticle,
}: {
  lang: "cn" | "en";
  locationId: string;
  onOpenArticle: (id: string) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const visitorId = useRef<string>(getVisitorId());
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
        locationId: locationId || null,
        channel: "widget",
      });
      setConversationId(reply.conversationId);
      setTurns((t) => [...t, { role: "assistant", content: reply.answer, sources: reply.sources }]);
    } catch (e) {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content:
            (lang === "cn" ? "⚠️ 出错了：" : "⚠️ Something went wrong: ") +
            (e instanceof Error ? e.message : lang === "cn" ? "请求失败" : "request failed"),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setTurns([]);
    setConversationId(null);
  }

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {turns.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm px-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white"
              style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
            >
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="font-medium text-foreground mb-1">
              {lang === "cn" ? "问我任何关于产品的问题" : "Ask me anything about the product"}
            </p>
            <p className="text-xs">
              {lang === "cn"
                ? "例如「怎么设置 WhatsApp 活动？」我会帮你找到对应教程。"
                : "e.g. “How do I set up a WhatsApp campaign?” — I'll find the right guide."}
            </p>
          </div>
        ) : (
          turns.map((t, i) => <Bubble key={i} turn={t} lang={lang} onOpenArticle={onOpenArticle} />)
        )}
        {sending && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Bot className="w-4 h-4" /> <Loader2 className="w-4 h-4 animate-spin" />
            {lang === "cn" ? "正在找答案…" : "Finding an answer…"}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
        {turns.length > 0 && (
          <Button variant="outline" size="icon" className="shrink-0" onClick={reset} disabled={sending} title={lang === "cn" ? "新对话" : "New chat"}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={lang === "cn" ? "输入问题，回车发送" : "Type your question, press Enter"}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          disabled={sending}
        />
        <Button onClick={send} disabled={sending || !input.trim()} className="gap-1.5 shrink-0">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline">{lang === "cn" ? "发送" : "Send"}</span>
        </Button>
      </div>
    </div>
  );
}

function Bubble({
  turn,
  lang,
  onOpenArticle,
}: {
  turn: Turn;
  lang: "cn" | "en";
  onOpenArticle: (id: string) => void;
}) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          isUser ? "bg-muted text-foreground" : "text-white"
        }`}
        style={isUser ? undefined : { background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block rounded-2xl px-3.5 py-2 text-left ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted/60"
          }`}
        >
          {isUser ? <p className="text-sm whitespace-pre-wrap">{turn.content}</p> : <Markdown>{turn.content}</Markdown>}
        </div>
        {turn.sources && turn.sources.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 items-start">
            <p className="text-[11px] text-muted-foreground">{lang === "cn" ? "相关指南：" : "Related guide:"}</p>
            {turn.sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenArticle(s.id)}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:opacity-80 text-left"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" /> {s.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
