import "@/styles/upgrade.css";
import { useLang } from "@/i18n/LanguageContext";

// Same bilingual pattern as src/components/upgrade/UpgradeHero.tsx:
// bi(en, cn) builds a bilingual string, l() picks the current language.
type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

/**
 * /upgrade-v2 — redesign in progress.
 *
 * Styling is fully isolated: everything lives under the top-level `.upg`
 * container and uses `u-`-prefixed classes from src/styles/upgrade.css. Nothing
 * here touches the global stylesheet or the shared shadcn UI kit, so it cannot
 * affect any other page.
 *
 * Nine sections, in the approved design order. Sections ③–⑨ are still empty
 * placeholders — filled in incrementally. The design's "客户见证" (testimonials)
 * block and its bespoke <footer> are intentionally omitted: testimonials were
 * dropped, and the page reuses the Playbook Layout footer.
 */
const UpgradeV2 = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (b: Bi) => b[lang];

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
          <div className="u-sec-sub u-center">&nbsp;</div>
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
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{l(bi("⑥ Which one", "⑥ 哪种情况"))}</h2>
        </div>
      </section>

      {/* ⑦ 两个配套价格 / PLANS & PRICING */}
      <section className="u-sec" id="plans">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{l(bi("⑦ Plans & pricing", "⑦ 两个配套价格"))}</h2>
        </div>
      </section>

      {/* ⑧ FAQ */}
      <section className="u-sec">
        <div className="u-narrow u-center">
          <h2 className="u-sec-title u-display">{l(bi("⑧ FAQ", "⑧ FAQ"))}</h2>
        </div>
      </section>

      {/* ⑨ 最终 CTA / FINAL CTA */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{l(bi("⑨ Final CTA", "⑨ 最终 CTA"))}</h2>
        </div>
      </section>
    </div>
  );
};

export default UpgradeV2;
