import { computeQuality, type QualityResult } from '@/lib/quality';

import type { Call, Dataset, Host } from './types';
import { LANGUAGE_LABEL } from './types';

export const DAY = 86_400_000;

export function hostQuality(h: Host): QualityResult {
  return computeQuality({ ...h.stats, strikes: h.strikes });
}

export function effectiveLevel(h: Host): 1 | 2 | 3 | 4 {
  return h.levelOverride ?? h.level;
}

export function formatRupees(paise: number, compact = false): string {
  const sign = paise < 0 ? '−' : '';
  const rupees = Math.abs(paise) / 100;
  if (compact && rupees >= 100_000) return `${sign}₹${(rupees / 100_000).toFixed(1)}L`;
  if (compact && rupees >= 1000) return `${sign}₹${(rupees / 1000).toFixed(1)}k`;
  const fractional = Math.round(rupees * 100) % 100 !== 0;
  return `${sign}₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: fractional ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const startOfDay = (ts: number) => new Date(ts).setHours(0, 0, 0, 0);

/** Estimated platform net per call, following the unit economics in the build spec (§8.4). */
function platformNetPaise(c: Call, coinValuePaise: number): number {
  const gross = (c.coins + c.giftCoins) * coinValuePaise;
  const afterStore = gross * 0.85; // Google/Apple fee ~15%
  const afterGst = afterStore / 1.18; // GST inclusive
  const infra = (c.type === 'audio' ? 20 : 70) * Math.ceil(c.durationSec / 60); // Agora ~₹0.2 / ₹0.7 per minute
  return Math.round(afterGst - c.hostEarnedPaise - infra);
}

export function overview(d: Dataset, now: number) {
  const today = startOfDay(now);
  const yesterday = today - DAY;
  const inRange = (ts: number, from: number, to: number) => ts >= from && ts < to;

  const verified = d.purchases.filter((p) => p.status === 'verified');
  const revenue = (from: number, to: number) => verified.filter((p) => inRange(p.createdAt, from, to)).reduce((a, p) => a + p.pricePaise, 0);
  const callsIn = (from: number, to: number) => d.calls.filter((c) => inRange(c.startedAt, from, to));
  const activeUsers = (from: number, to: number) => new Set(callsIn(from, to).map((c) => c.userId)).size;

  const callsToday = callsIn(today, now + 1);
  const callsYesterday = callsIn(yesterday, today);
  const rated = d.calls.filter((c) => c.rating && !c.reviewHidden);
  const avgRating = rated.reduce((a, c) => a + (c.rating ?? 0), 0) / Math.max(1, rated.length);
  const minutes30 = Math.round(d.calls.reduce((a, c) => a + c.durationSec, 0) / 60);

  const days = Array.from({ length: 30 }, (_, i) => today - (29 - i) * DAY);
  const series = days.map((day) => {
    const calls = callsIn(day, day + DAY);
    return {
      label: new Date(day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: revenue(day, day + DAY) / 100,
      calls: calls.length,
      minutes: Math.round(calls.reduce((a, c) => a + c.durationSec, 0) / 60),
      net: Math.round(calls.reduce((a, c) => a + platformNetPaise(c, d.config.coinValuePaise), 0) / 100),
    };
  });

  const byHour = Array.from({ length: 24 }, (_, h) => ({ label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`, calls: 0 }));
  for (const c of d.calls) byHour[new Date(c.startedAt).getHours()].calls++;

  const langCounts = new Map<string, number>();
  for (const c of d.calls) langCounts.set(c.language, (langCounts.get(c.language) ?? 0) + 1);
  const languages = [...langCounts.entries()].map(([code, calls]) => ({ label: LANGUAGE_LABEL[code as keyof typeof LANGUAGE_LABEL], calls })).sort((a, b) => b.calls - a.calls);

  const ratingDist = [5, 4, 3, 2, 1].map((stars) => ({ label: `${stars}★`, count: rated.filter((c) => c.rating === stars).length }));

  const signed = d.users.length;
  const purchased = new Set(verified.map((p) => p.userId)).size;
  const called = new Set(d.calls.map((c) => c.userId)).size;
  const callCounts = new Map<string, number>();
  for (const c of d.calls) callCounts.set(c.userId, (callCounts.get(c.userId) ?? 0) + 1);
  const repeat = [...callCounts.values()].filter((n) => n >= 3).length;
  const funnel = [
    { label: 'Signed up', value: signed },
    { label: 'Bought coins', value: purchased },
    { label: 'Made a call', value: called },
    { label: 'Regulars (3+ calls)', value: repeat },
  ];

  const gross30 = revenue(today - 29 * DAY, now + 1);
  const hostEarned30 = d.calls.reduce((a, c) => a + c.hostEarnedPaise, 0);
  const net30 = d.calls.reduce((a, c) => a + platformNetPaise(c, d.config.coinValuePaise), 0);

  return {
    kpis: {
      revenueToday: revenue(today, now + 1),
      revenueYesterday: revenue(yesterday, today),
      callsToday: callsToday.length,
      callsYesterday: callsYesterday.length,
      activeToday: activeUsers(today, now + 1),
      activeYesterday: activeUsers(yesterday, today),
      newUsersToday: d.users.filter((u) => u.joinedAt >= today).length,
      avgRating,
      ratingCount: rated.length,
      minutes30,
      gross30,
      hostEarned30,
      net30,
      openReports: d.reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length,
      criticalReports: d.reports.filter((r) => (r.status === 'open' || r.status === 'reviewing') && r.severity >= 3).length,
      pendingKyc: d.applications.filter((a) => a.status === 'pending').length,
      payoutsDuePaise: d.payouts.filter((p) => p.status === 'requested' || p.status === 'approved').reduce((a, p) => a + p.amountPaise, 0),
      payoutsDue: d.payouts.filter((p) => p.status === 'requested' || p.status === 'approved').length,
      onlineHosts: d.hosts.filter((h) => h.status === 'active' && h.presence !== 'offline').length,
      refundRate: d.calls.filter((c) => c.refundedCoins > 0).length / Math.max(1, d.calls.length),
    },
    series,
    byHour,
    languages,
    ratingDist,
    funnel,
  };
}

