import { Card, CardContent } from "@/components/ui/card";
import { useLang } from "@/i18n/LanguageContext";
import { X } from "lucide-react";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const pains = [
  bi("One account isn't enough (more clients / brands)", "一个账号不够用（客户 / brand 增加）"),
  bi("WhatsApp conversations are increasing", "WhatsApp 对话开始变多"),
  bi("Can't keep up with manual replies", "人工回复开始跟不上"),
  bi("Unable to scale the business", "无法 scale 业务"),
];

const CurrentLimitations = () => {
  const { lang } = useLang();
  const l = (b: Bi) => b[lang];

  return (
    <section className="max-w-3xl mx-auto px-6 mb-24">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">
          {l(bi("Problems you might be facing:", "你现在可能遇到的问题："))}
        </h2>
      </div>

      <Card className="border border-destructive/20 bg-destructive/[0.03] rounded-2xl">
        <CardContent className="p-8">
          <div className="grid sm:grid-cols-2 gap-4">
            {pains.map((p, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <X className="h-3.5 w-3.5 text-destructive" />
                </div>
                <span className="text-sm font-medium">{l(p)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default CurrentLimitations;
