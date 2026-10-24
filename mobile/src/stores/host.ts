import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { appConfig } from '@/config/appConfig';
import type { Gift, LanguageCode } from '@/data/mock';
import type { QualityInput } from '@/lib/quality';

import { persistStorage } from './storage';

export type HostApplication = {
  displayName: string;
  bio: string;
  languages: LanguageCode[];
  pan: string;
  aadhaarLast4: string;
  selfieDone: boolean;
  payout: { kind: 'upi'; upiId: string } | { kind: 'bank'; account: string; ifsc: string };
  agreedAt: number;
};

/** What an earning line is, stored as data so it can be shown in any app language. */
export type EarningLabel =
| { kind: 'call'; type: 'audio' | 'video'; name: string }
| { kind: 'gift'; gift: Gift['id']; name: string }
| { kind: 'lastWeek' }
| { kind: 'thisWeek' }
| { kind: 'bonus' }
| { kind: 'withdrawal' };

export type EarningEntry = {
id: string;
paise: number;
reason: 'call_earning' | 'gift_earning' | 'bonus' | 'payout';
/** Older saved entries may still hold a plain English string. */
label: EarningLabel | string;
  createdAt: number;
  availableAt: number;
};

export type HostCall = { id: string; callerName: string; avatarKey: string; type: 'audio' | 'video'; startedAt: number; durationSec: number; earnedPaise: number };

export type HostReview = { id: string; author: string; avatarKey: string; stars: number; tags: string[]; text: string; createdAt: number };

/** Rings and answers in the last 30 days; answerRate for the Spotlight Score is derived from these. */
type RingStats = { rung: number; answered: number };

export type PayoutRequest = { id: string; amountPaise: number; status: 'requested' | 'approved' | 'paid' | 'rejected'; createdAt: number };

type HostState = {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  application: HostApplication | null;
  online: boolean;
  level: 1 | 2 | 3 | 4;
  minutes30d: number;
  rating: number;
  strikes: number;
  earnings: EarningEntry[];
  payouts: PayoutRequest[];
  calls: HostCall[];
  reviews: HostReview[];
  /** Trailing-30-day behaviour behind her Spotlight Score (answerRate comes from `rings`). */
  qualityStats: QualityInput;
  rings: RingStats;
  submitApplication: (app: HostApplication) => void;
  /** Demo only: admin approval happens in the admin panel. */
  simulateApproval: () => void;
  setOnline: (online: boolean) => void;
  addEarning: (e: Omit<EarningEntry, 'id' | 'createdAt' | 'availableAt'>, minutes?: number) => void;
  /** Records a finished call and updates her call-length and volume stats. */
  addCall: (call: Omit<HostCall, 'id'>) => void;
  /** A caller's rating after a call; updates her rating stats. */
  addReview: (review: Omit<HostReview, 'id' | 'createdAt'>) => void;
  /** Every incoming ring, answered or not (declines and missed calls lower the answer rate). */
  recordRing: (answered: boolean) => void;
  requestPayout: (amountPaise: number) => { ok: boolean; error?: 'belowMin' | 'aboveAvailable' };
  reset: () => void;
};

const DAY = 86_400_000;

const EMPTY_STATS: QualityInput = { ratingAvg: 0, ratingCount: 0, repeatCallerRate: 0, avgCallMinutes: 0, answerRate: 0, reportRate: 0, activeDays: 0, calls30d: 0, strikes: 0 };

/** Her stats with answerRate derived from rings. */
export function hostQualityInput(stats: QualityInput, rings: RingStats, strikes: number): QualityInput {
  return { ...stats, answerRate: rings.rung ? rings.answered / rings.rung : 1, strikes };
}

