import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { Gift, LanguageCode } from '@/data/catalog';
import type { QualityInput } from '@/lib/quality';
import { errorCode, rpc, supabase } from '@/lib/supabase';

import { callDuration, type MyCallRow } from './social';

export type HostApplication = {
  displayName: string;
  bio: string;
  city: string;
  languages: LanguageCode[];
  pan: string;
  aadhaarLast4: string;
  selfieDone: boolean;
  payout: { kind: 'upi'; upiId: string } | { kind: 'bank'; account: string; ifsc: string };
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

export type PayoutRequest = { id: string; amountPaise: number; status: 'requested' | 'approved' | 'paid' | 'rejected'; createdAt: number };

/** Where her payouts go, shown masked. */
export type PayoutTarget = { kind: 'upi'; upiId: string } | { kind: 'bank'; last4: string } | null;

type HostState = {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  decisionNote: string | null;
  payoutTarget: PayoutTarget;
  bio: string;
  city: string;
  /** Masked ID details she submitted, e.g. AB•••••4F and the Aadhaar last 4. */
  idSummary: { pan: string; aadhaarLast4: string } | null;
  online: boolean;
  level: 1 | 2 | 3 | 4;
  minutes30d: number;
  rating: number;
  strikes: number;
  earnings: EarningEntry[];
  payouts: PayoutRequest[];
  calls: HostCall[];
  reviews: HostReview[];
  /** Trailing-30-day behaviour behind her Spotlight Score, computed by the server. */
  qualityStats: QualityInput;
  /** Her host record has been checked at least once (status is known). */
  loaded: boolean;
  refresh: () => Promise<void>;
  submitApplication: (app: HostApplication) => Promise<void>;
  setOnline: (online: boolean) => Promise<void>;
  requestPayout: (amountPaise: number) => Promise<{ ok: boolean; error?: 'belowMin' | 'aboveAvailable' | 'network' }>;
  /** Live updates for her approval, presence, earnings, payouts and reviews. Returns the unsubscribe. */
  start: (userId: string) => () => void;
  reset: () => void;
};

const EMPTY_STATS: QualityInput = { ratingAvg: 0, ratingCount: 0, repeatCallerRate: 0, avgCallMinutes: 0, answerRate: 1, reportRate: 0, activeDays: 0, calls30d: 0, strikes: 0 };

/** Her quality input including strikes (kept as a function so screens read the same shape as before). */
export function hostQualityInput(stats: QualityInput, strikes: number): QualityInput {
  return { ...stats, strikes };
}

type EarningRow = { id: number; reason: EarningEntry['reason']; ref_id: string | null; meta: { kind?: string; type?: 'audio' | 'video'; name?: string; gift?: Gift['id'] }; paise: number; created_at: string; available_at: string };

function earningLabel(r: EarningRow): EarningLabel {
  const m = r.meta ?? {};
  if (r.reason === 'payout') return { kind: 'withdrawal' };
  if (r.reason === 'gift_earning' && m.gift) return { kind: 'gift', gift: m.gift, name: m.name ?? '' };
  if (r.reason === 'call_earning') return { kind: 'call', type: m.type ?? 'audio', name: m.name ?? '' };
  return { kind: 'bonus' };
}

const INITIAL = {
  status: 'none' as const,
  decisionNote: null,
  payoutTarget: null,
  bio: '',
  city: '',
  idSummary: null,
  online: false,
  level: 1 as const,
  minutes30d: 0,
  rating: 0,
  strikes: 0,
  earnings: [],
  payouts: [],
  calls: [],
  reviews: [],
  qualityStats: EMPTY_STATS,
  loaded: false,
};

export const useHost = create<HostState>()((set, get) => ({
  ...INITIAL,
  refresh: async () => {
    const [{ data: me }, { data: kyc }] = await Promise.all([supabase.from('my_host').select('*').maybeSingle(), supabase.from('host_private').select('pan, aadhaar_last4').maybeSingle()]);
    if (!me) {
      set({ status: 'none', loaded: true });
      return;
    }
    const base = {
      status: me.approval_status as HostState['status'],
      decisionNote: me.decision_note,
      bio: me.bio ?? '',
      city: me.city ?? '',
      idSummary: kyc ? { pan: kyc.pan ? `${kyc.pan.slice(0, 2)}•••••${kyc.pan.slice(-2)}` : '', aadhaarLast4: kyc.aadhaar_last4 ?? '' } : null,
      payoutTarget: (me.payout_kind === 'upi' ? { kind: 'upi', upiId: me.upi_id } : me.payout_kind === 'bank' ? { kind: 'bank', last4: me.bank_last4 } : null) as PayoutTarget,
      online: me.presence !== 'offline',
      level: (me.level_override ?? me.level) as HostState['level'],
      minutes30d: me.minutes30d,
      rating: Math.round(me.rating_avg * 10) / 10,
      strikes: me.strikes,
      qualityStats: {
        ratingAvg: me.rating_avg,
        ratingCount: me.rating_count,
        repeatCallerRate: me.repeat_caller_rate,
        avgCallMinutes: me.avg_call_minutes,
        answerRate: me.answer_rate,
        reportRate: me.report_rate,
        activeDays: me.active_days,
        calls30d: me.calls30d,
        strikes: me.strikes,
      },
      loaded: true,
    };
    if (me.approval_status !== 'approved') {
      set(base);
      return;
    }
    const [{ data: earnings }, { data: payouts }, { data: calls }, { data: reviews }] = await Promise.all([
      supabase.from('my_earnings').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('payout_requests').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('my_calls').select('*').eq('host_id', me.id).not('started_at', 'is', null).order('created_at', { ascending: false }).limit(100),
      supabase.from('public_reviews').select('*').eq('host_id', me.id).order('created_at', { ascending: false }).limit(100),
    ]);
    set({
      ...base,
      earnings: (earnings ?? []).map((r) => {
        const row = r as EarningRow;
        return { id: String(row.id), paise: Number(row.paise), reason: row.reason, label: earningLabel(row), createdAt: Date.parse(row.created_at), availableAt: Date.parse(row.available_at) };
      }),
      payouts: (payouts ?? []).map((p) => ({ id: p.id, amountPaise: Number(p.amount_paise), status: p.status, createdAt: Date.parse(p.created_at) })),
      calls: (calls ?? []).map((c) => {
        const row = c as MyCallRow;
        return { id: row.id, callerName: row.caller_name, avatarKey: row.caller_avatar ?? 'sun', type: row.type, startedAt: Date.parse(row.started_at ?? row.created_at), durationSec: callDuration(row), earnedPaise: Number(row.host_earned_paise) };
      }),
      reviews: (reviews ?? []).map((r) => ({ id: r.id, author: r.author, avatarKey: r.avatar_key ?? 'sun', stars: r.stars, tags: r.tags ?? [], text: r.comment ?? '', createdAt: Date.parse(r.created_at) })),
    });
  },
  submitApplication: async (app) => {
    await rpc('submit_host_application', {
      p_display_name: app.displayName,
      p_bio: app.bio,
      p_city: app.city,
      p_languages: app.languages,
      p_pan: app.pan,
      p_aadhaar_last4: app.aadhaarLast4,
      p_payout_kind: app.payout.kind,
      p_upi_id: app.payout.kind === 'upi' ? app.payout.upiId : null,
      p_bank_account: app.payout.kind === 'bank' ? app.payout.account : null,
      p_bank_ifsc: app.payout.kind === 'bank' ? app.payout.ifsc : null,
      p_selfie_done: app.selfieDone,
    });
    await get().refresh();
  },
  setOnline: async (online) => {
    set({ online });
    try {
      const presence = await rpc<string>('set_presence', { p_presence: online ? 'online' : 'offline' });
      set({ online: presence !== 'offline' });
    } catch (e) {
      set({ online: !online });
      throw e;
    }
  },
  requestPayout: async (amountPaise) => {
    try {
      await rpc('request_payout', { p_amount_paise: amountPaise });
      await get().refresh();
      return { ok: true };
    } catch (e) {
      const code = errorCode(e);
      return { ok: false, error: code === 'below_min' ? 'belowMin' : code === 'above_available' ? 'aboveAvailable' : 'network' };
    }
  },
  start: (userId) => {
    get().refresh();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => get().refresh(), 800);
    };
    const channel: RealtimeChannel = supabase
      .channel(`host-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hosts', filter: `id=eq.${userId}` }, later)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'earnings_ledger', filter: `host_id=eq.${userId}` }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests', filter: `host_id=eq.${userId}` }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings', filter: `host_id=eq.${userId}` }, later)
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  },
  reset: () => set(INITIAL),
}));

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
