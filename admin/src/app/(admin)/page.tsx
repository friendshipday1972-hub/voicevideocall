'use client';

import { AlertTriangle, BadgeCheck, CreditCard, Flag, IndianRupee, PhoneCall, Sparkles, Star, UserRound, UsersRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BarList, BarsChart, TrendChart } from '@/components/charts';
import { ActivityFeed } from '@/components/feed';
import { TierPill } from '@/components/quality';
import { Ready } from '@/components/shell';
import { Avatar, Card, Kpi, PageHeader, cx } from '@/components/ui';
import { formatNumber, formatRupees, hostQuality, overview } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';

const TONE_ICON = { bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info', warn: 'bg-warn-soft text-warn' } as const;

function delta(a: number, b: number) {
  return b === 0 ? undefined : (a - b) / b;
}

function OverviewPageView() {
  const data = useAdmin();
  const [now] = useState(() => Date.now());
  const o = useMemo(() => overview(data, now), [data, now]);
  const k = o.kpis;
  const ranked = useMemo(
    () =>
      data.hosts
        .filter((h) => h.status === 'active')
        .map((h) => ({ h, q: hostQuality(h) }))
        .sort((a, b) => b.q.score - a.q.score),
    [data.hosts],
  );
  const atRisk = ranked.filter((r) => r.q.atRisk);

  const attention = [
    { href: '/reports', icon: Flag, label: 'Serious reports open', count: k.criticalReports, sub: `${k.openReports} open in total`, tone: 'bad' as const },
    { href: '/applications', icon: BadgeCheck, label: 'Hosts waiting for KYC', count: k.pendingKyc, sub: 'Verify ID & selfie match', tone: 'info' as const },
    { href: '/payments', icon: Wallet, label: 'Payouts to process', count: k.payoutsDue, sub: formatRupees(k.payoutsDuePaise), tone: 'warn' as const },
    { href: '/spotlight', icon: AlertTriangle, label: 'Hosts at risk', count: atRisk.length, sub: 'Low score or reports', tone: 'warn' as const },
  ];

  const funnelTop = o.funnel[0].value;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description={`Everything happening on Baatein · ${new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-1 text-xs font-medium text-good">
            <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
            {k.onlineHosts} hosts online
          </span>
        }
      />

      <section aria-label="Needs your attention" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {attention.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={cx('flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors', a.count > 0 ? 'border-line bg-surface hover:border-fg-3' : 'border-line bg-surface opacity-70 hover:opacity-100')}>
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-lg', a.count > 0 ? TONE_ICON[a.tone] : 'bg-surface-2 text-fg-3')}>
              <a.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{a.label}</span>
              <span className="block truncate text-xs text-fg-3">{a.sub}</span>
            </span>
            <span className="tabular font-display text-2xl font-semibold">{a.count}</span>
          </Link>
        ))}
      </section>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Revenue today" value={formatRupees(k.revenueToday)} delta={delta(k.revenueToday, k.revenueYesterday)} icon={IndianRupee} tone="good" href="/payments" />
        <Kpi label="Calls today" value={formatNumber(k.callsToday)} delta={delta(k.callsToday, k.callsYesterday)} icon={PhoneCall} href="/calls" />
        <Kpi label="Active callers today" value={formatNumber(k.activeToday)} delta={delta(k.activeToday, k.activeYesterday)} icon={UsersRound} href="/users" />
        <Kpi label="Average rating" value={k.avgRating.toFixed(2)} sub={`${formatNumber(k.ratingCount)} ratings`} icon={Star} tone="gold" href="/reviews" />
        <Kpi label="Minutes talked (30d)" value={formatNumber(k.minutes30)} sub={`${(k.refundRate * 100).toFixed(1)}% calls auto-refunded`} icon={UserRound} />
        <Kpi label="Est. platform net (30d)" value={formatRupees(k.net30, true)} sub="after store fee, GST, hosts, calls" icon={CreditCard} tone="brand" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart title="Revenue" description="Coin purchases per day, last 30 days" data={o.series} xKey="label" yKey="revenue" format={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}`} unit="gross" />
        <TrendChart title="Calls" description="Connected calls per day, last 30 days" data={o.series} xKey="label" yKey="calls" format={(v) => String(Math.round(v))} unit="calls" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BarsChart className="lg:col-span-2" title="Peak hours" description="When calls happen (all 30 days). Use this to plan host shifts." data={o.byHour} xKey="label" yKey="calls" format={(v) => String(Math.round(v))} unit="calls" />
        <Card title="Calls by language" description="Last 30 days">
          <BarList items={o.languages.map((l) => ({ label: l.label, value: l.calls }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Conversion funnel" description="Callers who reached each step">
          <BarList items={o.funnel.map((f) => ({ label: f.label, value: f.value, hint: `${Math.round((f.value / funnelTop) * 100)}%` }))} max={funnelTop} />
        </Card>
        <Card title="Rating distribution" description={`${formatNumber(k.ratingCount)} ratings, last 30 days`}>
          <BarList items={o.ratingDist.map((r) => ({ label: r.label, value: r.count }))} />
        </Card>
        <Card title="Money flow (30 days)" description="Estimated, per the unit economics in the build spec">
          <dl className="flex flex-col gap-2 text-sm">
            {[
              ['Callers paid (gross)', k.gross30],
              ['Store fee + GST (est.)', -Math.round((k.gross30 - (k.gross30 * 0.85) / 1.18) / 100) * 100],
              ['Host earnings', -Math.round(k.hostEarned30 / 100) * 100],
            ].map(([label, v]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="text-fg-2">{label}</dt>
                <dd className="tabular font-medium">{formatRupees(v as number)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-2 border-t border-line pt-2">
              <dt className="font-medium">Platform net (after call costs)</dt>
              <dd className="tabular font-semibold text-good">{formatRupees(k.net30)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-fg-3">Have your CA confirm GST/TDS before launch.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          className="lg:col-span-2"
          title="Making the best impression"
          description="Top hosts by Spotlight score"
          action={
            <Link href="/spotlight" className="text-xs font-medium text-brand hover:underline">
              See rankings
            </Link>
          }>
          <ol className="flex flex-col gap-2.5">
            {ranked.slice(0, 6).map(({ h, q }, i) => (
              <li key={h.id}>
                <Link href={`/hosts/${h.id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-surface-2">
                  <span className="tabular w-4 text-xs text-fg-3">{i + 1}</span>
                  <Avatar name={h.name} colors={h.colors} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{h.name}</span>
                    <span className="block text-xs text-fg-3">
                      ★ {h.stats.ratingAvg.toFixed(1)} · {Math.round(h.stats.repeatCallerRate * 100)}% callers return
                    </span>
                  </span>
                  <TierPill tier={q.tier} />
                  <span className="tabular w-8 text-right font-display font-semibold">{q.score}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-3">
            <Sparkles className="size-3.5" aria-hidden /> Shown first to callers in the app.
          </p>
        </Card>
        <Card className="lg:col-span-3" title="Live activity" description="Calls, payments, reviews, reports and admin actions">
          <ActivityFeed limit={12} />
        </Card>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Ready>
      <OverviewPageView />
    </Ready>
  );
}
