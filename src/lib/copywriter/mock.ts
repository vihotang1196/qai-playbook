import type { GenerateResult, Language, SurveyInput } from "./types";

/**
 * Phase 0 placeholder generator.
 *
 * Returns structurally-valid sample content so the survey → result flow can be
 * built and verified without a backend. Phase 1 replaces the call site with the
 * real `generate-copy` Supabase Edge Function (Claude); this file is then removed.
 *
 * The shapes here MUST match GenerateResult exactly — especially the numbered
 * "1. / 2. / 3." lists (funnel 2/4/5/8) and the "before / after" lines (funnel 6),
 * because Results.tsx splits those apart for its layout.
 */

const STAGES: Record<Language, string[]> = {
  zh: [
    "1. 注意 Attention",
    "2. 兴趣 Interest",
    "3. 欲望 Desire",
    "4. 行动 Action",
    "5. 广告上文 Top Banner",
    "6. 广告下文 Bottom Banner",
  ],
  en: ["1. Attention", "2. Interest", "3. Desire", "4. Action", "5. Top Banner", "6. Bottom Banner"],
  ms: ["1. Attention", "2. Interest", "3. Desire", "4. Action", "5. Top Banner", "6. Bottom Banner"],
};

const SECTIONS: Record<Language, string[]> = {
  zh: [
    "1. 标题 Headline",
    "2. 3大问题 3 Questions",
    "3. 共鸣 Empathy",
    "4. 3大痛点 3 Pain Points",
    "5. 3大好处 3 Benefits",
    "6. 前后对比 Before & After",
    "7. 自我介绍 About",
    "8. 3个见证 3 Testimonials",
    "9. 行动呼吁 Call to Action",
  ],
  en: [
    "1. Headline",
    "2. 3 Questions",
    "3. Empathy",
    "4. 3 Pain Points",
    "5. 3 Benefits",
    "6. Before & After",
    "7. About",
    "8. 3 Testimonials",
    "9. Call to Action",
  ],
  ms: [
    "1. Headline",
    "2. 3 Soalan",
    "3. Empati",
    "4. 3 Masalah",
    "5. 3 Manfaat",
    "6. Sebelum & Selepas",
    "7. Tentang",
    "8. 3 Testimoni",
    "9. Seruan Tindakan",
  ],
};

