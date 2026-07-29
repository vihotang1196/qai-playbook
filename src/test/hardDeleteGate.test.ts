import { describe, it, expect } from "vitest";
import { requiresHardDeleteGate, hasPaymentTrace, hasAttendance } from "@/lib/offlineEventDelete";

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
