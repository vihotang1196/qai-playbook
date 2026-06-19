import UpgradeHero from "@/components/upgrade/UpgradeHero";
import CurrentLimitations from "@/components/upgrade/CurrentLimitations";
import ExpansionCards from "@/components/upgrade/ExpansionCards";
import SmartRecommendation from "@/components/upgrade/SmartRecommendation";
import UpgradeAnalogy from "@/components/upgrade/UpgradeAnalogy";
import UpgradeCombo from "@/components/upgrade/UpgradeCombo";

const Upgrade = () => {
  return (
    <main className="pt-24 pb-20">
      <UpgradeHero />
      <CurrentLimitations />
      <ExpansionCards />
      <SmartRecommendation />
      <UpgradeAnalogy />
      <UpgradeCombo />
    </main>
  );
};

export default Upgrade;
