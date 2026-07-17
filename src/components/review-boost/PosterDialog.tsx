import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Loader2, Download, QrCode as QrIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLang } from "@/i18n/LanguageContext";
import QrWithLogo from "./QrWithLogo";
import { getPosterSpec, POSTER_SIZES, type PosterSize } from "@/lib/review-boost/poster";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scanUrl: string;
  businessName: string | null;
  campaignName: string;
  logoUrl: string | null;
  platform: string; // google_maps | facebook | shopee | custom
};

const PREVIEW_W = 300; // on-screen preview width (poster renders full-size off-view)

function safeName(s: string): string {
  return (s || "poster").replace(/[^\w一-龥-]+/g, "_").slice(0, 40);
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function PosterDialog({
  open,
  onOpenChange,
  scanUrl,
  businessName,
  campaignName,
  logoUrl,
  platform,
}: Props) {
  const { lang } = useLang();
  const label = (cn: string, en: string) => (lang === "cn" ? cn : en);
  const spec = getPosterSpec(platform);

  const [sizeId, setSizeId] = useState<PosterSize["id"]>("a4");
  const [promo, setPromo] = useState("");
  const [downloading, setDownloading] = useState<"poster" | "qr" | null>(null);

  const posterRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const size = POSTER_SIZES.find((s) => s.id === sizeId)!;
  const W = size.width;
  const H = size.height;
  const previewScale = PREVIEW_W / W;
  const biz = (businessName || "").trim();

  const downloadPoster = async () => {
    if (!posterRef.current) return;
    setDownloading("poster");
    try {
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: size.exportScale,
        cacheBust: true,
        backgroundColor: "#ffffff",
        // Poster uses a system font stack (Noto Sans SC / system-ui). Supplying an
        // empty fontEmbedCSS makes html-to-image skip computing web-font CSS, so it
        // never reads the app's cross-origin Google Fonts stylesheet (that read is
        // blocked and would spam the console). Output is unaffected.
        skipFonts: true,
        fontEmbedCSS: "",
      });
      triggerDownload(dataUrl, `haibao-${safeName(campaignName)}-${sizeId}.png`);
      toast.success(label("已生成海报 PNG", "Poster PNG ready"));
    } catch {
      toast.error(label("导出失败——若用了 logo 可能是图片跨域，先去掉 logo 再试", "Export failed — if a logo is set it may be a cross-origin image; try without it"));
    } finally {
      setDownloading(null);
    }
  };

  const downloadQr = async () => {
    if (!qrRef.current) return;
    setDownloading("qr");
    try {
      const dataUrl = await toPng(qrRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#ffffff", skipFonts: true, fontEmbedCSS: "" });
      triggerDownload(dataUrl, `qr-${safeName(campaignName)}.png`);
      toast.success(label("已生成二维码 PNG", "QR PNG ready"));
    } catch {
      toast.error(label("导出失败，请再试一次", "Export failed — please try again"));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrIcon className="w-5 h-5 text-primary" />
            {label("二维码海报", "QR poster")}
          </DialogTitle>
          <DialogDescription>
            {label(
              "生成可打印的海报贴在店里。请在正式网址上生成，二维码才指向线上。",
              "A printable poster for your shop. Generate it on the live site so the QR points to production.",
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Size switch */}
        <div className="flex gap-2">
          {POSTER_SIZES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSizeId(s.id)}
              className={`flex-1 rounded-xl px-2 py-2 text-xs font-medium border transition-colors ${
                sizeId === s.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {s.label[lang]}
            </button>
          ))}
        </div>

        {/* Optional promo line */}
        <div>
          <label className="block text-xs font-medium mb-1">{label("优惠 / 号召语（选填，会印在海报上）", "Promo / call-to-action (optional, shown on poster)")}</label>
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            maxLength={40}
            placeholder={label("例如：留评价送饮料 🎁", "e.g. Leave a review, get a free drink 🎁")}
            className="glass-input w-full px-3 py-2 text-sm"
          />
        </div>

        {/* Preview (scaled) */}
        <div className="flex justify-center">
          <div style={{ width: PREVIEW_W, height: H * previewScale, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
              }}
            >
              <Poster
                nodeRef={posterRef}
                spec={spec}
                W={W}
                H={H}
                biz={biz}
                logoUrl={logoUrl}
                scanUrl={scanUrl}
                promo={promo.trim()}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={downloadPoster}
            disabled={downloading !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            {downloading === "poster" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {label(`下载海报 PNG（${size.label.cn}）`, `Download poster PNG (${size.label.en})`)}
          </button>
          <button
            onClick={downloadQr}
            disabled={downloading !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border border-border/60 hover:border-border disabled:opacity-70"
          >
            {downloading === "qr" ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrIcon className="w-4 h-4" />}
            {label("只下载纯二维码 PNG", "Download bare QR PNG")}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            {label("iPhone 若是新标签打开图片，长按即可保存。", "On iPhone, if the image opens in a new tab, long-press to save it.")}
          </p>
        </div>

        {/* Hidden full-size bare QR for the bare-QR export */}
        <div style={{ position: "absolute", left: -99999, top: 0 }} aria-hidden>
          <div ref={qrRef} style={{ background: "#ffffff", padding: 48, display: "inline-block" }}>
            <QrWithLogo value={scanUrl} size={480} logoUrl={logoUrl} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The printable poster itself, rendered at full CSS-pixel size (W×H). */
function Poster({
  nodeRef,
  spec,
  W,
  H,
  biz,
  logoUrl,
  scanUrl,
  promo,
}: {
  nodeRef: React.Ref<HTMLDivElement>;
  spec: ReturnType<typeof getPosterSpec>;
  W: number;
  H: number;
  biz: string;
  logoUrl: string | null;
  scanUrl: string;
  promo: string;
}) {
  const headlineCn = biz ? `喜欢${biz}吗？` : "喜欢我们的服务吗？";
  const headlineEn = biz ? `Enjoyed ${biz}?` : "Enjoyed your visit?";
  const qrSize = Math.round(W * 0.44);

  return (
    <div
      ref={nodeRef}
      style={{
        width: W,
        height: H,
        background: `linear-gradient(160deg, ${spec.primarySoft}, #ffffff 60%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: W * 0.09,
        boxSizing: "border-box",
        fontFamily: "'Noto Sans SC', system-ui, sans-serif",
        textAlign: "center",
        gap: W * 0.03,
      }}
    >
      <div style={{ fontSize: W * 0.09, lineHeight: 1 }}>{spec.motif}</div>

      <div>
        <div style={{ fontSize: W * 0.06, fontWeight: 800, color: "#1a1a2e", lineHeight: 1.2 }}>{headlineCn}</div>
        <div style={{ fontSize: W * 0.036, fontWeight: 600, color: "#5a5a72", marginTop: W * 0.005 }}>{headlineEn}</div>
      </div>

      <div style={{ fontSize: W * 0.075, color: spec.star, letterSpacing: W * 0.008 }}>★★★★★</div>

      {/* QR card */}
      <div
        style={{
          background: "#ffffff",
          padding: W * 0.04,
          borderRadius: W * 0.04,
          boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
        }}
      >
        <QrWithLogo value={scanUrl} size={qrSize} logoUrl={logoUrl} />
      </div>

      <div>
        <div style={{ fontSize: W * 0.042, fontWeight: 700, color: "#1a1a2e" }}>扫码给我们留下五星好评</div>
        <div style={{ fontSize: W * 0.03, fontWeight: 500, color: "#5a5a72", marginTop: W * 0.004 }}>
          Scan to leave us a 5-star review
        </div>
      </div>

      {promo ? (
        <div
          style={{
            background: spec.primary,
            color: "#ffffff",
            fontSize: W * 0.034,
            fontWeight: 700,
            padding: `${W * 0.018}px ${W * 0.05}px`,
            borderRadius: 999,
          }}
        >
          {promo}
        </div>
      ) : null}

      <div
        style={{
          fontSize: W * 0.03,
          fontWeight: 700,
          color: spec.primary,
          background: "#ffffff",
          border: `2px solid ${spec.primary}`,
          padding: `${W * 0.012}px ${W * 0.04}px`,
          borderRadius: 999,
        }}
      >
        {spec.name.cn} · {spec.name.en}
      </div>

      <div style={{ fontSize: W * 0.022, color: "#9a9ab0", marginTop: W * 0.01 }}>Powered by QiAi</div>
    </div>
  );
}
