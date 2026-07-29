import { describe, it, expect } from "vitest";
import { keepFirstNSeats, type OeFloorPlanLayout } from "@/lib/offlineEvent";

/**
 * The rule this file exists to protect: applying the same N twice must give the
 * same plan. The obvious implementation (disable the tail of what is currently
 * enabled) shrinks the hall a bit more on every click, and the second click looks
 * like it "worked" — so this is the regression worth catching.
 */
const table = (id: string, col: number, row: number, extra: Partial<OeFloorPlanLayout["tables"][0]> = {}) => ({
  id,
  label: id,
  shape: "cluster" as const,
  col,
  row,
  seats: [1, 2, 3, 4],
  missingSeats: [],
  disabledSeats: [],
  ...extra,
});

/** 2 columns x 2 rows of 4-seat tables = 16 physical seats. */
const plan = (): OeFloorPlanLayout => ({
  columns: 2,
  rows: 2,
  stage: true,
  stagePosition: "top",
  door: "none",
  tables: [table("G1", 1, 0), table("G2", 1, 1), table("G3", 2, 0), table("G4", 2, 1)],
});

const enabledLabels = (l: OeFloorPlanLayout): string[] => {
  const out: string[] = [];
  for (const t of l.tables) {
    const off = new Set([...(t.disabledSeats ?? []), ...(t.missingSeats ?? [])]);
    for (const n of t.seats) if (!off.has(n)) out.push(`${t.id} Seat ${n}`);
  }
  return out;
};

describe("keepFirstNSeats", () => {
  it("keeps seats nearest the stage first: row, then column, then seat number", () => {
    const r = keepFirstNSeats(plan(), 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Row 0 holds G1 (col 1) and G3 (col 2) → G1 1-4 then G3 1.
    expect(enabledLabels(r.layout)).toEqual([
      "G1 Seat 1", "G1 Seat 2", "G1 Seat 3", "G1 Seat 4", "G3 Seat 1",
    ]);
    expect(r.effective).toBe(5);
    expect(r.disabledCount).toBe(11);
    expect(r.available).toBe(16);
  });

  it("counts rows from the stage, so stagePosition bottom flips the order", () => {
    const l = { ...plan(), stagePosition: "bottom" as const };
    const r = keepFirstNSeats(l, 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Stage at the bottom → row 1 is the front row → G2 (col 1) first.
    expect(enabledLabels(r.layout)).toEqual(["G2 Seat 1", "G2 Seat 2", "G2 Seat 3", "G2 Seat 4"]);
  });

  it("IS IDEMPOTENT — applying the same N twice against the baseline is identical", () => {
    const baseline = plan();
    const once = keepFirstNSeats(baseline, 6);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = keepFirstNSeats(baseline, 6);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(enabledLabels(twice.layout)).toEqual(enabledLabels(once.layout));
    // And the dangerous version: feeding the RESULT back in must not shrink it.
    const fedBack = keepFirstNSeats(once.layout, 6);
    expect(fedBack.ok).toBe(true);
    if (!fedBack.ok) return;
    expect(enabledLabels(fedBack.layout).length).toBe(6);
  });

  it("leaves seats the baseline already disabled disabled, and doesn't count them", () => {
    const baseline = plan();
    baseline.tables[0].disabledSeats = [1, 2]; // G1 1-2 deliberately off
    const r = keepFirstNSeats(baseline, 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.available).toBe(14);
    expect(enabledLabels(r.layout)).toEqual(["G1 Seat 3", "G1 Seat 4", "G3 Seat 1", "G3 Seat 2"]);
  });

  it("never disables a booked seat, reports it, and raises the effective count", () => {
    // G4 Seat 1 is far from the stage: it falls well outside the first 2.
    const r = keepFirstNSeats(plan(), 2, ["G4 Seat 1"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.requested).toBe(2);
    expect(r.effective).toBe(3);
    expect(r.bookedOutside).toEqual(["G4 Seat 1"]);
    expect(enabledLabels(r.layout)).toContain("G4 Seat 1");
  });

  it("refuses when N is below the number of seats already sold", () => {
    const r = keepFirstNSeats(plan(), 2, ["G1 Seat 1", "G2 Seat 1", "G3 Seat 1"]);
    expect(r).toEqual({ ok: false, error: "below_booked", bookedCount: 3 });
  });

  it("ignores booked labels that aren't seats of this plan", () => {
    const r = keepFirstNSeats(plan(), 1, ["G99 Seat 1"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bookedOutside).toEqual([]);
    expect(r.effective).toBe(1);
  });

  it("keeps everything when N exceeds what is available, and disables nothing", () => {
    const r = keepFirstNSeats(plan(), 999);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.effective).toBe(16);
    expect(r.disabledCount).toBe(0);
    expect(r.available).toBe(16);
  });

  it("rejects 0, negatives, fractions and NaN rather than treating them as 0", () => {
    for (const bad of [0, -5, 1.5, NaN, Infinity]) {
      expect(keepFirstNSeats(plan(), bad)).toEqual({ ok: false, error: "invalid_n" });
    }
  });

  it("never touches missingSeats — a seat that doesn't exist can't be sold or freed", () => {
    const baseline = plan();
    baseline.tables[0].missingSeats = [2];
    const r = keepFirstNSeats(baseline, 999);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layout.tables[0].missingSeats).toEqual([2]);
    expect(r.layout.tables[0].disabledSeats).not.toContain(2);
    expect(enabledLabels(r.layout)).not.toContain("G1 Seat 2");
    expect(r.available).toBe(15);
  });
});
