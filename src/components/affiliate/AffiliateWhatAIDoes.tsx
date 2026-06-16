import { MessageSquare, Clock, Heart, ShieldCheck } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const features = [
  { icon: MessageSquare, title: bi("Auto Reply to Leads", "自动回复线索"), desc: bi("Instantly respond to every inquiry — no lead left behind", "即时回复每个咨询 — 不遗漏任何线索") },
  { icon: Clock, title: bi("Follow Up 24/7", "全天候跟进"), desc: bi("AI works around the clock so you don't have to", "AI 全天候工作，你不必亲自动手") },
  { icon: Heart, title: bi("Nurture Prospects", "培育潜在客户"), desc: bi("Build trust and interest automatically over time", "随时间自动建立信任和兴趣") },
  { icon: ShieldCheck, title: bi("Help Close Sales", "协助成交"), desc: bi("Guide prospects to purchase with smart conversations", "通过智能对话引导客户购买") },
];

const AffiliateWhatAIDoes = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];

  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{l(bi("Let The AI Do The Work For You", "让 AI 为你工作"))}</h2>
          {!hideSubtitles && <p className="text-muted-foreground">{l(bi("You focus on growth. AI handles the rest.", "你专注增长，AI 处理其余。"))}</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div key={f.title.en} className="flex gap-4 p-5 rounded-2xl border hover:shadow-md transition-shadow duration-300">
              <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                <f.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{l(f.title)}</h3>
                {!hideSubtitles && <p className="text-sm text-muted-foreground">{l(f.desc)}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AffiliateWhatAIDoes;
