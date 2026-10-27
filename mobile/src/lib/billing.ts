/**
 * Billing engine (spec §7). Pure functions with no imports so they can be unit tested
 * with `node --test` and later ported 1:1 to the Supabase RPC / Edge Functions.
 *
 * The live rules run in the database (`_charge_minute`, `call_tick`, `_end_call` in
 * supabase/migrations); the app never changes balances. These mirrors stay for the unit
 * tests and for client-side hints such as the low-balance countdown.
 */

export type LedgerReason =
  | 'purchase'
  | 'call_charge'
  | 'call_refund'
  | 'gift'
  | 'bonus'
  | 'admin_adjust'
  | 'signup_trial'
  | 'purchase_refund';

export type LedgerEntry = {
  id: string;
  delta: number;
  reason: LedgerReason;
  idempotencyKey: string;
  balanceAfter: number;
  refId?: string;
  note?: string;
  createdAt: number;
};

export type Wallet = { balance: number; ledger: LedgerEntry[] };

export type CallEndReason = 'caller_hangup' | 'host_hangup' | 'low_balance' | 'timeout' | 'network' | 'moderation' | 'declined';

export type BillingSession = {
  id: string;
  ratePerMin: number;
  hostShareBps: number;
  coinValuePaise: number;
  billedMinutes: number;
  coinsCharged: number;
  hostEarnedPaise: number;
  refunded: boolean;
};

export type ApplyResult = { wallet: Wallet; applied: boolean; reason?: 'duplicate' | 'insufficient' };

/** Append a ledger entry. Idempotent on `idempotencyKey`; never lets balance go below zero. */
export function applyLedger(
  wallet: Wallet,
  entry: { delta: number; reason: LedgerReason; idempotencyKey: string; refId?: string; note?: string },
  now: number = Date.now(),
): ApplyResult {
  if (wallet.ledger.some((e) => e.idempotencyKey === entry.idempotencyKey)) {
    return { wallet, applied: false, reason: 'duplicate' };
  }
  const balanceAfter = wallet.balance + entry.delta;
  if (balanceAfter < 0) return { wallet, applied: false, reason: 'insufficient' };
  const row: LedgerEntry = { ...entry, id: `${now}-${wallet.ledger.length}`, balanceAfter, createdAt: now };
  return { wallet: { balance: balanceAfter, ledger: [row, ...wallet.ledger] }, applied: true };
}

export function hostEarningPerMinutePaise(s: Pick<BillingSession, 'ratePerMin' | 'coinValuePaise' | 'hostShareBps'>): number {
  return Math.floor((s.ratePerMin * s.coinValuePaise * s.hostShareBps) / 10_000);
}

export function minuteKey(sessionId: string, minute: number): string {
  return `call:${sessionId}:minute:${minute}`;
}

/** Charge one specific minute (1-based). Safe to call twice for the same minute. */
export function chargeMinute(
  session: BillingSession,
  wallet: Wallet,
  minute: number,
  now?: number,
): { session: BillingSession; wallet: Wallet; ok: boolean } {
  const res = applyLedger(
    wallet,
    { delta: -session.ratePerMin, reason: 'call_charge', idempotencyKey: minuteKey(session.id, minute), refId: session.id },
    now,
  );
  if (res.reason === 'duplicate') return { session, wallet, ok: true };
  if (!res.applied) return { session, wallet, ok: false };
  return {
    wallet: res.wallet,
    ok: true,
    session: {
      ...session,
      billedMinutes: Math.max(session.billedMinutes, minute),
      coinsCharged: session.coinsCharged + session.ratePerMin,
      hostEarnedPaise: session.hostEarnedPaise + hostEarningPerMinutePaise(session),
    },
  };
}

/**
 * Heartbeat. Prepaid: minute N is charged when the call enters minute N
 * (minute 1 at connect, minute 2 at 60s, ...). Returns `ended: true` when the
 * caller cannot pay for the minute that just started.
 */
export function tick(
  session: BillingSession,
  wallet: Wallet,
  elapsedSec: number,
  now?: number,
): { session: BillingSession; wallet: Wallet; ended: boolean } {
  const minutesDue = Math.floor(Math.max(0, elapsedSec) / 60) + 1;
  let s = session;
  let w = wallet;
  for (let m = s.billedMinutes + 1; m <= minutesDue; m++) {
    const r = chargeMinute(s, w, m, now);
    if (!r.ok) return { session: s, wallet: w, ended: true };
    s = r.session;
    w = r.wallet;
  }
  return { session: s, wallet: w, ended: false };
}

/** End of call. Calls shorter than `refundUnderSec` are refunded in full, host earning reversed. */
export function settleEnd(
  session: BillingSession,
  wallet: Wallet,
  elapsedSec: number,
  refundUnderSec: number,
  now?: number,
): { session: BillingSession; wallet: Wallet; refundedCoins: number } {
  if (session.refunded || session.coinsCharged === 0 || elapsedSec >= refundUnderSec) {
    return { session, wallet, refundedCoins: 0 };
  }
  const res = applyLedger(
    wallet,
    { delta: session.coinsCharged, reason: 'call_refund', idempotencyKey: `call:${session.id}:refund`, refId: session.id, note: 'Short call refund' },
    now,
  );
  if (!res.applied) return { session, wallet, refundedCoins: 0 };
  return {
    wallet: res.wallet,
    refundedCoins: session.coinsCharged,
    session: { ...session, refunded: true, hostEarnedPaise: 0 },
  };
}

/**
 * Seconds of already-paid time left when the caller cannot afford the next minute,
 * otherwise null. Drives the 60s / 20s low-balance warnings.
 */
export function secondsUntilCutoff(session: BillingSession, balance: number, elapsedSec: number): number | null {
  if (balance >= session.ratePerMin) return null;
  return Math.max(0, session.billedMinutes * 60 - elapsedSec);
}

/** How many whole minutes the balance covers at a given rate. */
export function affordableMinutes(balance: number, ratePerMin: number): number {
  return ratePerMin > 0 ? Math.floor(balance / ratePerMin) : 0;
}
