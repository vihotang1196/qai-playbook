// Review Boost platform registry — the review destinations a sub-account can
// enable. Matches what the Lovable original actually shipped (Google/FB/Shopee
// + a Custom URL). Links only; business info lives on the campaign (Option B).

export type RBPlatform = {
  id: string; // stored in rb_platform_integrations.platform
  label: { cn: string; en: string };
  color: string; // legacy field; monogram tiles now render ink+yellow (Brutalist rebrand), no longer per-platform brand colour
  placeholder: string;
};

export const RB_PLATFORMS: RBPlatform[] = [
  {
    id: "google_maps",
    label: { cn: "Google Maps", en: "Google Maps" },
    color: "#141414",
    placeholder: "https://g.page/r/…/review",
  },
  {
    id: "facebook",
    label: { cn: "Facebook", en: "Facebook" },
    color: "#141414",
    placeholder: "https://facebook.com/你的主页/reviews",
  },
  {
    id: "shopee",
    label: { cn: "Shopee", en: "Shopee" },
    color: "#141414",
    placeholder: "https://shopee.com.my/你的店铺",
  },
  {
    id: "custom",
    label: { cn: "自定义链接", en: "Custom URL" },
    color: "#141414",
    placeholder: "https://your-site.com/reviews",
  },
];
