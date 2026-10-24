// Run with: npm test   (uses Node's built-in test runner with TypeScript type stripping)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyLedger,
  chargeMinute,
  secondsUntilCutoff,
  settleEnd,
  tick,
  type BillingSession,
  type Wallet,
} from '../src/lib/billing.ts';

const session = (over: Partial<BillingSession> = {}): BillingSession => ({
  id: 's1',
  ratePerMin: 6,
  hostShareBps: 3500,
  coinValuePaise: 75,
  billedMinutes: 0,
  coinsCharged: 0,
  hostEarnedPaise: 0,
  refunded: false,
  ...over,
});

const wallet = (balance: number): Wallet => ({ balance, ledger: [] });

const ledgerSum = (w: Wallet, opening: number) => opening + w.ledger.reduce((a, e) => a + e.delta, 0);

test('first minute is charged at connect', () => {
  const r = tick(session(), wallet(40), 0);
  assert.equal(r.wallet.balance, 34);
  assert.equal(r.session.billedMinutes, 1);
  assert.equal(r.session.hostEarnedPaise, Math.floor((6 * 75 * 3500) / 10000));
  assert.equal(r.ended, false);
});

test('double-submitted ticks do not double charge', () => {
  let s = session();
  let w = wallet(40);
  for (let i = 0; i < 5; i++) ({ session: s, wallet: w } = tick(s, w, 30));
  assert.equal(w.balance, 34);
  assert.equal(w.ledger.length, 1);
});

test('charging the same minute twice is a no-op', () => {
  const a = chargeMinute(session(), wallet(40), 1);
  const b = chargeMinute(a.session, a.wallet, 1);
  assert.equal(b.wallet.balance, 34);
  assert.equal(b.session.coinsCharged, 6);
});

test('next minute is charged at each 60s boundary', () => {
  let r = tick(session(), wallet(40), 0);
  r = tick(r.session, r.wallet, 59);
  assert.equal(r.wallet.balance, 34);
  r = tick(r.session, r.wallet, 60);
  assert.equal(r.wallet.balance, 28);
  r = tick(r.session, r.wallet, 185); // catches up minutes 3 and 4
  assert.equal(r.wallet.balance, 16);
  assert.equal(r.session.billedMinutes, 4);
});

test('balance never goes below zero; call ends on low balance', () => {
  let r = tick(session(), wallet(10), 0);
  assert.equal(r.wallet.balance, 4);
  r = tick(r.session, r.wallet, 60);
  assert.equal(r.ended, true);
  assert.equal(r.wallet.balance, 4);
  assert.equal(applyLedger(wallet(3), { delta: -6, reason: 'call_charge', idempotencyKey: 'x' }).applied, false);
});

test('calls under 10s are refunded and host earning reversed', () => {
  const r = tick(session(), wallet(40), 0);
  const end = settleEnd(r.session, r.wallet, 7, 10);
  assert.equal(end.wallet.balance, 40);
  assert.equal(end.refundedCoins, 6);
  assert.equal(end.session.hostEarnedPaise, 0);
  // settling twice does not refund twice
  const again = settleEnd(end.session, end.wallet, 7, 10);
  assert.equal(again.wallet.balance, 40);
});

test('calls of 10s or more are not refunded', () => {
  const r = tick(session(), wallet(40), 0);
  const end = settleEnd(r.session, r.wallet, 10, 10);
  assert.equal(end.wallet.balance, 34);
});

test('ledger sum always equals wallet balance', () => {
  let r = tick(session(), wallet(100), 0);
  for (let t = 1; t <= 600; t += 15) r = tick(r.session, r.wallet, t);
  assert.equal(ledgerSum(r.wallet, 100), r.wallet.balance);
});

test('low-balance warning appears only when the next minute is unaffordable', () => {
  const s = session({ billedMinutes: 2 });
  assert.equal(secondsUntilCutoff(s, 20, 70), null);
  assert.equal(secondsUntilCutoff(s, 4, 70), 50);
  assert.equal(secondsUntilCutoff(s, 4, 100), 20);
});