export function getMockResult(input: SurveyInput): GenerateResult {
  const lang: Language = input.language || "zh";
  const p = input.productName || (lang === "zh" ? "你的产品" : lang === "ms" ? "produk anda" : "your product");
  const pain = input.painPoint || (lang === "zh" ? "这个问题" : lang === "ms" ? "masalah ini" : "this problem");
  const dream = input.dream || (lang === "zh" ? "理想的结果" : lang === "ms" ? "hasil impian" : "your dream outcome");
  const price = input.price || (lang === "zh" ? "限时优惠价" : lang === "ms" ? "harga istimewa" : "a special price");
  const cta = input.cta;
  const stage = STAGES[lang];
  const section = SECTIONS[lang];

  if (lang === "en") {
    return {
      language: lang,
      adScript: {
        segments: [
          { stage: stage[0], content: `[SAMPLE] Still struggling with "${pain}"? Wait — don't scroll away just yet 👀` },
          { stage: stage[1], content: `${p} turns "${dream}" into your everyday reality — with a simple method loved by Malaysians.` },
          { stage: stage[2], content: `Imagine ${dream}. Not a fantasy anymore. ${p} makes the change visible and real 💪` },
          { stage: stage[3], content: `Act now — ${price}. Tap below and ${cta || "message us"} today!` },
          { stage: stage[4], content: `${p} — your change starts today` },
          { stage: stage[5], content: "Limited slots · don't miss out" },
        ],
      },
      adCopy: `[SAMPLE CAPTION]\n\nTired of "${pain}"? 😩\n\nYou're not alone — and ${p} was built exactly for this.\n\n✅ Simple to follow\n✅ Localized for Malaysia\n✅ Real results, real support\n\n${price} 🔥\n\n👉 ${cta || "Message us"} now — your future self will thank you.`,
      funnel: [
        { section: section[0], content: `${p}\n${dream} — easier than you think` },
        { section: section[1], content: "1. Have you tried everything and still seen no results?\n2. Do you feel short on time and direction?\n3. What if you were just one right system away?" },
        { section: section[2], content: "We get it. You've spent money, time and energy — and still feel stuck. That frustration is real, and it's not your fault." },
        { section: section[3], content: `1. ${pain}\n2. Spent money and time with nothing to show\n3. No one reliable to guide you` },
        { section: section[4], content: "1. Save time — just follow the steps\n2. Localized for the Malaysian market\n3. Results, confidence and community support" },
        { section: section[5], content: "Before: Busy all day, still no progress.\nAfter: A clear system, and finally — your dream outcome." },
        { section: section[6], content: `We're the team behind ${p}. We've helped hundreds of Malaysian business owners get unstuck and grow with confidence.` },
        { section: section[7], content: '[Sample testimonial — please replace with real customer feedback]\n1. "Two weeks in, my enquiries doubled!" — Sarah, KL\n2. "Finally stopped guessing on my own." — Ahmad, Penang\n3. "Paid for itself faster than I expected." — Michelle, JB' },
        { section: section[8], content: `Stop waiting. ${cta || "Message us"} now and take the first step toward ${dream}!` },
      ],
      automationMessages: {
        whatsapp: {
          greeting: `Hi! 👋 Thanks for signing up for ${p}. We're excited to have you — reply here anytime if you have questions!`,
          dayBefore: `Hey! Just a friendly reminder — it's happening tomorrow 📅 Get ready, see you soon!`,
          currentDay: `It's today! 🎉 Don't miss it — tap the link and let's go 🚀`,
        },
        email: {
          greeting: { subject: `Welcome to ${p} 🎉`, body: `Hi there,\n\nThanks for signing up for ${p}!\n\nWe're thrilled to have you on board. Keep an eye on your inbox for what's next.\n\nTalk soon,\nThe QAI Team` },
          dayBefore: { subject: "See you tomorrow 📅", body: `Hi,\n\nQuick reminder — it all happens tomorrow.\n\nMake sure you're ready. We can't wait to see you there.\n\nThe QAI Team` },
          currentDay: { subject: "It's today! 🚀", body: `Hi,\n\nToday's the day!\n\nTap the link and join us. See you inside.\n\nThe QAI Team` },
        },
      },
    };
  }

  if (lang === "ms") {
    return {
      language: lang,
      adScript: {
        segments: [
          { stage: stage[0], content: `[CONTOH] Masih bergelut dengan "${pain}"? Jangan scroll dulu ya 👀` },
          { stage: stage[1], content: `${p} tukar "${dream}" jadi realiti harian anda — dengan kaedah mudah yang disukai rakyat Malaysia.` },
          { stage: stage[2], content: `Bayangkan ${dream}. Bukan angan-angan lagi. ${p} buat perubahan nampak & terasa 💪` },
          { stage: stage[3], content: `Bertindak sekarang — ${price}. Tekan di bawah dan ${cta || "DM kami"} hari ini!` },
          { stage: stage[4], content: `${p} — perubahan bermula hari ini` },
          { stage: stage[5], content: "Slot terhad · jangan lepaskan" },
        ],
      },
      adCopy: `[CONTOH CAPTION]\n\nPenat dengan "${pain}"? 😩\n\nAnda tak keseorangan — ${p} memang dibina untuk ini.\n\n✅ Mudah diikut\n✅ Disesuaikan untuk Malaysia\n✅ Hasil sebenar, sokongan sebenar\n\n${price} 🔥\n\n👉 ${cta || "DM kami"} sekarang.`,
      funnel: [
        { section: section[0], content: `${p}\n${dream} — lebih mudah dari yang anda sangka` },
        { section: section[1], content: "1. Dah cuba macam-macam tapi masih tak nampak hasil?\n2. Rasa tak cukup masa dan hala tuju?\n3. Macam mana kalau anda cuma perlukan satu sistem yang betul?" },
        { section: section[2], content: "Kami faham. Anda dah habiskan duit, masa dan tenaga — tapi masih rasa buntu. Kekecewaan itu nyata, dan ia bukan salah anda." },
        { section: section[3], content: `1. ${pain}\n2. Habis duit & masa tapi tiada hasil\n3. Tiada orang yang boleh dipercayai untuk membimbing` },
        { section: section[4], content: "1. Jimat masa — ikut langkah sahaja\n2. Disesuaikan untuk pasaran Malaysia\n3. Hasil, keyakinan & sokongan komuniti" },
        { section: section[5], content: "Sebelum: Sibuk sepanjang hari, masih tiada kemajuan.\nSelepas: Sistem yang jelas, dan akhirnya — hasil impian anda." },
        { section: section[6], content: `Kami pasukan di sebalik ${p}. Kami dah bantu ratusan usahawan Malaysia keluar dari kebuntuan dan berkembang dengan yakin.` },
        { section: section[7], content: '[Testimoni contoh — sila gantikan dengan maklum balas pelanggan sebenar]\n1. "Dua minggu, pertanyaan saya berganda!" — Sarah, KL\n2. "Akhirnya tak teraba-raba sendiri." — Ahmad, Penang\n3. "Balik modal lebih cepat dari jangkaan." — Michelle, JB' },
        { section: section[8], content: `Jangan tunggu lagi. ${cta || "DM kami"} sekarang dan ambil langkah pertama ke arah ${dream}!` },
      ],
      automationMessages: {
        whatsapp: {
          greeting: `Hai! 👋 Terima kasih daftar untuk ${p}. Kami teruja! Balas di sini bila-bila ada soalan.`,
          dayBefore: `Hai! Peringatan mesra — esok harinya 📅 Bersedia ya, jumpa tak lama lagi!`,
          currentDay: `Hari ini harinya! 🎉 Jangan lepaskan — tekan pautan, jom! 🚀`,
        },
        email: {
          greeting: { subject: `Selamat datang ke ${p} 🎉`, body: `Hai,\n\nTerima kasih daftar untuk ${p}!\n\nKami gembira anda sertai kami. Pantau inbox anda untuk langkah seterusnya.\n\nJumpa lagi,\nPasukan QAI` },
          dayBefore: { subject: "Jumpa esok 📅", body: `Hai,\n\nPeringatan ringkas — semuanya berlaku esok.\n\nPastikan anda bersedia. Kami tak sabar jumpa anda.\n\nPasukan QAI` },
          currentDay: { subject: "Hari ini! 🚀", body: `Hai,\n\nHari ini harinya!\n\nTekan pautan dan sertai kami. Jumpa di dalam.\n\nPasukan QAI` },
        },
      },
    };
  }

  // zh (default)
  return {
    language: lang,
    adScript: {
      segments: [
        { stage: stage[0], content: `【示范文案】还在为「${pain}」发愁吗？先别急着划走 👀` },
        { stage: stage[1], content: `${p} 用一个简单的方法，帮你把「${dream}」变成日常。已经有很多马来西亚朋友试过了 ✨` },
        { stage: stage[2], content: `想象一下：${dream}——不再是空想。${p} 让改变看得见、感受得到 💪` },
        { stage: stage[3], content: `现在就行动！${price}。点击下方，马上「${cta || "私讯我们"}」！` },
        { stage: stage[4], content: `${p}，改变从今天开始` },
        { stage: stage[5], content: "名额有限 · 手慢无" },
      ],
    },
    adCopy: `【示范 Caption】\n\n还在被「${pain}」困住吗？😩\n\n你不是一个人——${p} 就是为此而生。\n\n✅ 跟着做就好，简单不费脑\n✅ 本地化方案，贴近马来西亚市场\n✅ 有成果、有支持\n\n${price} 🔥\n\n👉 现在就「${cta || "私讯我们"}」，未来的你会感谢现在的决定。`,
    funnel: [
      { section: section[0], content: `${p}\n${dream}，比你想的更简单` },
      { section: section[1], content: "1. 你是不是也试过很多方法却没效果？\n2. 是不是常常没时间、没头绪？\n3. 有没有想过，其实只差一个对的系统？" },
      { section: section[2], content: "我们懂。你花了钱、花了时间、也花了心力，却还是卡在原地。那份挫折是真实的，而且这不是你的错。" },
      { section: section[3], content: `1. ${pain}\n2. 花了钱花了时间，却看不到结果\n3. 身边没人能给到靠谱的指导` },
      { section: section[4], content: "1. 省时省力，跟着做就好\n2. 本地化方案，贴近马来西亚市场\n3. 有成果、有信心、有社群支持" },
      { section: section[5], content: "之前：每天忙到崩溃，还是没进展。\n之后：流程清晰，终于迎来理想的结果。" },
      { section: section[6], content: `我们是 ${p} 背后的团队，已经帮助数百位马来西亚创业者走出瓶颈、自信成长。` },
      { section: section[7], content: '【示范见证，请替换为真实客户反馈】\n1. "用了两周，咨询量翻倍！" —— Sarah, KL\n2. "终于不用自己瞎摸索了。" —— Ahmad, Penang\n3. "回本比我想的快。" —— Michelle, JB' },
      { section: section[8], content: `别再等了。现在就「${cta || "私讯我们"}」，迈出通往「${dream}」的第一步！` },
    ],
    automationMessages: {
      whatsapp: {
        greeting: `你好！👋 感谢你报名 ${p}。很高兴有你加入——有任何问题随时回复我们哦！`,
        dayBefore: `嗨！温馨提醒——就在明天啦 📅 记得准备好，我们不见不散！`,
        currentDay: `就是今天！🎉 别错过——点击链接，我们开始吧 🚀`,
      },
      email: {
        greeting: { subject: `欢迎加入 ${p} 🎉`, body: `你好，\n\n感谢你报名 ${p}！\n\n很高兴有你同行。请留意接下来的通知。\n\n期待与你相见，\nQAI 团队` },
        dayBefore: { subject: "明天见 📅", body: `你好，\n\n简单提醒——一切就在明天。\n\n记得准备好，我们非常期待与你相见。\n\nQAI 团队` },
        currentDay: { subject: "就是今天！🚀", body: `你好，\n\n今天就是大日子！\n\n点击链接加入我们，内场见。\n\nQAI 团队` },
      },
    },
  };
}
