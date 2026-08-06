import { useState, type ReactNode } from "react";
import "@/styles/upgrade.css";
import { useLang } from "@/i18n/LanguageContext";

// Bilingual helper, matching the pattern used across the site:
// bi(en, cn) builds a bilingual string, l() picks the current language.
type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

/**
 * FAQ content. Answers are ReactNode (not plain strings) because two of them
 * carry the SST price disclosure, which is bolded. Q1 and Q6 wording is fixed
 * by the owner — do not reword.
 */
const faqs: { q: Bi; a: { cn: ReactNode; en: ReactNode } }[] = [
  {
    q: bi("Are $1,000 and $190 one-time or annual?", "$1,000 和 $190 是一次性还是每年？"),
    a: {
      cn: (
        <>
          都是按年收费。Nurture Plan 升级是 USD $1,000 / 年，WhatsApp Add-on 是 USD $190 / 每个 / 年。
          <b>以上价格均未含 SST，结账时另加 8%。</b>
        </>
      ),
      en: (
        <>
          Both are annual. Nurture Plan upgrade is USD $1,000/year, WhatsApp Add-on is USD $190
          each/year. <b>Prices exclude SST — 8% is added at checkout.</b>
        </>
      ),
    },
  },
  {
    q: bi(
      "Can I add just one WhatsApp? Can I upgrade only one plan?",
      "我可以只加一个 WhatsApp 吗？只升级其中一个配套行不行？"
    ),
    a: {
      cn: <>可以。WhatsApp 按个数加，要几个加几个，数量越多价格越优惠。两个配套也可以只升级其中一个，完全看你的需求。</>,
      en: (
        <>
          Yes. WhatsApp is priced per number — add as many as you need, with better rates at higher
          volume. You can also upgrade just one of the two plans. Entirely up to you.
        </>
      ),
    },
  },
  {
    q: bi("How soon can I start using it?", "升级后多久能开始用？"),
    a: {
      cn: <>大约两天。我们会帮你完成 Set Up 和 Onboard，弄好就能直接用。</>,
      en: <>About two days. We handle setup and onboarding — once it's done, you're ready to go.</>,
    },
  },
  {
    q: bi("Will customer data get mixed up between accounts?", "多个账号之间，客户数据会不会混在一起？"),
    a: {
      cn: <>不会。每个账号完全独立运作，数据互不干扰。</>,
      en: <>No. Each account runs completely independently — data stays separate.</>,
    },
  },
  {
    q: bi("Do I need a new number for the added WhatsApp?", "加的 WhatsApp 一定要用新号码吗？"),
    a: {
      cn: <>不用。只要是 WhatsApp 号码都可以接进来。</>,
      en: <>No. Any WhatsApp number can be connected.</>,
    },
  },
  {
    q: bi("How do I pay? What about invoices and SST?", "怎么付款？有发票 / SST 吗？"),
    a: {
      cn: (
        <>
          联系我们的 Support 就能安排付款。<b>页面显示的价格未含 SST，结账时另加 8%</b>，我们会免费帮你开发票。
        </>
      ),
      en: (
        <>
          Contact our support team to arrange payment.{" "}
          <b>Prices shown exclude SST — 8% is added at checkout.</b> We'll issue your invoice free of
          charge.
        </>
      ),
    },
  },
];

/**
 * /upgrade — the upgrade sales page.
 *
 * Styling is fully isolated: everything lives under the top-level `.upg`
 * container and uses `u-`-prefixed classes from src/styles/upgrade.css. Nothing
 * here touches the global stylesheet or the shared shadcn UI kit, so it cannot
 * affect any other page.
 *
 * Nine sections, in the approved design order. The design's "客户见证"
 * (testimonials) block and its bespoke <footer> are intentionally omitted:
 * testimonials were dropped, and the page reuses the Playbook Layout footer.
 */
