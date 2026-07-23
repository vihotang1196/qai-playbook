import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { SeatMap } from "./SeatMap";
import { getEventSeatmap } from "@/lib/offlineEventAdmin";
import { layoutToSeatGroups, seatLabel, type OeSeat } from "@/lib/offlineEvent";

/**
 * Admin seat picker — loads an event's floor plan + claimed seats and lets the
 * admin pick seats (reuses the customer SeatMap visual). Emits SEAT LABELS
 * ("G5 Seat 1") via onChange. Used by manual add-ticket and change-seat/date.
 *
 * `excludeBookingId` (change-seat) omits that booking's own seats from "booked"
 * so they show free and can be re-selected. `initialLabels` are pre-selected,
 * skipping any that are already booked by someone else on this event.
 */

interface Props {
  eventId: string;
  excludeBookingId?: string;
  maxSelectable: number;
  initialLabels?: string[];
  onChange: (labels: string[]) => void;
}

/** "G5 Seat 1" → "G5-1" (the SeatMap's internal seat id). */
function labelToId(label: string): string {
  const m = label.match(/^(.*) Seat (\d+)$/);
  return m ? `${m[1]}-${m[2]}` : label;
}

export default function AdminSeatPicker({ eventId, excludeBookingId, maxSelectable, initialLabels = [], onChange }: Props) {
  const [layout, setLayout] = useState<unknown>(null);
  const [bookedLabels, setBookedLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    getEventSeatmap(eventId, excludeBookingId)
      .then((r) => {
        if (cancelled) return;
        setLayout(r.layout);
        setBookedLabels(r.bookedLabels);
        // Pre-select the requested seats, skipping any taken by someone else.
        const bookedIds = new Set(r.bookedLabels.map(labelToId));
        const initIds = initialLabels.map(labelToId).filter((id) => !bookedIds.has(id));
        setSelectedIds(initIds);
        onChange(initIds.map(idToLabelSafe));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "加载座位图失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, excludeBookingId]);

  const { groups, layout: normLayout } = useMemo(() => layoutToSeatGroups(layout, bookedLabels), [layout, bookedLabels]);

  const idToLabel = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => g.seats.forEach((s) => m.set(s.id, seatLabel(g.id, s.seatNumber))));
    return m;
  }, [groups]);

  const emit = (ids: string[]) => onChange(ids.map((id) => idToLabel.get(id) ?? "").filter(Boolean));

  const onToggleSeat = (seat: OeSeat) => {
    setSelectedIds((prev) => {
      let next: string[];
      if (prev.includes(seat.id)) next = prev.filter((x) => x !== seat.id);
      else if (prev.length >= maxSelectable) return prev;
      else next = [...prev, seat.id];
      emit(next);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (err) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="w-4 h-4" /> {err}
      </div>
    );
  }

  return (
    <SeatMap
      seatGroups={groups}
      selectedSeatIds={selectedIds}
      selectedGroupId={null}
      onToggleSeat={(seat) => onToggleSeat(seat)}
      warning={null}
      maxSelectable={maxSelectable}
      columns={normLayout.columns}
      rows={normLayout.rows}
      door={normLayout.door}
      stage={normLayout.stage}
      stagePosition={normLayout.stagePosition}
      divider={normLayout.divider}
    />
  );
}

// Fallback used only during the initial emit (before idToLabel memo is built):
// convert "G5-1" → "G5 Seat 1" directly from the id shape.
function idToLabelSafe(id: string): string {
  const i = id.lastIndexOf("-");
  if (i <= 0) return id;
  return `${id.slice(0, i)} Seat ${id.slice(i + 1)}`;
}
