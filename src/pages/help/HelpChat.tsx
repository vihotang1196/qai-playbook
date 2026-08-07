import { useEffect, useRef, useState } from "react";
import { Send, Loader2, RotateCcw, Bot, User, FileText, Sparkles, ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import { sendChat, sendFeedback, fetchHistory, type ChatSource } from "@/lib/helpdeskChat";
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

// ── AI answer language — SEPARATE from the site's UI language ─────────────
// The navbar EN/中文 toggle controls the interface. This controls only what
// language Angel AI ANSWERS in, because the two are genuinely independent: a
// customer may read the UI in Chinese but want the answer in English to forward
// to someone, or vice versa. "auto" keeps the original behaviour (the model
// replies in whatever language the question was asked in).
type AnswerLang = "auto" | "cn" | "en";
const ANSWER_LANG_KEY = "hd_answer_lang";

function loadAnswerLang(): AnswerLang {
  try {
    const v = sessionStorage.getItem(ANSWER_LANG_KEY);
    return v === "cn" || v === "en" ? v : "auto";
  } catch {
    return "auto";
  }
}

const WHATSAPP_URL = "https://wa.me/601112436811";

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

/**
 * The active conversation id, remembered across reloads and keyed PER
 * SUB-ACCOUNT.
 *
 * It used to live only in React state, so every refresh started a fresh
 * conversation row. The visible symptom was a blank chat, but the damage was in
 * the data: one person asking three questions with a reload between them became
 * three separate conversations in the admin list, and the assistant lost the
 * thread each time.
 *
 * Keyed by location_id because one browser may be used across several
 * sub-accounts — a single key would hand whichever thread was last active to
 * whichever sub-account opened next.
 */
const CONV_KEY_PREFIX = "hd_conversation_id:";
const convKey = (locationId: string) => `${CONV_KEY_PREFIX}${locationId}`;

function loadConversationId(locationId: string): string | null {
  if (!locationId) return null;
  try {
    return localStorage.getItem(convKey(locationId));
  } catch {
    return null;
  }
}
function saveConversationId(locationId: string, id: string | null) {
  if (!locationId) return;
  try {
    if (id) localStorage.setItem(convKey(locationId), id);
    else localStorage.removeItem(convKey(locationId));
  } catch {
    /* private mode — the thread still works for this visit, just not the next */
  }
}

export default function HelpChat({
  lang,
  locationId,
  staffEmail,
  staffName,
  onOpenArticle,
  visible = true,
}: {
  lang: "cn" | "en";
  locationId: string;
  staffEmail?: string;
  staffName?: string;
  onOpenArticle: (id: string) => void;
  /** False while the shell keeps this mounted but hidden (another tab is showing,
   *  or a guide has taken the pane on a narrow screen). Needed only so the thread
   *  can re-pin to the bottom on reappearing: a display:none element has zero
   *  scrollHeight, so the scroll effect below is a no-op while hidden. */
  visible?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(() => loadConversationId(locationId));
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  // Remembered for the tab session so the customer picks once, not every visit.
  const [answerLang, setAnswerLang] = useState<AnswerLang>(loadAnswerLang);
  const visitorId = useRef<string>(getVisitorId());

  function pickAnswerLang(v: AnswerLang) {
    setAnswerLang(v);
    try {
      sessionStorage.setItem(ANSWER_LANG_KEY, v);
    } catch {
      /* private mode — the in-memory choice still applies for this visit */
    }
  }
  const scrollRef = useRef<HTMLDivElement>(null);

  // Record a 👍/👎 on the answer at turn index i. Optimistic; best-effort write.
  function rate(index: number, rating: "up" | "down", excerpt: string) {
    if (!conversationId) return;
    setFeedback((f) => ({ ...f, [index]: rating }));
    sendFeedback({
      conversationId,
      messageIndex: index,
      rating,
      excerpt,
      visitorId: visitorId.current,
      locationId: locationId || null,
    }).catch(() => {
      /* best-effort — leave the optimistic state */
    });
  }

  useEffect(() => {
    if (!visible) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending, visible]);

  // Replay the visitor's last thread on open. Best-effort by construction —
  // fetchHistory resolves to an empty history rather than throwing, so a failed
  // replay leaves a blank chat that works normally instead of an error state.
  // Guarded by `cancelled` because the answer can land after a fast unmount.
  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    fetchHistory({ visitorId: visitorId.current, locationId }).then((h) => {
      if (cancelled || h.messages.length === 0) return;
      setTurns(h.messages.map((m) => ({ role: m.role, content: m.content, sources: m.sources })));
      // Adopt the server's id even though one was probably loaded from storage:
      // it is the row the messages actually came from, so this self-heals a
      // stale local id (deleted conversation, cleared table) without a reset.
      if (h.conversationId) {
        setConversationId(h.conversationId);
        saveConversationId(locationId, h.conversationId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

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
        askerEmail: staffEmail || null,
        askerName: staffName || null,
        // Omitted when "auto" so the server keeps detecting from the question.
        answerLang: answerLang === "auto" ? null : answerLang,
      });
      setConversationId(reply.conversationId);
      saveConversationId(locationId, reply.conversationId);
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

  // The stored id MUST be cleared too. Without it "新对话" would only blank the
  // screen, and the next reload would replay the thread the visitor just asked
  // to leave — a button that appears to have done nothing.
  function reset() {
    setTurns([]);
    setConversationId(null);
    setFeedback({});
    saveConversationId(locationId, null);
  }

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col h-full min-h-0">
      {/* Toolbar above the thread: talk to a human, and pick the AI's reply
          language. Deliberately ABOVE the messages so it's visible before the
          first question, and it doesn't cover any content. */}
      <div className="flex items-center gap-2 flex-wrap pb-3 mb-3 border-b border-[#141414]/10">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#141414] bg-[#fed50a] px-3 py-1.5 text-xs font-bold text-[#141414] hover:opacity-90 transition-opacity"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {lang === "cn" ? "WhatsApp 联系真人" : "Chat with a human"}
        </a>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {lang === "cn" ? "AI 回答语言" : "AI answers in"}
          </span>
          <div className="inline-flex rounded-xl border-2 border-[#141414] overflow-hidden">
            {(
              [
                { v: "auto", cn: "自动", en: "Auto" },
                { v: "cn", cn: "中文", en: "中文" },
                { v: "en", cn: "English", en: "English" },
              ] as { v: AnswerLang; cn: string; en: string }[]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => pickAnswerLang(o.v)}
                className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  answerLang === o.v
                    ? "bg-[#141414] text-[#fed50a]"
                    : "bg-white text-[#141414] hover:bg-[#141414]/[0.06]"
                }`}
              >
                {lang === "cn" ? o.cn : o.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {turns.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm px-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#fed50a]"
              style={{ background: "#141414" }}
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
          turns.map((t, i) => (
            <Bubble
              key={i}
              turn={t}
              lang={lang}
              onOpenArticle={onOpenArticle}
              rating={feedback[i]}
              onRate={(r) => rate(i, r, t.content)}
            />
          ))
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
  rating,
  onRate,
}: {
  turn: Turn;
  lang: "cn" | "en";
  onOpenArticle: (id: string) => void;
  rating?: "up" | "down";
  onRate: (rating: "up" | "down") => void;
}) {
  const isUser = turn.role === "user";
  const hasSources = !!turn.sources && turn.sources.length > 0;
  // B-guard: never show a blank/"not found" answer alongside source guides. If
  // the model read article(s) but returned no prose, show a localized pointer.
  const content =
    turn.content?.trim() ||
    (hasSources
      ? lang === "cn"
        ? "我找到几篇相关的指南 👇 点开下方链接查看完整的图文步骤。"
        : "I found some related guides 👇 open the links below for the full step-by-step."
      : turn.content);
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
            <p className="text-[11px] text-muted-foreground">{lang === "cn" ? "相关指南：" : "Related guide:"}</p>
            {turn.sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenArticle(s.id)}
                className="inline-flex items-center gap-1.5 text-xs text-foreground hover:opacity-80 text-left"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" /> {s.title}
              </button>
            ))}
          </div>
        )}
        {!isUser && !turn.content.startsWith("⚠️") && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{lang === "cn" ? "有帮助吗？" : "Helpful?"}</span>
            <button
              type="button"
              aria-label={lang === "cn" ? "有帮助" : "Helpful"}
              onClick={() => onRate("up")}
              className={`p-1 rounded-md hover:bg-muted transition-colors ${rating === "up" ? "text-foreground" : "text-muted-foreground"}`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label={lang === "cn" ? "没帮助" : "Not helpful"}
              onClick={() => onRate("down")}
              className={`p-1 rounded-md hover:bg-muted transition-colors ${rating === "down" ? "text-foreground" : "text-muted-foreground"}`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            {rating && <span className="text-[11px] text-muted-foreground">{lang === "cn" ? "谢谢反馈" : "Thanks!"}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
