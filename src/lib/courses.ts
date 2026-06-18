// Single source of truth for the Course Hub video courses.
//
// Data was consolidated here from the 4 per-course popout components
// (AdsDesignPopout / AdsSettingsPopout / ClosingStrategyPopout /
// CopywritingPopout). The new <CoursePlayer> reads from this file so the
// curriculum lives in one place instead of being duplicated per component.
//
// Note: this is intentionally separate from src/lib/coaching.ts — that file
// holds Coaching Night replays, which are a different kind of content.

export interface CourseVideo {
  title: string;
  url: string;
}

export interface CoursePart {
  /** e.g. "PART 1" */
  part: string;
  /** module title, e.g. "广告推广类型" */
  title: string;
  videos: CourseVideo[];
}

export interface Course {
  /** stable slug, used for keys */
  id: string;
  /** bilingual course title (matches the Course Hub cards) */
  title: { cn: string; en: string };
  /** cover image (same asset used on the Course Hub card) */
  cover: string;
  curriculum: CoursePart[];
}

export const courses: Course[] = [
  {
    id: "ad-design",
    title: { cn: "广告设计", en: "Ad Design" },
    cover: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6ab3dac58434d5e1ff3d.png",
    curriculum: [
      {
        part: "PART 1",
        title: "广告推广类型",
        videos: [
          { title: "广告设计/ Video 须知的「3大推广类型」", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fadac5846c5abeb9bd.mp4" },
          { title: "广告设计与制作 - 【内容】推广型", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa45e39ca7e342eea5.mp4" },
          { title: "广告设计与制作 - 【广告】推广型 Part 1", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa2c8d9ba034404543.mp4" },
          { title: "广告设计与制作 - 【广告】推广型 Part 2", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fadac584590ebeb9bb.mp4" },
          { title: "广告设计与制作 - 【见证】推广型", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fb15872b62bfaf82c0.mp4" },
        ],
      },
      {
        part: "PART 2",
        title: "广告视觉设计",
        videos: [
          { title: "广告懒人包图 vs 短视频", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fad3a72b670d137c08.mp4" },
          { title: "如何把文案快速变成视觉性营销？", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa45e39c4b1242eea6.mp4" },
          { title: "广告设计图的五大构成方式", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fadac5845565beb9be.mp4" },
        ],
      },
      {
        part: "PART 3",
        title: "短视频脚本制作",
        videos: [
          { title: "如何制作出一个受众群一看就看到完的短视频 Video？", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa496a574af9694c06.mp4" },
          { title: "Video Script 案例 - 短视频广告", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fb15872b623baf82e1.mp4" },
          { title: "Video Script 案例 - 短视频广告 Part 2", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fb15872bbcabaf82c2.mp4" },
          { title: "Video Script 案例 - 短视频见证", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fad3a72bfd12137c03.mp4" },
        ],
      },
      {
        part: "PART 4",
        title: "短视频留存技巧",
        videos: [
          { title: '如何不让你的短视频被"划走"？记住这10秒法则', url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fadac584eba5beb9bc.mp4" },
          { title: '如何在内容打造出短视频"记忆点"', url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa496a57853d694c05.mp4" },
          { title: "必懂！短视频后期剪辑的小技巧与准则", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fad3a72bdcfa137c04.mp4" },
        ],
      },
      {
        part: "PART 5",
        title: "Canva 设计工具",
        videos: [
          { title: "零压力的设计神器 - 6分钟学会Canva免费图片制作基础工具", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb64b7a37cc23d40f448a5.mp4" },
          { title: "零压力的设计神器 - Canva 基础简介", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb653b53d4f14debbbb599.mp4" },
          { title: "Canva 设计神器 - Step-by-step Demo", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb653bd3a72b3c35376893.mp4" },
        ],
      },
    ],
  },
  {
    id: "ad-setup",
    title: { cn: "广告设置", en: "Ad Setup" },
    cover: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6abc3147fdd3fd4ebdef.png",
    curriculum: [
      {
        part: "PART 1",
        title: "广告基础设定",
        videos: [
          { title: "为什么要花钱打广告?", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa2c8d9b36ef404542.mp4" },
          { title: "广告设定基础", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa45e39c492242eea2.mp4" },
          { title: "6个 广告目标 - Facebook Ads Campaign", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fadac584d63ebeb9b6.mp4" },
          { title: "广告实际操作", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fb15872b70f6af82c1.mp4" },
        ],
      },
      {
        part: "PART 2",
        title: "广告指标与管理",
        videos: [
          { title: "广告使用者 vs 购买者", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa2c8d9b3541404541.mp4" },
          { title: "广告指标 - 知道你花的钱去了哪里", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fad3a72bf678137bff.mp4" },
          { title: "广告指标 Table", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fb15872bd739af82a7.mp4" },
          { title: "Facebook 广告出了问题 中 BANNED 要找谁？", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa45e39c345442eea3.mp4" },
        ],
      },
      {
        part: "PART 3",
        title: "广告扩量与再营销",
        videos: [
          { title: "广告设置 Scaling 四部曲：A/B Test & CBO", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa45e39cb36342eea4.mp4" },
          { title: "学会用 Retargeting Ads 做二次营销 获取最大的再次营销效益", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fadac5841c3abeb9b5.mp4" },
          { title: "如何根据你的客户列表设定相似受众群体 Lookalike Audience", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa15872b7f4baf829f.mp4" },
        ],
      },
    ],
  },
  {
    id: "closing-strategy",
    title: { cn: "成交策略", en: "Closing Strategy" },
    cover: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6ac23147fd285c4ebe99.png",
    curriculum: [
      {
        part: "PART 1",
        title: "Reply SOP 策略",
        videos: [
          { title: "Reply SOP 的目的", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770cdac584515cbebbed.mp4" },
          { title: "基础 vs 技术层面 （7大注意事项）", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770cdac58498e3bebbee.mp4" },
          { title: "【6P 策略】 Part 1", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770b45e39c08fe42f0f3.mp4" },
          { title: "【6P 策略】 Part 2", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770cd3a72bdf56137e56.mp4" },
          { title: "【6P 策略】 Part 3", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770b2c8d9b3732404791.mp4" },
        ],
      },
      {
        part: "PART 2",
        title: "Follow-up 策略",
        videos: [
          { title: "Follow-up 策略", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770cdac5847913bebbec.mp4" },
          { title: '如何 Follow-up "不紧急" 的顾客', url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770cd3a72b0ac0137e57.mp4" },
          { title: '如何 Follow "不相信" 的顾客', url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb67adaa2d29208935bb4e.mp4" },
          { title: "如何 Follow-up 价钱贵 的顾客", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770b15872b862caf8526.mp4" },
        ],
      },
      {
        part: "PART 3",
        title: "技术层面设置",
        videos: [
          { title: "技术层面 如何设置 Saved Reply", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770b2c8d9b8352404792.mp4" },
          { title: "技术层面 如何设置 ManyChat", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770c15872b7182af8527.mp4" },
          { title: "技术层面 如何设置 Auto-Reply Comment", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770c2c8d9bfe1f404794.mp4" },
        ],
      },
      {
        part: "PART 4",
        title: "总结与功课",
        videos: [
          { title: "总结回到去要做的功课", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770bd3a72b6b09137e54.mp4" },
        ],
      },
    ],
  },
  {
    id: "copywriting",
    title: { cn: "文案攻略", en: "Copywriting" },
    cover: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb99cd7e33ef7b076adef6.png",
    curriculum: [
      {
        part: "PART 1",
        title: "文案基础",
        videos: [
          { title: "如何开始才能写出一个会成交的文案？", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770bdac5848dffbebbea.mp4" },
          { title: "如何开始才能写出一个会成交的文案？", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770b45e39c9a5042f0f4.mp4" },
        ],
      },
      {
        part: "PART 2",
        title: "AIDA 公式",
        videos: [
          { title: "掌握 AIDA 公式 - Attention 引起注意", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770c799ccac97f4497c1.mp4" },
          { title: "掌握 AIDA 公式 - Interest 挖掘兴趣", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770b2c8d9b869f404790.mp4" },
          { title: "掌握 AIDA 公式 - Desire 购买渴望", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770bd3a72b18b6137e53.mp4" },
          { title: "掌握 AIDA 公式 - Action 引导购买", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770c799cca8e2b4497c2.mp4" },
        ],
      },
      {
        part: "PART 3",
        title: "案例分析与 FAB 法则",
        videos: [
          { title: "AIDA 公式 - 案例分析", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770cdac584585fbebbeb.mp4" },
          { title: "如何避免写出自嗨型文案？跟着FAB法则就对了！", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba770b2c8d9b2221404793.mp4" },
        ],
      },
    ],
  },
];
