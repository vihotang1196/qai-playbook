import { cn } from "@/lib/utils";
import { AlertCircle, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { useRef, useState, useEffect, useMemo, memo, type PointerEvent as ReactPointerEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OeSeatGroup as SeatGroup, OeSeat as Seat, OeDoorEdge, OeDivider } from "@/lib/offlineEvent";

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
  /** Which edge the door sits on (overrides showDoor when given). */
  door?: OeDoorEdge;
  /** Door position along its edge, 0-100% (default ~85%). */
  doorPos?: number;
  /** Show the stage bar (default true). */
  stage?: boolean;
  /** Stage position relative to the seats (default top). */
  stagePosition?: "top" | "bottom";
  /** Optional dashed boundary line. When omitted, a vertical line auto-draws at
   *  75% only if a long table exists (legacy). */
  divider?: OeDivider;
  /** Read-only mode: seats are visible but not clickable. */
  readOnly?: boolean;
}

const DEFAULT_COLS = 6;
const DEFAULT_ROWS = 5;
const CLICK_SCALE_THRESHOLD = 0.6; // below this, taps don't select seats

export function SeatMap({ seatGroups, selectedSeatIds, selectedGroupId, onToggleSeat, warning, maxSelectable = 4, columns, rows, showDoor = true, door, doorPos, stage = true, stagePosition = "top", divider, readOnly = false }: Props) {
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

  // ── Configurable venue elements (P8b) ──
  const stageAtTop = stage && stagePosition !== "bottom";
  const stageAtBottom = stage && stagePosition === "bottom";
  const doorEdge: OeDoorEdge = door ?? (showDoor ? "bottom" : "none");
  const doorPct = typeof doorPos === "number" ? Math.max(0, Math.min(100, doorPos)) : 85;
  const doorAtTop = doorEdge === "top";
  const doorAtBottom = doorEdge === "bottom";
  // Legacy fallback: auto vertical line at 75% only when a long table exists.
  const dividerCfg: OeDivider = divider ?? { enabled: hasLongTable, axis: "vertical", pos: 75 };

  const stageBar = (
    <div className="cv-stage cv-stage-enter h-14 rounded-2xl flex items-center justify-center font-semibold tracking-[0.3em] text-[#fed50a] border-2 border-[#141414] bg-[#141414]" style={{ animationDelay: "500ms" }}>
      <span className="drop-shadow-sm">{lang === "cn" ? "舞台" : "STAGE"}</span>
    </div>
  );
  const doorPill = (
    <div className="w-[88px] h-[36px] flex items-center justify-center px-2 rounded-xl text-[#141414] text-xs font-bold tracking-wider text-center border-2 border-[#141414] bg-white">
      {lang === "cn" ? "入口" : "ENTRANCE"}
    </div>
  );

  return (
    <div className="rounded-3xl p-4 sm:p-12 relative overflow-hidden border-2 border-[#141414] bg-white shadow-[0_8px_28px_rgba(20,20,20,0.06)]">
      {/* Stage (top) — desktop only (doesn't scale with pan/zoom) */}
      {!isMobile && stageAtTop && <div className="relative mb-12">{stageBar}</div>}

      {warning && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border-2 border-[#141414] text-[#141414] text-sm font-medium animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} />
          {warning}
        </div>
      )}

      {/* Mobile zoom controls */}
      {isMobile && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 pointer-events-auto">
          <button type="button" onClick={() => setScale((s) => clampScale(s * 1.2))} className="h-9 w-9 rounded-full bg-white border-2 border-[#141414] flex items-center justify-center text-[#141414] active:scale-95 transition" aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setScale((s) => clampScale(s / 1.2))} className="h-9 w-9 rounded-full bg-white border-2 border-[#141414] flex items-center justify-center text-[#141414] active:scale-95 transition" aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={resetView} className="h-9 w-9 rounded-full bg-white border-2 border-[#141414] flex items-center justify-center text-[#141414] active:scale-95 transition" aria-label="Reset view">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mobile hint when zoomed out below the click threshold */}
      {isMobile && !clickEnabled && !readOnly && (
        <div className="absolute top-3 left-3 z-20 pointer-events-none rounded-full px-3 py-1 text-[11px] font-medium text-[#141414] bg-white border-2 border-[#141414]">
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
            {/* Mobile stage (top) — inside the transformed container */}
            {isMobile && stageAtTop && <div className="relative mb-8">{stageBar}</div>}
            {/* Door at top edge, positioned along it by doorPct% */}
            {doorAtTop && (
              <div className="relative h-9 mb-4 z-10">
                <div className="absolute -translate-x-1/2" style={{ left: `${doorPct}%` }}>{doorPill}</div>
              </div>
            )}
            <div className="relative" style={{ paddingLeft: hasLongTable ? 28 : 0 }}>
              {dividerCfg.enabled && (
                dividerCfg.axis === "vertical" ? (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-0" style={{ left: `${dividerCfg.pos}%`, width: 0, borderLeft: "2px dashed rgba(20,20,20,0.4)" }} />
                ) : (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-0" style={{ top: `${dividerCfg.pos}%`, height: 0, borderTop: "2px dashed rgba(20,20,20,0.4)" }} />
                )
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

            {/* Stage (bottom) — directly below the seats */}
            {stageAtBottom && <div className="relative mt-6 mb-2">{stageBar}</div>}
            {/* Door at bottom edge, positioned along it by doorPct% */}
            {doorAtBottom && (
              <div className="relative h-9 -mt-2 mb-1 z-10">
                <div className="absolute -translate-x-1/2" style={{ left: `${doorPct}%` }}>{doorPill}</div>
              </div>
            )}
            {/* Wall */}
            <div className="mt-1 mb-4">
              <div className="w-full h-[44px] rounded-xl border-2 border-[#141414]/30 bg-[#141414]/5" aria-hidden="true" />
            </div>

            {/* Legend */}
            <div className="mt-5 flex justify-center">
              <div className="rounded-full inline-flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-[#141414] px-5 py-2 border-2 border-[#141414] bg-white">
                <LegendDot className="bg-white border-2 border-[#141414]" label={lang === "cn" ? "可选" : "Available"} />
                <LegendDot className="bg-[#fed50a] border-2 border-[#141414]" label={lang === "cn" ? "已选" : "Selected"} />
                <LegendDot className="bg-[#141414] border-2 border-[#141414]" label={lang === "cn" ? "已订" : "Booked"} />
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
          isBooked && "bg-[#141414] border-2 border-[#141414] text-white/55 cursor-not-allowed",
          !isBooked && !isSelected &&
            "text-[#141414] border-2 border-[#141414] bg-white hover:shadow-[0_0_0_3px_rgba(254,213,10,0.55)]",
          !isBooked && isSelected &&
            "text-[#141414] border-2 border-[#141414] bg-[#fed50a] shadow-[0_0_0_2px_#141414]",
          dimmed && "opacity-40",
          atLimit && "opacity-40 cursor-not-allowed hover:shadow-none border-dashed",
          readOnly && "cursor-default hover:shadow-none pointer-events-none",
        )}
        title={`${group.label} ${seatLabel} ${n}`}
      >
        <span className="cv-seat-num">{n}</span>
      </button>
    );
  };

  const tableClass =
    "rounded-xl text-[#141414] text-[11px] font-bold flex items-center justify-center tracking-wide border-2 border-[#141414] bg-white";

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
