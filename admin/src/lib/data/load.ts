'use client';

import { supabase } from '@/lib/supabase';

import type { AppConfig, Application, AuditEntry, Call, Dataset, Host, LanguageCode, Payout, Purchase, Report, User } from './types';

const DAY = 86_400_000;

const GRADIENTS: [string, string][] = [
  ['#F472B6', '#7C3AED'],
  ['#FB923C', '#E11D48'],
  ['#34D399', '#0EA5E9'],
  ['#A78BFA', '#DB2777'],
  ['#FBBF24', '#F43F5E'],
  ['#2DD4BF', '#6366F1'],
  ['#F87171', '#9333EA'],
  ['#60A5FA', '#E11D48'],
  ['#FCA5A5', '#F59E0B'],
  ['#F0ABFC', '#BE123C'],
  ['#86EFAC', '#7C3AED'],
  ['#FDE68A', '#DB2777'],
];

/** Same gradient the app shows for this host (picked from her id). */
export function hostColors(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

const ms = (v: string | null | undefined) => (v ? Date.parse(v) : 0);
const ageOf = (dob: string | null) => {
  if (!dob) return 0;
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
};

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function all(table: string, build?: (q: any) => any): Promise<Row[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const base = supabase.from(table).select('*');
  const { data, error } = await (build ? build(base) : base);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export const DEFAULT_CONFIG: AppConfig = {
  coinValuePaise: 75,
  audioRate: 6,
  videoRate: 10,
  hostShareBps: [3500, 4000, 4500, 5000],
  giftShareBps: 6000,
  minWithdrawalPaise: 50_000,
  holdDays: 7,
  trialCoins: 6,
  refundUnderSeconds: 10,
  spotlightMinScore: 60,
};

export const EMPTY_DATASET: Dataset = { generatedAt: 0, users: [], hosts: [], applications: [], calls: [], purchases: [], payouts: [], reports: [], audit: [], config: DEFAULT_CONFIG };

/** Everything the dashboard shows, read live from the database (the admin's RLS role allows it). */
export async function loadDataset(): Promise<Dataset> {
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const [profiles, hosts, kyc, stats, wallets, calls, ratings, purchases, packs, payouts, reports, audit, [config]] = await Promise.all([
    all('profiles', (q) => q.in('role', ['user', 'host'])),
    all('hosts'),
    all('host_private'),
    all('host_stats'),
    all('wallets'),
    all('call_sessions', (q) => q.not('started_at', 'is', null).gte('created_at', since).order('created_at', { ascending: false }).limit(5000)),
    all('ratings', (q) => q.gte('created_at', since).limit(5000)),
    all('purchases', (q) => q.order('created_at', { ascending: false }).limit(5000)),
    all('coin_packs'),
    all('payout_requests', (q) => q.order('created_at', { ascending: false }).limit(500)),
    all('reports', (q) => q.order('created_at', { ascending: false }).limit(1000)),
    all('audit_log', (q) => q.order('id', { ascending: false }).limit(500)),
    all('app_config'),
  ]);

  const profile = new Map(profiles.map((p) => [p.id, p]));
  const kycOf = new Map(kyc.map((k) => [k.host_id, k]));
  const statsOf = new Map(stats.map((s) => [s.host_id, s]));
  const coinsOf = new Map(wallets.map((w) => [w.user_id, Number(w.coin_balance)]));
  const ratingOf = new Map(ratings.map((r) => [r.session_id, r]));
  const packName = new Map(packs.map((p) => [p.id, p.name]));
  const spentOf = new Map<string, number>();
  for (const p of purchases) if (p.status === 'verified') spentOf.set(p.user_id, (spentOf.get(p.user_id) ?? 0) + Number(p.price_paise));

  const payoutText = (k: Row | undefined) => (!k ? '—' : k.payout_kind === 'upi' ? `UPI · ${k.upi_id}` : `Bank ····${String(k.bank_account ?? '').slice(-4)} · ${k.bank_ifsc ?? ''}`);

  const users: User[] = profiles
    .filter((p) => p.role === 'user')
    .map((p) => ({
      id: p.id,
      name: p.display_name,
      phone: p.phone ? `+${String(p.phone).replace(/^\+/, '')}` : '—',
      age: ageOf(p.date_of_birth),
      city: '',
      languages: p.languages as LanguageCode[],
      joinedAt: ms(p.created_at),
      lastActiveAt: ms(p.last_active_at),
      status: p.status,
      coins: coinsOf.get(p.id) ?? 0,
      spentPaise: spentOf.get(p.id) ?? 0,
      device: p.device ?? '—',
      flags: p.flags ?? [],
    }));

  const hostRows: Host[] = hosts
    .filter((h) => h.approval_status === 'approved')
    .map((h) => {
      const p = profile.get(h.id) ?? {};
      const s = statsOf.get(h.id) ?? {};
      const k = kycOf.get(h.id);
      return {
        id: h.id,
        name: p.display_name ?? '—',
        age: ageOf(p.date_of_birth),
        city: h.city ?? '',
        phone: p.phone ? `+${String(p.phone).replace(/^\+/, '')}` : '—',
        languages: (p.languages ?? []) as LanguageCode[],
        bio: h.bio ?? '',
        level: h.level,
        levelOverride: h.level_override,
        status: p.status === 'active' ? 'active' : p.status === 'suspended' ? 'suspended' : 'banned',
        presence: h.presence,
        featured: h.featured,
        joinedAt: ms(h.decided_at ?? h.created_at),
        stats: {
          ratingAvg: Number(s.rating_avg ?? 0),
          ratingCount: Number(s.rating_count ?? 0),
          repeatCallerRate: Number(s.repeat_caller_rate ?? 0),
          avgCallMinutes: Number(s.avg_call_minutes ?? 0),
          answerRate: Number(s.answer_rate ?? 1),
          reportRate: Number(s.report_rate ?? 0),
          activeDays: Number(s.active_days ?? 0),
          calls30d: Number(s.calls30d ?? 0),
        },
        strikes: h.strikes,
        kyc: { pan: k?.pan ?? '', aadhaarLast4: k?.aadhaar_last4 ?? '', faceMatch: null },
        payout: payoutText(k),
        colors: hostColors(h.id),
      };
    });

  // One PAN, one host: flag applications whose PAN is already used by another host.
  const panOwner = new Map<string, string>();
  for (const k of kyc) if (k.pan) panOwner.set(k.pan, panOwner.has(k.pan) ? panOwner.get(k.pan)! : k.host_id);

  const applications: Application[] = hosts.map((h) => {
    const p = profile.get(h.id) ?? {};
    const k = kycOf.get(h.id);
    const owner = k?.pan ? panOwner.get(k.pan) : undefined;
    return {
      id: h.id,
      name: p.display_name ?? '—',
      age: ageOf(p.date_of_birth),
      city: h.city ?? '',
      phone: p.phone ? `+${String(p.phone).replace(/^\+/, '')}` : '—',
      languages: (p.languages ?? []) as LanguageCode[],
      bio: h.bio ?? '',
      pan: k?.pan ?? '',
      aadhaarLast4: k?.aadhaar_last4 ?? '',
      gender: p.gender ?? 'other',
      faceMatch: null,
      selfieDone: !!k?.selfie_done,
      duplicateOf: owner && owner !== h.id ? owner : null,
      payout: payoutText(k),
      submittedAt: ms(h.submitted_at),
      status: h.approval_status,
      decisionNote: h.decision_note ?? undefined,
      decidedAt: h.decided_at ? ms(h.decided_at) : undefined,
    };
  });

  const callRows: Call[] = calls.map((c) => {
    const r = ratingOf.get(c.id);
    return {
      id: c.id,
      userId: c.caller_id,
      hostId: c.host_id,
      type: c.type,
      language: (c.language ?? 'en') as LanguageCode,
      startedAt: ms(c.started_at),
      durationSec: c.ended_at ? Math.max(0, Math.round((ms(c.ended_at) - ms(c.started_at)) / 1000)) : Math.round((Date.now() - ms(c.started_at)) / 1000),
      coins: c.coins_charged - c.refunded_coins,
      refundedCoins: c.refunded_coins,
      giftCoins: c.gift_coins,
      hostEarnedPaise: Number(c.host_earned_paise),
      endReason: c.end_reason ?? 'caller_hangup',
      rating: r?.stars,
      tags: r?.tags ?? undefined,
      comment: r?.comment ?? undefined,
      reviewHidden: r?.hidden ?? false,
    };
  });

  const purchaseRows: Purchase[] = purchases.map((p) => ({
    id: p.id,
    userId: p.user_id,
    pack: packName.get(p.pack_id) ?? p.pack_id ?? '—',
    pricePaise: Number(p.price_paise),
    coins: p.coins_granted,
    platform: p.platform === 'ios' ? 'ios' : 'android',
    createdAt: ms(p.created_at),
    status: p.status === 'refunded' ? 'refunded' : 'verified',
  }));

  const payoutRows: Payout[] = payouts.map((p) => ({
    id: p.id,
    hostId: p.host_id,
    amountPaise: Number(p.amount_paise),
    tdsPaise: Number(p.tds_paise),
    method: p.method,
    status: p.status,
    requestedAt: ms(p.created_at),
    decidedAt: p.decided_at ? ms(p.decided_at) : undefined,
    note: p.note ?? undefined,
  }));

  const reportRows: Report[] = reports.map((r) => ({
    id: r.id,
    reporterId: r.reporter_id,
    reporterRole: r.reporter_role,
    targetId: r.target_id,
    targetRole: r.target_role,
    callId: r.session_id ?? undefined,
    category: r.category,
    details: r.details ?? '',
    severity: r.severity,
    status: r.status,
    createdAt: ms(r.created_at),
    decision: r.decision ?? undefined,
    resolution: r.resolution ?? undefined,
    resolvedAt: r.resolved_at ? ms(r.resolved_at) : undefined,
  }));

  const auditRows: AuditEntry[] = audit.map((a) => ({
    id: String(a.id),
    at: ms(a.at),
    actor: a.actor_email,
    action: a.action,
    vars: a.vars ?? undefined,
    targetType: a.target_type,
    targetId: a.target_id,
    detail: a.detail ?? '',
  }));

  const cfg: AppConfig = config
    ? {
        coinValuePaise: config.coin_value_paise,
        audioRate: config.audio_rate,
        videoRate: config.video_rate,
        hostShareBps: config.host_share_bps as AppConfig['hostShareBps'],
        giftShareBps: config.gift_share_bps,
        minWithdrawalPaise: config.min_withdrawal_paise,
        holdDays: config.hold_days,
        trialCoins: config.trial_coins,
        refundUnderSeconds: config.refund_under_seconds,
        spotlightMinScore: config.spotlight_min_score,
      }
    : DEFAULT_CONFIG;

  return { generatedAt: Date.now(), users, hosts: hostRows, applications, calls: callRows, purchases: purchaseRows, payouts: payoutRows, reports: reportRows, audit: auditRows, config: cfg };
}
