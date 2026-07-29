import { describe, it, expect } from "vitest";
import { requiresHardDeleteGate, hasPaymentTrace, hasAttendance, blocksArchive } from "@/lib/offlineEventDelete";

/**
 * The gate is INVERTED: tier B (weak confirm) only when the booking is provably
 * money-free and never attended. These tests exist to catch the regression that
 * matters — a paid or attended booking slipping into the weak tier.
 */
const clean = {
  total: 0,
  payment_intent_id: null,
  stripe_session_id: null,
  receipt_url: null,
  day1_status: "pending",
  day2_status: "pending",
};

describe("requiresHardDeleteGate", () => {
  it("grants tier B only for a provably money-free, never-attended booking", () => {
    expect(requiresHardDeleteGate(clean)).toBe(false);
  });

  it("forces tier A on any single payment trace", () => {
    expect(requiresHardDeleteGate({ ...clean, total: 428.76 })).toBe(true);
    expect(requiresHardDeleteGate({ ...clean, payment_intent_id: "pi_123" })).toBe(true);
    expect(requiresHardDeleteGate({ ...clean, stripe_session_id: "cs_test_123" })).toBe(true);
    expect(requiresHardDeleteGate({ ...clean, receipt_url: "https://stripe.com/r/1" })).toBe(true);
  });

  it("forces tier A when either day was attended, even for a free booking", () => {
    expect(requiresHardDeleteGate({ ...clean, day1_status: "attended" })).toBe(true);
    expect(requiresHardDeleteGate({ ...clean, day2_status: "attended" })).toBe(true);
  });

  it("does not treat not_attending as attendance", () => {
    expect(hasAttendance({ ...clean, day1_status: "not_attending" })).toBe(false);
  });

  it("treats an unpaid pending booking with a live Stripe session as money-touched", () => {
    // The session can still be paid until it expires (batch 6), so "unpaid now"
    // is not "unpayable".
    expect(hasPaymentTrace({ ...clean, stripe_session_id: "cs_test_live" })).toBe(true);
  });

  it("survives a missing/undefined optional field without downgrading the tier", () => {
    expect(requiresHardDeleteGate({ total: 397 })).toBe(true);
    expect(requiresHardDeleteGate({ total: 0 })).toBe(false);
  });
});

describe("blocksArchive", () => {
  it("blocks a live booking that took money — archiving would free the seat with no refund", () => {
    expect(blocksArchive({ ...clean, total: 428.76, status: "confirmed" })).toBe(true);
    expect(blocksArchive({ ...clean, stripe_session_id: "cs_test_1", status: "pending" })).toBe(true);
  });

  it("allows a CANCELLED booking that took money — seats already free, money settled", () => {
    // This is the ordinary cleanup path (cancel the junk, then archive it away).
    // Blocking it would make the archive useless for anything that touched Stripe.
    expect(blocksArchive({ ...clean, total: 1715.04, status: "cancelled" })).toBe(false);
    expect(blocksArchive({ ...clean, receipt_url: "https://stripe.com/r/1", status: "cancelled" })).toBe(false);
  });

  it("allows a free booking in any live state", () => {
    expect(blocksArchive({ ...clean, status: "confirmed" })).toBe(false);
    expect(blocksArchive({ ...clean, status: "pending" })).toBe(false);
  });

  it("blocks when status is missing rather than assuming it is cancelled", () => {
    expect(blocksArchive({ total: 397 })).toBe(true);
  });
});
