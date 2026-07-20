import { Megaphone } from "lucide-react";

/**
 * 产品更新 tab — placeholder for now. Real content (published hd_updates posts)
 * lands in P8; this just shows a friendly "coming soon" so the third tab exists
 * and the layout is complete.
 */
export default function HelpUpdates({ lang }: { lang: "cn" | "en" }) {
  return (
    <div className="glass-card rounded-2xl p-10 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white"
        style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
      >
        <Megaphone className="w-6 h-6" />
      </div>
      <h3 className="font-display font-semibold mb-1">{lang === "cn" ? "产品更新" : "Product updates"}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        {lang === "cn"
          ? "这里将发布产品的最新功能和改进。敬请期待。"
          : "The latest features and improvements will be posted here. Stay tuned."}
      </p>
    </div>
  );
}