export type ActivityItem = { at: number; kind: 'call' | 'purchase' | 'kyc' | 'report' | 'admin' | 'review'; text: string; href?: string };

/** Everything happening on the platform, newest first. */
export function activityFeed(d: Dataset, limit = 40): ActivityItem[] {
  const user = new Map(d.users.map((u) => [u.id, u.name]));
  const host = new Map(d.hosts.map((h) => [h.id, h.name]));
  const items: ActivityItem[] = [
    ...d.calls.slice(0, 60).map((c) => ({
      at: c.startedAt + c.durationSec * 1000,
      kind: 'call' as const,
      text: `${user.get(c.userId)} ↔ ${host.get(c.hostId)} · ${c.type} · ${formatDuration(c.durationSec)}${c.refundedCoins ? ' · auto-refunded' : ''}`,
      href: `/hosts/${c.hostId}`,
    })),
    ...d.calls
      .filter((c) => c.comment)
      .slice(0, 15)
      .map((c) => ({ at: c.startedAt + c.durationSec * 1000 + 60_000, kind: 'review' as const, text: `${user.get(c.userId)} rated ${host.get(c.hostId)} ${c.rating}★: “${c.comment}”`, href: '/reviews' })),
    ...[...d.purchases]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((p) => ({ at: p.createdAt, kind: 'purchase' as const, text: `${user.get(p.userId)} bought ${p.pack} (${formatRupees(p.pricePaise)})${p.status === 'refunded' ? ' · refunded' : ''}`, href: '/payments' })),
    ...d.applications.map((a) => ({ at: a.submittedAt, kind: 'kyc' as const, text: `${a.name} applied to host (${a.city})`, href: '/applications' })),
    ...d.reports.map((r) => ({ at: r.createdAt, kind: 'report' as const, text: `New report against ${r.targetRole === 'host' ? host.get(r.targetId) : user.get(r.targetId)} · severity ${r.severity}`, href: '/reports' })),
    ...d.audit.filter((a) => a.actor !== 'system').map((a) => ({ at: a.at, kind: 'admin' as const, text: `${a.actor}: ${a.action} · ${a.detail}`, href: '/activity' })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** Per-host operational numbers for tables and the host detail page. */
export function hostNumbers(d: Dataset, hostId: string) {
  const calls = d.calls.filter((c) => c.hostId === hostId);
  const rated = calls.filter((c) => c.rating && !c.reviewHidden);
  const earned = calls.reduce((a, c) => a + c.hostEarnedPaise, 0);
  const gifts = calls.reduce((a, c) => a + c.giftCoins, 0);
  const reports = d.reports.filter((r) => r.targetRole === 'host' && r.targetId === hostId);
  const callers = new Set(calls.map((c) => c.userId));
  return {
    calls,
    callCount: calls.length,
    minutes: Math.round(calls.reduce((a, c) => a + c.durationSec, 0) / 60),
    earned,
    gifts,
    reviews: rated,
    reports,
    openReports: reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length,
    uniqueCallers: callers.size,
  };
}

export function userNumbers(d: Dataset, userId: string) {
  const calls = d.calls.filter((c) => c.userId === userId);
  const purchases = d.purchases.filter((p) => p.userId === userId);
  return {
    calls,
    purchases,
    minutes: Math.round(calls.reduce((a, c) => a + c.durationSec, 0) / 60),
    reportsAgainst: d.reports.filter((r) => r.targetRole === 'user' && r.targetId === userId),
    reportsFiled: d.reports.filter((r) => r.reporterRole === 'user' && r.reporterId === userId),
  };
}
