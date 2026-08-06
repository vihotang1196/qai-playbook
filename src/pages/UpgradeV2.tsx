import "@/styles/upgrade.css";
import { useLang } from "@/i18n/LanguageContext";

/**
 * /upgrade-v2 — redesign SKELETON (structure only; no real copy yet).
 *
 * Styling is fully isolated: everything lives under the top-level `.upg`
 * container and uses `u-`-prefixed classes from src/styles/upgrade.css. Nothing
 * here touches the global stylesheet or the shared shadcn UI kit, so it cannot
 * affect any other page.
 *
 * Nine sections, in the approved design order. The design's "客户见证"
 * (testimonials) block and its bespoke <footer> are intentionally omitted:
 * testimonials were dropped, and the page reuses the Playbook Layout footer.
 *
 * Each section is an empty placeholder — a single title so the next step can
 * locate positions by eye. Real content is filled in later.
 */
const UpgradeV2 = () => {
  const { lang } = useLang();
  const t = (cn: string, en: string) => (lang === "cn" ? cn : en);

  return (
    <div className="upg">
      {/* ① HERO */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{t("① Hero", "① Hero")}</h2>
        </div>
      </section>

      {/* ② 痛点 / PAIN */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{t("② 痛点", "② Pain points")}</h2>
        </div>
      </section>

      {/* ③ 开店比喻 / WHAT IT IS */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{t("③ 开店比喻", "③ Store analogy")}</h2>
        </div>
      </section>

      {/* ④ 三个好处 / 3 BENEFITS */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{t("④ 三个好处", "④ Three benefits")}</h2>
        </div>
      </section>

      {/* ⑤ 前后对比 / BEFORE VS AFTER */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{t("⑤ 前后对比", "⑤ Before vs after")}</h2>
        </div>
      </section>

      {/* ⑥ 哪种情况 / WHICH ONE */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{t("⑥ 哪种情况", "⑥ Which one")}</h2>
        </div>
      </section>

      {/* ⑦ 两个配套价格 / PLANS & PRICING */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{t("⑦ 两个配套价格", "⑦ Plans & pricing")}</h2>
        </div>
      </section>

      {/* ⑧ FAQ */}
      <section className="u-sec">
        <div className="u-narrow u-center">
          <h2 className="u-sec-title u-display">{t("⑧ FAQ", "⑧ FAQ")}</h2>
        </div>
      </section>

      {/* ⑨ 最终 CTA / FINAL CTA */}
      <section className="u-sec">
        <div className="u-wrap u-center">
          <h2 className="u-sec-title u-display">{t("⑨ 最终 CTA", "⑨ Final CTA")}</h2>
        </div>
      </section>
    </div>
  );
};

export default UpgradeV2;