const Upgrade = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (b: Bi) => b[lang];

  // One FAQ open at a time; opening another closes the previous. Starts on the
  // first item because it carries the SST price disclosure.
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const scrollToPlans = () =>
    document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="upg">
      {/* ① HERO */}
      <section className="u-hero-band u-center">
        <div className="u-wrap">
          <span className="u-eyebrow">{l(bi("For existing users", "现有用户专属"))}</span>
          <h1 className="u-hero-title">
            {lang === "cn" ? (
              <>
                你的系统已经在跑，<br />是<span className="u-hl">时候放大它</span>
              </>
            ) : (
              <>
                Your system is already running — <span className="u-hl">time to scale it</span>
              </>
            )}
          </h1>
          {!hideSubtitles && (
            <p className="u-hero-sub">
              {l(bi(
                "Add an account = reach more clients. Add WhatsApp = handle more conversations. Take 30 seconds to find out which one you need.",
                "加「账号」= 接更多客户；加「WhatsApp」= 接得住更多对话。花 30 秒，帮你选对该加哪个。"
              ))}
            </p>
          )}
          <div className="u-hero-cta-row">
            <a
              className="u-cta u-solid-hero"
              href="https://wa.me/601112436811"
              target="_blank"
              rel="noopener noreferrer"
            >
              {l(bi("Upgrade now", "立即升级"))}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </a>
            <button type="button" className="u-cta u-ghost" onClick={scrollToPlans}>
              {l(bi("See plans & pricing", "先看方案 & 价格"))}
            </button>
          </div>
        </div>
      </section>

      {/* ② 痛点 / PAIN */}
      <section className="u-sec-tight">
        <div className="u-wrap">
          <h2 className="u-sec-title u-center u-display">
            {l(bi("You might be running into this", "你现在可能遇到这些问题"))}
          </h2>
          <div className="u-card">
            <div className="u-pain-grid">
              <div className="u-pain">
                <span className="u-x-chip"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></span>
                {l(bi(
                  "One account isn't enough anymore (more clients, more brands)",
                  "一个账号不够用了（客户 / brand 越来越多）"
                ))}
              </div>
              <div className="u-pain">
                <span className="u-x-chip"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></span>
                {l(bi(
                  "WhatsApp conversations piling up faster than you can reply",
                  "WhatsApp 对话开始变多，回不过来"
                ))}
              </div>
              <div className="u-pain">
                <span className="u-x-chip"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></span>
                {l(bi(
                  "Manual replies can't keep up — leads slipping through",
                  "人工回复跟不上，开始漏单"
                ))}
              </div>
              <div className="u-pain">
                <span className="u-x-chip"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></span>
                {l(bi(
                  "You want to scale, but the system is the bottleneck",
                  "想 scale 业务，但系统卡住了"
                ))}
              </div>
            </div>
          </div>
          <p className="u-empathy">
            {lang === "cn" ? (
              <>
                有以上任何一个感觉，其实是好事——<br />
                <span>这说明你的业务在长大，只是系统需要跟上了。</span>
              </>
            ) : (
              <>
                If any of these sound familiar, that's actually good news —{" "}
                <span>your business is growing. The system just needs to catch up.</span>
              </>
            )}
          </p>
        </div>
      </section>

      {/* ③ 开店比喻 / WHAT IT IS */}
      <section className="u-sec">
        <div className="u-wrap">
          <h2 className="u-sec-title u-center u-display">
            {l(bi("This upgrade is really just two things", "这次升级，其实只有两样东西"))}
          </h2>
          {!hideSubtitles && (
            <p className="u-sec-sub u-center">
              {l(bi(
                "Forget the jargon — think of it as opening shops",
                "别被术语搞乱，用「开店」来理解就很简单"
              ))}
            </p>
          )}
          <div className="u-two-col">
            <div className="u-card u-explain">
              <div className="u-emoji">🏢</div>
              <h3>{l(bi("An account (Nurture Plan) = one shop", "账号（Nurture Plan）= 一间「店」"))}</h3>
              <p>
                {l(bi(
                  "One more account = one more shop. Take on another brand or client, each running independently.",
                  "多一个账号 = 多开一间店，可以多接一个品牌 / 客户，每间店独立运作。"
                ))}
              </p>
            </div>
            <div className="u-card u-explain">
              <div className="u-emoji">💬</div>
              <h3>{l(bi("WhatsApp capacity = salespeople in the shop", "WhatsApp 容量 = 店里的「销售员」"))}</h3>
              <p>
                {l(bi(
                  "One more WhatsApp = one more salesperson. Handle more conversations at once, reply faster, lose fewer leads.",
                  "多加一个 WhatsApp = 多请一个销售，同时接更多对话、回得更快、更少漏单。"
                ))}
              </p>
            </div>
          </div>
          <div className="u-summary-bar">
            {l(bi(
              "So: want more clients? Add shops. Want faster replies and fewer missed leads? Add salespeople.",
              "所以 —— 想接更多客户，就加「店」；想回得更快、不漏单，就加「销售员」。"
            ))}
          </div>
        </div>
      </section>

      {/* ④ 三个好处 / 3 BENEFITS */}
      <section className="u-sec-tight">
        <div className="u-wrap">
          <h2 className="u-sec-title u-center u-display">
            {l(bi("What you get after upgrading", "升级后，你会得到什么"))}
          </h2>
          {!hideSubtitles && (
            <p className="u-sec-sub u-center">
              {l(bi("Three things that hit your revenue directly", "三件事，直接影响你的收入"))}
            </p>
          )}
          <div className="u-three-col">
            <div className="u-card u-benefit">
              <div className="u-bic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
              <h3>{l(bi("Reach more clients", "接更多客户"))}</h3>
              <p>
                {l(bi(
                  "Go from 1 account up to 6. Run multiple brands and projects at once — your ceiling opens up.",
                  "从 1 个账号扩到最多 6 个，多品牌、多项目同时跑，业务规模直接打开。"
                ))}
              </p>
            </div>
            <div className="u-card u-benefit">
              <div className="u-bic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></div>
              <h3>{l(bi("Reply faster, miss less", "回得更快、少漏单"))}</h3>
              <p>
                {l(bi(
                  "Multiple WhatsApp lines handling conversations at once. No waiting — faster replies mean higher close rates.",
                  "多个 WhatsApp 同时接对话，客户不用等，回复越快、成交率越高。"
                ))}
              </p>
            </div>
            <div className="u-card u-benefit">
              <div className="u-bic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg></div>
              <h3>{l(bi("Amplified revenue", "收入放大"))}</h3>
              <p>
                {l(bi(
                  "More clients plus faster closing, pushing from both ends. Revenue no longer capped by your system.",
                  "更多客户 + 更快成交，两头一起推，收入不再卡在系统的天花板上。"
                ))}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ⑤ 前后对比 / BEFORE VS AFTER */}
      <section className="u-sec">
        <div className="u-wrap">
          <h2 className="u-sec-title u-center u-display">
            {l(bi("Before vs after", "升级前 vs 升级后"))}
          </h2>
          {!hideSubtitles && (
            <p className="u-sec-sub u-center">{l(bi("The difference at a glance", "一眼看清差别"))}</p>
          )}
          <div className="u-card u-ba">
            <div className="u-ba-col u-ba-before">
              <div className="u-ba-tag">{l(bi("Before", "升级前"))}</div>
              <div className="u-ba-emoji">🏢</div>
              <div className="u-ba-main">{l(bi("1 shop + 1 salesperson", "1 间店 + 1 个 sales"))}</div>
              <div className="u-ba-desc">
                {l(bi(
                  "Limited clients. Once conversations pile up, replies fall behind and leads slip away.",
                  "能接的客户有限，对话一多就回不过来、开始漏单。"
                ))}
              </div>
            </div>
            <div className="u-ba-arrow"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></div>
            <div className="u-ba-col u-ba-after">
              <div className="u-ba-tag">{l(bi("After", "升级后"))}</div>
              <div className="u-ba-emoji">🏢🏢🏢🏢🏢🏢</div>
              <div className="u-ba-main">{l(bi("Up to 6 shops + multiple salespeople", "最多 6 间店 + 多个 sales"))}</div>
              <div className="u-ba-desc">
                {l(bi(
                  "Multiple brands running at once. Conversations handled, replies fast, deals close smoother.",
                  "多品牌同时运作，对话接得住、回得快，成交更顺。"
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ⑥ 哪种情况 / WHICH ONE */}
      <section className="u-sec-tight">
        <div className="u-wrap">
          <h2 className="u-sec-title u-center u-display">
            {l(bi("Which one is you right now?", "你现在是哪一种情况？"))}
          </h2>
          {!hideSubtitles && (
            <p className="u-sec-sub u-center">
              {l(bi("Find your situation, see what you need", "对号入座，一眼看出该加哪个"))}
            </p>
          )}
          <div className="u-card u-row">
            <span className="u-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></span>
            <span className="u-situation">
              {l(bi(
                "More clients and brands — one account isn't enough",
                "客户 / 品牌越来越多，一个账号不够用"
              ))}
            </span>
            <span className="u-rec">{l(bi("You need: more accounts", "你需要：加账号"))}</span>
          </div>
          <div className="u-card u-row">
            <span className="u-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg></span>
            <span className="u-situation">
              {l(bi(
                "One business, conversations overflowing, replies falling behind",
                "单个业务对话爆满、回复跟不上、开始漏单"
              ))}
            </span>
            <span className="u-rec">{l(bi("You need: more WhatsApp capacity", "你需要：加 WhatsApp 容量"))}</span>
          </div>
          <div className="u-card u-row">
            <span className="u-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg></span>
            <span className="u-situation">{l(bi("Both of the above", "两样都遇到了"))}</span>
            <span className="u-rec">{l(bi("Add both — fastest way to scale", "两个一起加，放大最快"))}</span>
          </div>
        </div>
      </section>

      {/* ⑦ 两个配套价格 / PLANS & PRICING */}
      <section className="u-sec" id="plans">
        <div className="u-wrap">
          <h2 className="u-sec-title u-center u-display">
            {l(bi("Two plans, pricing up front", "两个配套，价格清清楚楚"))}
          </h2>
          {/* Price disclosure — deliberately NOT wrapped in hideSubtitles: it
              states the billing period and that SST is excluded, so it must
              always be visible. */}
          <p className="u-sec-sub u-center">
            {l(bi(
              "Billed annually. Prices exclude SST. No hidden fees.",
              "都是按年收费，价格未含 SST，没有隐藏费用"
            ))}
          </p>
          <div className="u-two-col">
            {/* Plan A — add accounts */}
            <div className="u-card u-plan u-a">
              <div className="u-topbar" />
              <span className="u-kicker">{l(bi("📈 Grow your reach", "📈 扩展业务"))}</span>
              <h3>{l(bi("Upgrade Nurture Plan (add accounts)", "升级 Nurture Plan（加账号）"))}</h3>
              <p className="u-oneline">{l(bi("From 1 account up to 6", "从 1 个账号 → 最多 6 个账号"))}</p>
              <div className="u-price">
                <span className="u-cur">USD</span>
                <span className="u-amt">$1,000</span>
                <span className="u-per">{l(bi("/year", "/ 年"))}</span>
              </div>
              <p className="u-sst-note">+ 8% SST</p>
              <p className="u-fit">
                {lang === "cn" ? (
                  <>适合：<b>agency / 多品牌 / 多项目</b></>
                ) : (
                  <>Best for: <b>agencies, multi-brand, multi-project</b></>
                )}
              </p>
              <ul className="u-feats">
                <li>
                  <span className="u-ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  {l(bi("Manage multiple brands and clients at once", "同时管理多个品牌 / 客户"))}
                </li>
                <li>
                  <span className="u-ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  {l(bi("Each account runs independently — no mixed data", "每个账号独立运作，数据不混"))}
                </li>
                <li>
                  <span className="u-ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  {l(bi("Open up another revenue stream", "多开一条收入来源"))}
                </li>
              </ul>
              <a
                className="u-cta"
                href="https://wa.me/601112436811"
                target="_blank"
                rel="noopener noreferrer"
              >
                {l(bi("Upgrade accounts", "升级账号"))}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </a>
            </div>

            {/* Plan B — add WhatsApp capacity */}
            <div className="u-card u-plan u-b">
              <div className="u-topbar" />
              <span className="u-kicker">{l(bi("💬 Boost your capacity", "💬 提升处理能力"))}</span>
              <h3>{l(bi("WhatsApp Add-on", "WhatsApp Add-on（加 WhatsApp）"))}</h3>
              <p className="u-oneline">
                {l(bi("Add multiple WhatsApp numbers to one account", "一个账号可加多个 WhatsApp"))}
              </p>
              <div className="u-price">
                <span className="u-cur">USD</span>
                <span className="u-amt">$190</span>
                <span className="u-per">{l(bi("each/year", "/ 每个 / 年"))}</span>
              </div>
              <p className="u-sst-note">+ 8% SST</p>
              <p className="u-price-note">
                {l(bi("🔥 Better rates the more you add", "🔥 量多更优惠，加越多越划算"))}
              </p>
              <div className="u-video">
                <iframe
                  src="https://www.loom.com/embed/c86119e8d171442b9f6a80375141bbc9"
                  title={l(bi("WhatsApp Add-on introduction", "WhatsApp Add-on 介绍"))}
                  allowFullScreen
                />
              </div>
              <p className="u-fit">
                {lang === "cn" ? (
                  <>适合：<b>对话量大、常漏单、回复慢</b></>
                ) : (
                  <>Best for: <b>high volume, missed leads, slow replies</b></>
                )}
              </p>
              <ul className="u-feats">
                <li>
                  <span className="u-ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  {l(bi("Handle more customer conversations at once", "同时处理更多客户对话"))}
                </li>
                <li>
                  <span className="u-ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  {l(bi("Stop missing leads and slow replies", "避免漏单 / 慢回复"))}
                </li>
                <li>
                  <span className="u-ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                  {l(bi("Connect any WhatsApp number", "任何 WhatsApp 号码都能接"))}
                </li>
              </ul>
              <a
                className="u-cta"
                href="https://wa.me/601112436811"
                target="_blank"
                rel="noopener noreferrer"
              >
                {l(bi("Add WhatsApp", "加 WhatsApp"))}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </a>
            </div>
          </div>
          <p className="u-combine-note">
            {lang === "cn" ? (
              <>想两个一起加？直接跟客服说一声，<b>一次帮你配置好。</b></>
            ) : (
              <>Want both? Just tell support — <b>we'll set it all up in one go.</b></>
            )}
          </p>
        </div>
      </section>

      {/* ⑧ FAQ */}
      <section className="u-sec-tight">
        <div className="u-narrow">
          <h2 className="u-sec-title u-center u-display">
            {l(bi("Common questions", "常见问题"))}
          </h2>
          {!hideSubtitles && (
            <p className="u-sec-sub u-center">
              {l(bi("What you might want to know before upgrading", "升级前你可能想知道的"))}
            </p>
          )}
          <div className="u-faq-list">
            {faqs.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={i} className={`u-faq-item u-card${open ? " u-active" : ""}`}>
                  <button
                    className="u-faq-q"
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    <span>{l(item.q)}</span>
                    <span className="u-faq-ic">
                      <span className="u-i-plus"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg></span>
                      <span className="u-i-minus"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg></span>
                    </span>
                  </button>
                  <div className="u-faq-a">{item.a[lang]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ⑨ 最终 CTA / FINAL CTA
          The design's trailing <footer> is intentionally not reproduced — the
          page uses the shared Playbook footer from Layout. */}
      <section className="u-sec-tight">
        <div className="u-wrap">
          <div className="u-card u-final">
            <div className="u-topbar" />
            <span className="u-badge">{l(bi("✦ For power users", "✦ 进阶用户选择"))}</span>
            <h2 className="u-display">{l(bi("The real way to scale", "真正放大业务的方法"))}</h2>
            <div className="u-formula">
              {l(bi(
                "More clients (add accounts) + faster closing (add WhatsApp) = amplified revenue",
                "更多客户（加账号）＋ 更快成交（加 WhatsApp）＝ 收入放大"
              ))}
            </div>
            <a
              className="u-cta u-lg"
              href="https://wa.me/601112436811"
              target="_blank"
              rel="noopener noreferrer"
            >
              {l(bi("Message support to upgrade", "立即联系客服升级"))}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </a>
            <p className="u-under">
              {l(bi(
                "Tap to WhatsApp us — setup and onboarding done within two days",
                "点击直接 WhatsApp 找我们，两天内帮你 Set Up + Onboard"
              ))}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Upgrade;
