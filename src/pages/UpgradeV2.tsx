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
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{l(bi("③ Store analogy", "③ 开店比喻"))}</h2>
        </div>
      </section>

      {/* ④ 三个好处 / 3 BENEFITS */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{l(bi("④ Three benefits", "④ 三个好处"))}</h2>
        </div>
      </section>

      {/* ⑤ 前后对比 / BEFORE VS AFTER */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{l(bi("⑤ Before vs after", "⑤ 前后对比"))}</h2>
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
