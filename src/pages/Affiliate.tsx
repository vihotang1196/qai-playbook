import { useState, useEffect } from "react";
import AffiliateHero from "@/components/affiliate/AffiliateHero";
import AffiliateProblem from "@/components/affiliate/AffiliateProblem";
import AffiliateHowItWorks from "@/components/affiliate/AffiliateHowItWorks";
import AffiliateCalculator from "@/components/affiliate/AffiliateCalculator";
import AffiliateWhoIsFor from "@/components/affiliate/AffiliateWhoIsFor";
import AffiliateWhatAIDoes from "@/components/affiliate/AffiliateWhatAIDoes";
import AffiliateWhyDifferent from "@/components/affiliate/AffiliateWhyDifferent";
import AffiliateFinalCTA from "@/components/affiliate/AffiliateFinalCTA";
import AffiliateFAQ from "@/components/affiliate/AffiliateFAQ";
import { MessageCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const Affiliate = () => {
  const [showSticky, setShowSticky] = useState(false);
  const { lang } = useLang();

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <main>
        <AffiliateHero />
        <AffiliateProblem />
        <AffiliateHowItWorks />
        <AffiliateCalculator />
        <AffiliateWhoIsFor />
        <AffiliateWhatAIDoes />
        <AffiliateWhyDifferent />
        <AffiliateFinalCTA />
        <AffiliateFAQ />
      </main>

      {showSticky && (
        <a
          href="https://wa.me/601112436811"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-accent text-accent-foreground px-5 py-3 rounded-full shadow-xl hover:scale-105 transition-transform duration-300"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-semibold">{lang === "cn" ? "立即申请" : "Apply Now"}</span>
        </a>
      )}
    </>
  );
};

export default Affiliate;
