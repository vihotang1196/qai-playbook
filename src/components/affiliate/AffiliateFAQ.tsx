import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const faqs = [
  { q: bi("Do I need experience?", "我需要经验吗？"), a: bi("Not at all. The system is built for complete beginners. We provide step-by-step guidance and the AI handles the complex parts like follow-ups and lead nurturing.", "完全不需要。系统专为零基础新手打造。我们提供逐步指导，AI 处理跟进和客户培育等复杂环节。") },
  { q: bi("How fast can I earn?", "多快可以赚积分？"), a: bi("Most users start earning their first credits within 2-4 weeks. Results depend on your effort and consistency, but the AI significantly accelerates the process.", "大多数用户在 2-4 周内获得首批积分。结果取决于你的努力和持续性，但 AI 大幅加速了整个过程。") },
  { q: bi("Is this beginner-friendly?", "这适合新手吗？"), a: bi("Absolutely. Everything is set up for you — from the AI automation to the marketing templates. You just need to follow the system.", "当然。一切都为你准备好了 — 从 AI 自动化到营销模板。你只需跟着系统走。") },
  { q: bi("Do I need to show my face?", "我需要露脸吗？"), a: bi("No. The system works behind the scenes. You don't need to create content, go live, or show your face. AI does the communication for you.", "不需要。系统在幕后运作。你不需要创建内容、直播或露脸。AI 为你处理沟通。") },
  { q: bi("What makes this different from other affiliate programs?", "这和其他联盟计划有什么不同？"), a: bi("Most programs give you a link and wish you luck. We give you an entire AI-powered system that attracts, follows up, and converts leads automatically.", "大多数计划给你一个链接就祝你好运。我们给你一整套 AI 驱动的系统，自动吸引、跟进和转化线索。") },
];

const AffiliateFAQ = () => {
  const { lang } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];

  return (
    <section className="py-20">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{l(bi("Frequently Asked Questions", "常见问题"))}</h2>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-4">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                {l(f.q)}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {l(f.a)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default AffiliateFAQ;
