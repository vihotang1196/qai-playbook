import { Badge } from "@/components/ui/badge";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const UpgradeHero = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (b: Bi) => b[lang];

  return (
    <section className="max-w-4xl mx-auto px-6 text-center mb-20">
      <Badge variant="secondary" className="mb-4 text-xs tracking-wide">
        {l(bi("For Existing Users", "现有用户专属"))}
      </Badge>
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5">
        {l(bi("Upgrade Your System, Scale Your Revenue", "升级你的系统，扩展你的收入"))}
      </h1>
      {!hideSubtitles && (
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {l(bi(
            "You're already using the system. Now it's time to scale.",
            "你已经在使用系统，现在是放大的时候"
          ))}
        </p>
      )}
    </section>
  );
};

export default UpgradeHero;
