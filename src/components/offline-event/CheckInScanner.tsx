import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ScanLine, X, Camera, CheckCircle2, AlertTriangle, Info } from "lucide-react";

/**
 * Self-contained QR check-in scanner modal (no shadcn dep — mirrors MyBookings).
 * Opens the rear camera and reads the customer's ticket QR two ways:
 *   1. the native BarcodeDetector API (Chrome / Edge / Android), then
 *   2. a jsQR canvas fallback (iOS Safari / Firefox, where 1 is absent).
 * Plus a manual-code input that always works (camera denied / no camera).
 *
 * It is deliberately "dumb about the server": each fresh detection is handed
 * up via onScan(raw); the parent does the requireAdmin checkIn call and passes
 * the outcome back down as `feedback`, which we render as a banner while the
 * camera keeps running for the next person. Same code within 3s is de-duped so
 * one QR held up to the lens doesn't fire repeatedly.
 */
export type ScanFeedback = {
  kind: "ok" | "warn" | "error";
  title: string;
  detail?: string;
} | null;

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (raw: string) => void;
  feedback: ScanFeedback;
  eventLabel?: string;
  day: 1 | 2;
}

export default function CheckInScanner({ open, onClose, onScan, feedback, eventLabel, day }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastCodeRef = useRef<{ value: string; ts: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  // De-dupe the same QR within a 3s window, then hand fresh scans up.
  const handleDetected = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const now = Date.now();
    const last = lastCodeRef.current;
    if (last && last.value === value && now - last.ts < 3000) return;
    lastCodeRef.current = { value, ts: now };
    onScan(value);
  };

  // Camera lifecycle — only while the modal is open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    const Ctor = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
    const detector = typeof Ctor === "function" ? new Ctor({ formats: ["qr_code"] }) : null;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera-api");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          const video = videoRef.current;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              if (codes && codes.length > 0 && codes[0].rawValue) handleDetected(codes[0].rawValue);
            }
            if (ctx && video.readyState >= 2 && video.videoWidth > 0) {
              const w = video.videoWidth;
              const h = video.videoHeight;
              if (canvas.width !== w) canvas.width = w;
              if (canvas.height !== h) canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const res = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
              if (res?.data) handleDetected(res.data);
            }
          } catch {
            /* frame not ready — retry next tick */
          }
          rafRef.current = window.requestAnimationFrame(tick);
        };
        rafRef.current = window.requestAnimationFrame(tick);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        const raw = e instanceof Error ? e.message : String(e);
        setError(
          name === "NotAllowedError" || /permission/i.test(raw)
            ? "摄像头权限被拒。请在浏览器允许摄像头，或用下方手动输入报名码。"
            : name === "NotFoundError" || raw === "no-camera-api"
              ? "没有可用的摄像头。请用下方手动输入报名码。"
              : "无法打开摄像头。请用下方手动输入报名码。",
        );
      }
    };

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open]);

  if (!open) return null;

  const banner =
    feedback &&
    (feedback.kind === "ok" ? (
      <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 flex items-center gap-3" role="status" aria-live="polite">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-emerald-800 leading-tight">{feedback.title}</p>
          {feedback.detail && <p className="text-xs text-emerald-700 mt-0.5 break-all">{feedback.detail}</p>}
        </div>
      </div>
    ) : feedback.kind === "warn" ? (
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 flex items-center gap-3" role="status" aria-live="polite">
        <Info className="w-6 h-6 text-amber-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-800 leading-tight">{feedback.title}</p>
          {feedback.detail && <p className="text-xs text-amber-700 mt-0.5 break-all">{feedback.detail}</p>}
        </div>
      </div>
    ) : (
      <div className="rounded-2xl border border-red-300/60 bg-red-50 p-4 flex items-center gap-3" role="alert" aria-live="assertive">
        <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-800 leading-tight">{feedback.title}</p>
          {feedback.detail && <p className="text-xs text-red-700 mt-0.5 break-all">{feedback.detail}</p>}
        </div>
      </div>
    ));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-background shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-foreground" />
            <div>
              <p className="font-display font-bold text-sm leading-tight">扫码签到 · Day {day}</p>
              {eventLabel && <p className="text-[11px] text-muted-foreground leading-tight">{eventLabel}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {/* Camera viewport */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-8 rounded-2xl border-2 border-white/70" />
            </div>
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-black/75 text-white">
                <Camera className="w-8 h-8 mb-2 opacity-80" />
                <p className="text-xs opacity-90">{error}</p>
              </div>
            )}
          </div>

          {/* Result banner (kept below the camera so the lens stays clear) */}
          {banner}

          {/* Manual fallback — always available */}
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold text-center">
              手动输入报名码
            </p>
            <div className="flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="BK-XXXX-XXXXXX"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manual.trim()) {
                    handleDetected(manual.trim());
                    setManual("");
                  }
                }}
                className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                disabled={!manual.trim()}
                onClick={() => {
                  handleDetected(manual.trim());
                  setManual("");
                }}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
              >
                签到
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full h-10 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" /> 关闭
          </button>
        </div>
      </div>
    </div>
  );
}
