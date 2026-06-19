import { Star } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const testimonials = [
  {
    name: "Ahmad R.",
    role: bi("Part-time affiliate", "兼职伙伴"),
    quote: bi("I earned my first 4,000 credits in the second month. The AI follow-up is a game changer.", "第二个月就赚了 4,000 积分。AI 跟进功能太厉害了。"),
    income: "4,000 Credits/mo",
  },
  {
    name: "Sarah L.",
    role: bi("Full-time marketer", "全职营销员"),
    quote: bi("I used to spend hours replying to leads. Now AI does it and I focus on scaling.", "以前花几个小时回复线索，现在 AI 搞定，我专注扩展。"),
    income: "17,000 Credits/mo",
  },
  {
    name: "David T.",
    role: bi("Agency owner", "代理老板"),
    quote: bi("Running 4 accounts now. This system basically runs my agency for me.", "现在运营 4 个账号，系统基本上帮我运营整个代理。"),
    income: "30,000 Credits/mo",
  },
];

const AffiliateSocialProof = () => {
  const { lang } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];

  return (
    <section className="py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{l(bi("Real Results From Users", "用户的真实成果"))}</h2>
          <p className="text-muted-foreground">{l(bi("See what people are achieving with the system", "看看大家用这个系统取得了什么成果"))}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-2xl border bg-card p-6 space-y-4">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-sm leading-relaxed">"{l(t.quote)}"</p>
              <div className="flex items-center justify-between pt-3 border-t">
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{l(t.role)}</div>
                </div>
                <div className="text-sm font-bold text-green-600">{t.income}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AffiliateSocialProof;
