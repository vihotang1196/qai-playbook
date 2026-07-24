import {
  ArrowRight,
  MessageCircle,
  Zap,
  Users,
  TrendingUp,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import "@/styles/qai-brutalist.css";

/**
 * Q.Ai design-system SAMPLE page (Brutalist yellow/black/white) — the rebrand
 * preview at /qai-style. Fully self-contained: rendered OUTSIDE the shared
 * coral-glass <Layout>, all styling scoped under `.qai-brut`, so it can't touch
 * or be touched by the existing app. Once the owner approves the look, this
 * graduates into the shared tokens/components and the pages migrate one by one.
 *
 * Copy is Q.Ai-real (marketing / WhatsApp / community), Chinese-first, so the
 * owner judges the style in a realistic composition rather than lorem ipsum.
 */

const FEATURES = [
  {
    icon: MessageCircle,
    title: "WhatsApp 自动跟进",
    body: "客户一留言，系统就自动回、自动跟进，不用你半夜爬起来回消息。",
  },
  {
    icon: Zap,
    title: "一键生成文案",
    body: "输入产品和卖点，AI 当场写好广告脚本、贴文和跟进话术，直接拿去用。",
  },
  {
    icon: Users,
    title: "社区一起学",
    body: "跟着一群认真做生意的人一起进步，遇到问题有人答、有人陪你走。",
  },
];

const STEPS = [
  { icon: Rocket, title: "开好账号", body: "几分钟接上你的 WhatsApp 和后台，不用懂技术。" },
  { icon: TrendingUp, title: "跑起流程", body: "套用现成模板，客户进来就自动被跟进、被成交。" },
  { icon: ShieldCheck, title: "稳稳收单", body: "全部记录留底、合规安全，你只管专心做生意。" },
];

export default function QaiStylePreview() {
  return (
    <div className="qai-brut" style={{ minHeight: "100vh" }}>
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(8px)",
          borderBottom: "2px solid var(--ink)",
        }}
      >
        <div
          className="qb-container"
          style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 900, fontSize: 24, letterSpacing: "-0.03em" }}>
            Q<span className="qb-key">.</span>Ai
          </span>
          <nav style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <a href="#features" style={{ fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>功能</a>
            <a href="#how" style={{ fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>怎么用</a>
            <a href="#start" className="qb-btn qb-btn--sm">开始 <ArrowRight size={16} /></a>
          </nav>
        </div>
      </header>

      {/* ── Hero (dark) ─────────────────────────────────────────────────── */}
      <section className="qb-dark">
        <div className="qb-container" style={{ padding: "88px 24px 96px", textAlign: "center" }}>
          <span className="qb-eyebrow qb-rise">给认真做生意的人</span>
          <h1
            className="qb-rise qb-rise-2"
            style={{ fontWeight: 900, fontSize: "clamp(40px, 6.2vw, 68px)", lineHeight: 1.06, margin: "22px auto 0", maxWidth: 880 }}
          >
            把你的 WhatsApp 变成<br />
            <span className="qb-key">自动赚钱</span>的<span className="qb-mark">销售机器</span>
          </h1>
          <p className="qb-on-dark-muted qb-rise qb-rise-3" style={{ fontSize: 20, maxWidth: 620, margin: "22px auto 0" }}>
            不用雇人、不用懂技术。客户自动被跟进、被成交，你只管收单。
          </p>
          <div
            className="qb-rise qb-rise-4"
            style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 34, flexWrap: "wrap" }}
          >
            <a href="#start" className="qb-btn qb-btn--lg qb-btn--glow">免费开始 <ArrowRight size={20} /></a>
            <a href="#how" className="qb-btn qb-btn--lg qb-btn--ghost">看怎么用</a>
          </div>
        </div>
      </section>

      {/* ── Features (light) ────────────────────────────────────────────── */}
      <section id="features" className="qb-section">
        <div className="qb-container">
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <span className="qb-eyebrow">你会拿到什么</span>
            <h2 className="qb-h2" style={{ marginTop: 16 }}>三样东西，帮你少熬夜、多收单</h2>
            <p className="qb-sub">说人话：让机器替你干重复的活，你去做真正赚钱的事。</p>
          </div>
          <div className="qb-grid-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="qb-card">
                <div className="qb-icon"><f.icon size={26} strokeWidth={2} /></div>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: "18px 0 8px" }}>{f.title}</h3>
                <p style={{ color: "var(--muted)" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Emphasis block ──────────────────────────────────────────────── */}
      <section className="qb-section" style={{ paddingTop: 0 }}>
        <div className="qb-container">
          <div className="qb-block qb-grid-2">
            <div>
              <span className="qb-eyebrow">为什么是我们</span>
              <h2 className="qb-h2" style={{ marginTop: 16 }}>
                别的工具让你<span className="qb-mark">更忙</span>，<br />我们让你<span className="qb-key">更闲</span>。
              </h2>
              <p className="qb-sub" style={{ marginTop: 14 }}>
                一套后台搞定跟进、文案、成交记录。老人家都看得懂，今天就能上手。
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 900, fontSize: 52, lineHeight: 1 }}>3×</span>
                <span style={{ color: "var(--muted)" }}>跟进效率</span>
              </div>
              <div style={{ borderTop: "2px solid var(--ink)" }} />
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 900, fontSize: 52, lineHeight: 1 }}>0</span>
                <span style={{ color: "var(--muted)" }}>需要雇的客服</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works (light) ────────────────────────────────────────── */}
      <section id="how" className="qb-section" style={{ paddingTop: 0 }}>
        <div className="qb-container">
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <span className="qb-eyebrow">三步就跑起来</span>
            <h2 className="qb-h2" style={{ marginTop: 16 }}>简单到不像话</h2>
          </div>
          <div className="qb-grid-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="qb-block">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="qb-icon"><s.icon size={26} strokeWidth={2} /></div>
                  <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 900, fontSize: 34 }}>{i + 1}</span>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: "16px 0 8px" }}>{s.title}</h3>
                <p style={{ color: "var(--muted)" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA (dark) ────────────────────────────────────────────── */}
      <section id="start" className="qb-dark">
        <div className="qb-container" style={{ padding: "80px 24px", textAlign: "center" }}>
          <h2 style={{ fontWeight: 900, fontSize: "clamp(34px, 5vw, 52px)", lineHeight: 1.1, maxWidth: 720, margin: "0 auto" }}>
            今天就让机器<span className="qb-key">替你上班</span>
          </h2>
          <p className="qb-on-dark-muted" style={{ fontSize: 20, marginTop: 16 }}>
            免费开始，几分钟就能跑起你的第一个自动跟进流程。
          </p>
          <div style={{ marginTop: 30 }}>
            <a href="#" className="qb-btn qb-btn--lg qb-btn--glow">免费开始使用 <ArrowRight size={20} /></a>
          </div>
        </div>
      </section>

      {/* ── Footer (dark) ───────────────────────────────────────────────── */}
      <footer className="qb-dark" style={{ borderTop: "2px solid var(--yellow)" }}>
        <div
          className="qb-container"
          style={{ padding: "34px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}
        >
          <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 900, fontSize: 22 }}>Q<span className="qb-key">.</span>Ai</span>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            <a href="#" className="qb-on-dark-muted" style={{ textDecoration: "none" }}>条款</a>
            <a href="#" className="qb-on-dark-muted" style={{ textDecoration: "none" }}>隐私</a>
            <a href="#" className="qb-on-dark-muted" style={{ textDecoration: "none" }}>联系我们</a>
          </div>
          <span className="qb-on-dark-muted" style={{ fontSize: 16 }}>© 2026 Q.Ai 社区</span>
        </div>
      </footer>
    </div>
  );
}
