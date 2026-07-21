import { cn } from "@/lib/utils";
import { AlertCircle, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { useRef, useState, useEffect, useMemo, memo, type PointerEvent as ReactPointerEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OeSeatGroup as SeatGroup, OeSeat as Seat } from "@/lib/offlineEvent";

// Ported verbatim (visual) from the old Lovable "offline-class" SeatMap — the
// owner will do a unified design pass later. Only change: the old app's i18n
// `t("seat.*")` keys (which don't exist in Playbook's LanguageContext) are
// inlined as `lang === "cn" ? … : …`. Read-only in P3 (no seat selection yet).

interface Props {
  seatGroups: SeatGroup[];
  selectedSeatIds: string[];
  selectedGroupId: string | null;
  onToggleSeat: (seat: Seat, groupId: string) => void;
  warning: string | null;
  /** Maximum seats the user may select in this session (per-date cap). */
  maxSelectable?: number;
  /** Grid columns for this floor plan (default 6). */
  columns?: number;
  /** Grid rows for this floor plan (default 5). */
  rows?: number;
  /** When false, hide the door pill. */
  showDoor?: boolean;
  /** Read-only mode: seats are visible but not clickable. */
  readOnly?: boolean;
}

const DEFAULT_COLS = 6;
const DEFAULT_ROWS = 5;
const CLICK_SCALE_THRESHOLD = 0.6; // below this, taps don't select seats

export function SeatMap({ seatGroups, selectedSeatIds, selectedGroupId, onToggleSeat, warning, maxSelectable = 4, columns, rows, showDoor = true, readOnly = false }: Props) {
  const { lang } = useLang();
  const isMobile = useIsMobile();
  const COLS = columns && columns > 0 ? columns : DEFAULT_COLS;
  const ROWS = rows && rows > 0 ? rows : DEFAULT_ROWS;
  const hasLongTable = useMemo(
    () => seatGroups.some((g) => g.shape === "long"),
    [seatGroups],
  );
  const colUnit = hasLongTable ? 306 : 124;
  const colGap = hasLongTable ? 60 : 40;
  const rowGap = hasLongTable ? 56 : 40;
  const CHART_WIDTH = COLS * colUnit + (COLS - 1) * colGap;
  const MOBILE_CHART_WIDTH = Math.max(600, CHART_WIDTH);

  // Pan/zoom state — only used on mobile
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [fitScale, setFitScale] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDist = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const didPan = useRef(false);
  const lastTapTime = useRef(0);
  const [activePointers, setActivePointers] = useState(0);

  useEffect(() => {
    if (!isMobile) {
      setScale(1);
      setFitScale(1);
      setTx(0);
      setTy(0);
      return;
    }
    const measure = () => {
      const w = containerRef.current?.clientWidth ?? window.innerWidth;
      const fit = Math.min(1, w / MOBILE_CHART_WIDTH);
      setFitScale(fit);
      setScale(fit);
      setTx(0);
      setTy(0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isMobile, MOBILE_CHART_WIDTH]);

  const clampScale = (s: number) => Math.max(fitScale, Math.min(3, s));
  const clickEnabled = !readOnly && (!isMobile || scale >= CLICK_SCALE_THRESHOLD);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setActivePointers(pointers.current.size);
    didPan.current = false;
    if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, tx, ty };
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        const target = scale < 1 ? Math.max(1.4, fitScale * 2.2) : Math.min(2.4, scale * 1.6);
        setScale(clampScale(target));
      }
      lastTapTime.current = now;
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      lastPinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
      dragStart.current = null;
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMobile || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && lastPinchDist.current != null) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = d / lastPinchDist.current;
      lastPinchDist.current = d;
      setScale((s) => clampScale(s * factor));
      didPan.current = true;
    } else if (pointers.current.size === 1 && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) {
        didPan.current = true;
        setTx(dragStart.current.tx + dx);
        setTy(dragStart.current.ty + dy);
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    setActivePointers(pointers.current.size);
    if (pointers.current.size < 2) lastPinchDist.current = null;
    if (pointers.current.size === 0) dragStart.current = null;
  };

  const resetView = () => {
    setScale(isMobile ? fitScale : 1);
    setTx(0);
    setTy(0);
  };

  const grid = useMemo(() => {
    const m = new Map<string, SeatGroup>();
    seatGroups.forEach((g) => m.set(`${g.col}-${g.row}`, g));
    return m;
  }, [seatGroups]);
  const selectedIdSet = useMemo(() => new Set(selectedSeatIds), [selectedSeatIds]);

  const seatWord = lang === "cn" ? "座位" : "Seat";

  return (
    <div
      className="rounded-3xl p-4 sm:p-12 relative overflow-hidden border border-white/60 backdrop-blur-2xl shadow-[0_24px_70px_-20px_hsl(220_40%_30%/0.18),inset_0_1px_0_hsl(0_0%_100%/0.9),inset_0_-1px_0_hsl(220_30%_70%/0.2)]"
      style={{
        backgroundImage: [
          "radial-gradient(700px 500px at 50% 20%, hsl(340 100% 95% / 0.45), transparent 70%)",
          "radial-gradient(700px 500px at 15% 90%, hsl(340 100% 95% / 0.45), transparent 70%)",
          "radial-gradient(600px 420px at 90% 10%, hsl(16 100% 94% / 0.45), transparent 70%)",
          "linear-gradient(160deg, hsl(0 0% 100% / 0.7) 0%, hsl(340 100% 97% / 0.55) 50%, hsl(340 100% 97% / 0.5) 100%)",
        ].join(","),
      }}
    >
      {/* Stage — desktop only */}
      {!isMobile && (
        <div className="relative mb-12">
          <div className="cv-stage cv-stage-enter h-14 rounded-2xl flex items-center justify-center font-semibold tracking-[0.3em] text-[hsl(0_0%_10%)] border border-[hsl(346_85%_75%/0.5)] backdrop-blur-2xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.8),inset_0_-1px_2px_hsl(16_90%_72%/0.22),0_10px_30px_-8px_hsl(346_85%_70%/0.35)] bg-[linear-gradient(180deg,hsl(340_100%_94%/0.75)_0%,hsl(340_95%_88%/0.65)_50%,hsl(16_100%_82%/0.55)_100%)]" style={{ animationDelay: "500ms" }}>
            <span className="drop-shadow-sm">{lang === "cn" ? "舞台" : "STAGE"}</span>
          </div>
        </div>
      )}

      {warning && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} />
          {warning}
        </div>
      )}

      {/* Mobile zoom controls */}
      {isMobile && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 pointer-events-auto">
          <button type="button" onClick={() => setScale((s) => clampScale(s * 1.2))} className="h-9 w-9 rounded-full bg-white/80 backdrop-blur-md border border-white/70 shadow-md flex items-center justify-center text-foreground active:scale-95 transition" aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setScale((s) => clampScale(s / 1.2))} className="h-9 w-9 rounded-full bg-white/80 backdrop-blur-md border border-white/70 shadow-md flex items-center justify-center text-foreground active:scale-95 transition" aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={resetView} className="h-9 w-9 rounded-full bg-white/80 backdrop-blur-md border border-white/70 shadow-md flex items-center justify-center text-foreground active:scale-95 transition" aria-label="Reset view">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mobile hint when zoomed out below the click threshold */}
      {isMobile && !clickEnabled && !readOnly && (
        <div className="absolute top-3 left-3 z-20 pointer-events-none rounded-full px-3 py-1 text-[11px] font-medium text-foreground bg-white/80 backdrop-blur-md border border-white/70 shadow">
          {lang === "cn" ? "双指缩放放大后可选座" : "Pinch / double-tap to zoom in & select seats"}
        </div>
      )}

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn("relative", isMobile && "overflow-hidden touch-none select-none")}
        style={isMobile ? { minHeight: 520 } : undefined}
      >
        <div
          className="relative"
          style={
            isMobile
              ? {
                  transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                  transformOrigin: "0 0",
                  transition: activePointers === 0 ? "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                  width: "max-content",
                }
              : undefined
          }
        >
          <div className="relative mx-auto" style={isMobile ? { width: `${MOBILE_CHART_WIDTH}px` } : { width: `${CHART_WIDTH}px`, maxWidth: "100%" }}>
            {/* Mobile stage — inside the transformed container */}
            {isMobile && (
              <div className="relative mb-8">
                <div className="cv-stage cv-stage-enter h-14 rounded-2xl flex items-center justify-center font-semibold tracking-[0.3em] text-[hsl(0_0%_10%)] border border-[hsl(346_85%_75%/0.5)] backdrop-blur-2xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.8),inset_0_-1px_2px_hsl(16_90%_72%/0.22),0_10px_30px_-8px_hsl(346_85%_70%/0.35)] bg-[linear-gradient(180deg,hsl(340_100%_94%/0.75)_0%,hsl(340_95%_88%/0.65)_50%,hsl(16_100%_82%/0.55)_100%)]" style={{ animationDelay: "500ms" }}>
                  <span className="drop-shadow-sm">{lang === "cn" ? "舞台" : "STAGE"}</span>
                </div>
              </div>
            )}
            <div className="relative" style={{ paddingLeft: hasLongTable ? 28 : 0 }}>
              {hasLongTable && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-0" style={{ left: `75%`, width: 0, borderLeft: "2px dashed hsl(346 85% 70% / 0.55)" }} />
              )}
              {Array.from({ length: ROWS }, (_, rowIdx) => (
                <div
                  key={rowIdx}
                  className="grid last:mb-0 justify-items-center items-start"
                  style={{ gridTemplateColumns: `repeat(${COLS}, ${colUnit}px)`, columnGap: `${colGap}px`, rowGap: `${rowGap}px`, marginBottom: `${rowGap + 14}px` }}
                >
                  {Array.from({ length: COLS }, (_, colIdx) => {
                    const colNum = colIdx + 1;
                    const group = grid.get(`${colNum}-${rowIdx}`);
                    if (!group) return <div key={colIdx} />;
                    const selectedInGroup = group.seats.filter((s) => selectedIdSet.has(s.id)).map((s) => s.id).join(",");
                    return (
                      <SeatGroupCell
                        key={group.id}
                        group={group}
                        selectedInGroup={selectedInGroup}
                        isAnyGroupSelected={selectedGroupId !== null}
                        isThisGroupSelected={selectedGroupId === group.id}
                        onToggleSeat={onToggleSeat}
                        canToggle={clickEnabled}
                        didPanRef={didPan}
                        seatLabel={seatWord}
                        limitReached={selectedSeatIds.length >= maxSelectable}
                        readOnly={readOnly}
                        rowIdx={rowIdx}
                        colIdx={colIdx}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Door */}
            {showDoor && (
              <div className="grid -mt-4 mb-1 relative z-10" style={{ gridTemplateColumns: `repeat(${COLS}, ${colUnit}px)`, columnGap: `${colGap}px` }}>
                {Array.from({ length: Math.max(0, COLS - 2) }, (_, i) => (
                  <div key={i} />
                ))}
                <div className="col-span-2 flex justify-center">
                  <div className="w-[88px] h-[36px] flex items-center justify-center px-2 rounded-xl text-[hsl(0_0%_10%)] text-xs font-bold tracking-wider text-center border border-[hsl(346_85%_75%/0.55)] backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.85),0_6px_18px_-4px_hsl(346_85%_70%/0.35)] bg-[linear-gradient(180deg,hsl(340_100%_94%/0.85)_0%,hsl(340_95%_88%/0.75)_50%,hsl(16_100%_82%/0.65)_100%)]">
                    {lang === "cn" ? "入口" : "ENTRANCE"}
                  </div>
                </div>
              </div>
            )}
            {/* Wall */}
            <div className="mt-1 mb-4">
              <div className="w-full h-[44px] rounded-xl border border-[hsl(346_80%_75%/0.5)] backdrop-blur-md shadow-[inset_0_1px_0_hsl(0_0%_100%/0.85),inset_0_-1px_2px_hsl(16_90%_72%/0.18),0_4px_14px_-4px_hsl(346_85%_60%/0.3)] bg-[linear-gradient(180deg,hsl(340_95%_92%/0.85)_0%,hsl(340_95%_90%/0.7)_55%,hsl(16_100%_82%/0.6)_100%)]" aria-hidden="true" />
            </div>

            {/* Legend */}
            <div className="mt-5 flex justify-center">
              <div className="rounded-full inline-flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-[hsl(0_0%_10%)] px-5 py-2 border border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_4px_16px_-4px_hsl(220_40%_30%/0.15),inset_0_1px_0_hsl(0_0%_100%/0.9)]">
                <LegendDot className="bg-white border border-[hsl(0_0%_80%)]" label={lang === "cn" ? "可选" : "Available"} />
                <LegendDot className="bg-[#FF3D6E] border border-[#FF3D6E]" label={lang === "cn" ? "已选" : "Selected"} />
                <LegendDot className="bg-[hsl(0_0%_70%)] border border-[hsl(0_0%_60%)]" label={lang === "cn" ? "已订" : "Booked"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-4 h-4 rounded", className)} />
      <span>{label}</span>
    </div>
  );
}

const SeatGroupCell = memo(function SeatGroupCell({
  group,
  selectedInGroup,
  isAnyGroupSelected,
  isThisGroupSelected,
  onToggleSeat,
  canToggle,
  didPanRef,
  seatLabel,
  limitReached,
  readOnly,
  rowIdx,
  colIdx,
}: {
  group: SeatGroup;
  selectedInGroup: string;
  isAnyGroupSelected: boolean;
  isThisGroupSelected: boolean;
  onToggleSeat: (seat: Seat, groupId: string) => void;
  canToggle: boolean;
  didPanRef: React.MutableRefObject<boolean>;
  seatLabel: string;
  limitReached?: boolean;
  readOnly?: boolean;
  rowIdx: number;
  colIdx: number;
}) {
  const isVip = group.type === "V";
  const isLong = group.shape === "long";
  const seatBy = (n: number) => group.seats.find((s) => s.seatNumber === n);
  const selectedIdSet = useMemo(
    () => new Set(selectedInGroup ? selectedInGroup.split(",") : []),
    [selectedInGroup],
  );

  const groupDelay = isVip ? 600 + colIdx * 30 : 700 + Math.abs(colIdx - 3) * 60 + rowIdx * 40;

  const renderSeat = (n: number) => {
    const seat = seatBy(n);
    if (!seat) return <div className="w-9 h-9" />;
    const isSelected = selectedIdSet.has(seat.id);
    const isBooked = seat.status === "booked";
    const dimmed = isAnyGroupSelected && !isThisGroupSelected && !isBooked;
    const atLimit = !!limitReached && !isSelected && !isBooked;

    return (
      <button
        type="button"
        disabled={isBooked || atLimit || readOnly}
        data-selected={isSelected ? "true" : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!canToggle) return;
          if (didPanRef.current) return;
          onToggleSeat(seat, group.id);
        }}
        className={cn(
          "cv-seat w-9 h-9 rounded-full text-[12px] font-semibold font-sans flex items-center justify-center border leading-none shrink-0 tracking-tight",
          isBooked && "bg-[hsl(0_0%_72%)]/80 border-[hsl(0_0%_60%)] text-[hsl(0_0%_25%)] backdrop-blur-md cursor-not-allowed shadow-[inset_0_1px_1.5px_hsl(0_0%_100%/0.6),inset_0_-1px_2px_hsl(0_0%_0%/0.1)]",
          !isBooked && !isSelected &&
            "text-[hsl(0_0%_25%)] border-white/80 bg-[radial-gradient(circle_at_30%_22%,hsl(0_0%_100%/0.95),hsl(40_25%_97%/0.9)_70%)] shadow-[inset_0_1.5px_2px_hsl(0_0%_100%/0.95),inset_0_-1px_2px_hsl(40_20%_60%/0.15),0_2px_8px_-2px_hsl(40_20%_40%/0.18)] hover:shadow-[inset_0_1.5px_2px_hsl(0_0%_100%/0.95),0_0_16px_hsl(346_92%_75%/0.45),0_2px_8px_-2px_hsl(40_20%_40%/0.18)]",
          !isBooked && isSelected &&
            "text-[hsl(0_0%_10%)] border-2 border-[hsl(346_92%_62%)] bg-[linear-gradient(180deg,hsl(340_95%_88%),hsl(16_100%_82%))] shadow-[inset_0_1px_1.5px_hsl(0_0%_100%/0.7),0_0_16px_hsl(16_100%_82%/0.6),0_3px_10px_-2px_hsl(16_95%_70%/0.5)]",
          dimmed && "opacity-40",
          atLimit && "opacity-40 cursor-not-allowed hover:shadow-none",
          readOnly && "cursor-default hover:shadow-none pointer-events-none",
        )}
        title={`${group.label} ${seatLabel} ${n}`}
      >
        <span className="cv-seat-num">{n}</span>
      </button>
    );
  };

  const tableClass =
    "rounded-xl text-[hsl(0_0%_10%)] text-[11px] font-bold flex items-center justify-center tracking-wide border border-[hsl(346_85%_70%/0.45)] shadow-[inset_0_1.5px_2px_hsl(0_0%_100%/0.9),inset_0_-1px_2px_hsl(16_90%_72%/0.18),0_4px_14px_-2px_hsl(346_85%_70%/0.3)] bg-[linear-gradient(180deg,hsl(340_100%_96%/0.85)_0%,hsl(340_95%_88%/0.7)_55%,hsl(346_85%_75%/0.6)_100%)]";

  return (
    <div className={cn("cv-seat-group flex flex-col items-center", isVip ? "cv-seat-vip-enter" : "cv-seat-g-enter")} style={{ ["--cv-d" as string]: `${groupDelay}ms` }}>
      {isVip ? (
        <div className="flex flex-col items-center gap-2">
          <div className={cn(tableClass, "w-[88px] h-9 px-2")}>
            <span>{group.label}</span>
          </div>
          <div className="flex gap-2">
            {renderSeat(1)}
            {renderSeat(2)}
          </div>
        </div>
      ) : isLong ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {renderSeat(5)}
            <div className={cn(tableClass, "w-[218px] h-9 px-3")}>
              <span>{group.label}</span>
            </div>
            {renderSeat(6)}
          </div>
          <div className="flex gap-[14px]">
            {renderSeat(1)}
            {renderSeat(2)}
            {renderSeat(3)}
            {renderSeat(4)}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-2">
            {renderSeat(1)}
            {renderSeat(3)}
          </div>
          <div className={cn(tableClass, "w-9 h-[88px]")}>
            <span>{group.label}</span>
          </div>
          <div className="flex flex-col gap-2">
            {renderSeat(2)}
            {renderSeat(4)}
          </div>
        </div>
      )}
    </div>
  );
});
