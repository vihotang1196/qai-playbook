/**
 * Permanent-delete gating for Offline Event bookings (batch 5).
 *
 * THE ONLY PLACE that decides how hard a permanent delete is to confirm. UI code
 * must call these — never re-test the conditions inline, or the two copies will
 * drift and the weaker one will win the day someone edits only it.
 *
 * Both predicates are written INVERTED on purpose: tier B (the weak confirm) is
 * granted only when we can PROVE the booking never touched money, and everything
 * else falls to tier A (type the booking code). A positive enumeration of
 * "has payment traces" would silently leak new rows into the weak tier the day a
 * new payment column is added (a refund id, a second gateway, a manual-payment
 * note) — the failure mode is a paid order deleted behind a single click. The
 * inverted form fails the other way: the worst case is typing a code you didn't
 * strictly need to type.
 */

/** The fields the gate reads. Kept structural so both list rows and detail rows fit. */
export type HardDeleteSubject = {
  total: number;
  payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  receipt_url?: string | null;
  day1_status?: string | null;
  day2_status?: string | null;
};

/**
 * TRUE unless the booking is provably money-free. Also used to decide which
 * bookings a BULK archive must skip — the same question ("did money touch
 * this?") deserves one answer, not two.
 *
 * Note it treats a live `stripe_session_id` on an unpaid pending booking as a
 * trace. That is intentional: a session can still be paid for ~32 minutes after
 * we stop watching it (batch 6 will expire them), so "no money yet" is not the
 * same as "no money possible".
 */
export function hasPaymentTrace(b: HardDeleteSubject): boolean {
  const clean =
    Number(b.total ?? 0) === 0 &&
    !b.payment_intent_id &&
    !b.stripe_session_id &&
    !b.receipt_url;
  return !clean;
}

/**
 * TRUE → this booking must NOT be archived (batch 7a).
 *
 * Since 7a, archiving RELEASES the seats. For a booking that took money and is
 * still live that combination is the worst of all worlds: the seat is gone, the
 * customer can't get in (batch 0 makes check-in refuse archived bookings), and
 * no refund or credit exists yet (batch 7b). The customer would simply have paid
 * for nothing. Cancel it instead — that at least states plainly what happened.
 *
 * `cancelled` is EXCLUDED on purpose: such a booking already released its seats
 * and its money question is already settled, so archiving it is pure hiding and
 * carries none of that damage. Without this exclusion the ordinary cleanup path
 * (cancel the junk, then archive it out of sight) would be blocked for every
 * booking that ever touched Stripe — which is most of them.
 *
 * ⚠️ THIS RULE EXISTS TWICE. The `archiveBooking` action in
 * `supabase/functions/offline-event-admin/index.ts` re-implements it, because the
 * server cannot trust a disabled button — the UI is a courtesy, the server is the
 * gate. **Change the rule here and you MUST change it there in the same commit**,
 * or the two will disagree and the weaker one decides. Each side's comment points
 * at the other.
 */
export function blocksArchive(b: HardDeleteSubject & { status?: string | null }): boolean {
  return hasPaymentTrace(b) && b.status !== "cancelled";
}

/** TRUE if either day was actually attended — an attendance record is evidence
 *  that outlives the booking, so deleting it deserves the strong gate. */
export function hasAttendance(b: HardDeleteSubject): boolean {
  return b.day1_status === "attended" || b.day2_status === "attended";
}

/**
 * TRUE → tier A: the admin must TYPE the booking code to confirm.
 * FALSE → tier B: an ordinary second confirmation is enough.
 */
export function requiresHardDeleteGate(b: HardDeleteSubject): boolean {
  return hasPaymentTrace(b) || hasAttendance(b);
}