export const useHost = create<HostState>()(
  persist(
    (set, get) => ({
      status: 'none',
      application: null,
      online: false,
      level: 1,
      minutes30d: 0,
      rating: 0,
      strikes: 0,
      earnings: [],
      payouts: [],
      calls: [],
      reviews: [],
      qualityStats: EMPTY_STATS,
      rings: { rung: 0, answered: 0 },
      submitApplication: (application) => set({ application, status: 'pending' }),
      simulateApproval: () => {
        const now = Date.now();
        // Seed a little history so the dashboard is meaningful in the demo.
        const seed: EarningEntry[] = [
          { id: 'seed1', paise: 52_500, reason: 'call_earning', label: { kind: 'lastWeek' }, createdAt: now - 10 * DAY, availableAt: now - 3 * DAY },
          { id: 'seed2', paise: 18_000, reason: 'bonus', label: { kind: 'bonus' }, createdAt: now - 9 * DAY, availableAt: now - 2 * DAY },
          { id: 'seed3', paise: 23_600, reason: 'call_earning', label: { kind: 'thisWeek' }, createdAt: now - 2 * DAY, availableAt: now + 5 * DAY },
        ];
        const calls: HostCall[] = [
          { id: 'sc1', callerName: 'Rahul', avatarKey: 'moon', type: 'audio', startedAt: now - 2 * DAY, durationSec: 734, earnedPaise: 2_048 },
          { id: 'sc2', callerName: 'Vikram', avatarKey: 'rocket', type: 'video', startedAt: now - 3 * DAY, durationSec: 421, earnedPaise: 2_100 },
        ];
        const reviews: HostReview[] = [
          { id: 'sr1', author: 'Rahul', avatarKey: 'moon', stars: 5, tags: ['Friendly', 'Good listener'], text: 'Felt like talking to an old friend. Made my evening.', createdAt: now - 2 * DAY },
          { id: 'sr2', author: 'Vikram', avatarKey: 'rocket', stars: 4, tags: ['Respectful'], text: 'Very polite and easy to talk to.', createdAt: now - 3 * DAY },
          { id: 'sr3', author: 'Sai', avatarKey: 'leaf', stars: 5, tags: ['Great advice'], text: 'Gave me really useful advice. Will call again!', createdAt: now - 5 * DAY },
        ];
        // Her first week, so the score has a starting point.
        const qualityStats: QualityInput = { ...EMPTY_STATS, ratingAvg: 4.6, ratingCount: 24, repeatCallerRate: 0.3, avgCallMinutes: 9.5, activeDays: 7, calls30d: 24 };
        set({ status: 'approved', level: 1, minutes30d: 212, rating: 4.6, earnings: seed, calls, reviews, qualityStats, rings: { rung: 26, answered: 24 } });
      },
      setOnline: (online) => set({ online }),
      addEarning: (e, minutes = 0) => {
        const now = Date.now();
        set((s) => ({
          minutes30d: s.minutes30d + minutes,
          earnings: [{ ...e, id: `e${now}`, createdAt: now, availableAt: now + appConfig.holdDays * DAY }, ...s.earnings],
        }));
      },
      addCall: (call) =>
        set((s) => {
          const q = s.qualityStats;
          const n = q.calls30d + 1;
          return {
            calls: [{ ...call, id: `hc${call.startedAt}` }, ...s.calls],
            qualityStats: { ...q, calls30d: n, avgCallMinutes: (q.avgCallMinutes * q.calls30d + call.durationSec / 60) / n },
          };
        }),
      addReview: (review) =>
        set((s) => {
          const q = s.qualityStats;
          const count = q.ratingCount + 1;
          const ratingAvg = (q.ratingAvg * q.ratingCount + review.stars) / count;
          return {
            reviews: [{ ...review, id: `rv${Date.now()}`, createdAt: Date.now() }, ...s.reviews],
            qualityStats: { ...q, ratingAvg, ratingCount: count },
            rating: Math.round(ratingAvg * 10) / 10,
          };
        }),
      recordRing: (answered) => set((s) => ({ rings: { rung: s.rings.rung + 1, answered: s.rings.answered + (answered ? 1 : 0) } })),
      requestPayout: (amountPaise) => {
        const { available } = hostBalances(get().earnings);
        if (amountPaise < appConfig.minWithdrawalPaise) return { ok: false, error: 'belowMin' };
        if (amountPaise > available) return { ok: false, error: 'aboveAvailable' };
        const now = Date.now();
        set((s) => ({
          payouts: [{ id: `p${now}`, amountPaise, status: 'requested', createdAt: now }, ...s.payouts],
          earnings: [{ id: `w${now}`, paise: -amountPaise, reason: 'payout', label: { kind: 'withdrawal' }, createdAt: now, availableAt: now }, ...s.earnings],
        }));
        return { ok: true };
      },
      reset: () => set({ status: 'none', application: null, online: false, level: 1, minutes30d: 0, rating: 0, strikes: 0, earnings: [], payouts: [], calls: [], reviews: [], qualityStats: EMPTY_STATS, rings: { rung: 0, answered: 0 } }),
    }),
    { name: 'host', storage: persistStorage },
  ),
);

export function hostBalances(earnings: EarningEntry[], now: number = Date.now()) {
  let pending = 0;
  let available = 0;
  let lifetime = 0;
  let today = 0;
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  for (const e of earnings) {
    if (e.reason === 'payout') {
      available += e.paise;
      continue;
    }
    lifetime += e.paise;
    if (e.createdAt >= startOfDay) today += e.paise;
    if (e.availableAt <= now) available += e.paise;
    else pending += e.paise;
  }
  return { pending, available, lifetime, today };
}

/** True once the persisted host data has loaded (subscribe-safe, no effect needed). */
export function useHostHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useHost.persist.onFinishHydration(cb),
    () => useHost.persist.hasHydrated(),
    () => false,
  );
}
