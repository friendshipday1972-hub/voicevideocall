'use client';

import { AlertTriangle, BadgeCheck, CreditCard, Flag, IndianRupee, PhoneCall, Sparkles, Star, UserRound, UsersRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BarList, BarsChart, TrendChart } from '@/components/charts';
import { ActivityFeed } from '@/components/feed';
import { TierPill } from '@/components/quality';
import { Ready } from '@/components/shell';
import { Avatar, Card, Kpi, PageHeader, cx } from '@/components/ui';
import { useLang, useT } from '@/i18n';
import { formatDate, formatNumber, formatRupees, hostQuality, overview } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';

const TONE_ICON = { bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info', warn: 'bg-warn-soft text-warn' } as const;

function delta(a: number, b: number) {
  return b === 0 ? undefined : (a - b) / b;
}

function OverviewPageView() {
  const data = useAdmin();
  const t = useT();
  const lang = useLang();
  const [now] = useState(() => Date.now());
  const o = useMemo(() => overview(data, now, lang), [data, now, lang]);
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
    { href: '/reports', icon: Flag, label: t('overview.seriousReports'), count: k.criticalReports, sub: t('overview.openTotal', { n: k.openReports }), tone: 'bad' as const },
    { href: '/applications', icon: BadgeCheck, label: t('overview.kycWaiting'), count: k.pendingKyc, sub: t('overview.kycSub'), tone: 'info' as const },
    { href: '/payments', icon: Wallet, label: t('overview.payoutsToProcess'), count: k.payoutsDue, sub: formatRupees(k.payoutsDuePaise), tone: 'warn' as const },
    { href: '/spotlight', icon: AlertTriangle, label: t('overview.hostsAtRisk'), count: atRisk.length, sub: t('overview.atRiskSub'), tone: 'warn' as const },
  ];

  const funnelTop = o.funnel[0].value;
  const callsUnit = t('overview.callsUnit');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('overview.title')}
        description={t('overview.description', { date: formatDate(now, lang, { weekday: 'long', day: 'numeric', month: 'long' }) })}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-1 text-xs font-medium text-good">
            <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
            {t('overview.hostsOnline', { n: k.onlineHosts })}
          </span>
        }
      />

      <section aria-label={t('overview.attention')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <section aria-label={t('overview.keyNumbers')} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t('overview.revenueToday')} value={formatRupees(k.revenueToday)} delta={delta(k.revenueToday, k.revenueYesterday)} icon={IndianRupee} tone="good" href="/payments" />
        <Kpi label={t('overview.callsToday')} value={formatNumber(k.callsToday)} delta={delta(k.callsToday, k.callsYesterday)} icon={PhoneCall} href="/calls" />
        <Kpi label={t('overview.activeCallers')} value={formatNumber(k.activeToday)} delta={delta(k.activeToday, k.activeYesterday)} icon={UsersRound} href="/users" />
        <Kpi label={t('overview.avgRating')} value={k.avgRating.toFixed(2)} sub={t('common.ratingsN', { n: formatNumber(k.ratingCount) })} icon={Star} tone="gold" href="/reviews" />
        <Kpi label={t('overview.minutes30')} value={formatNumber(k.minutes30)} sub={t('overview.autoRefundedPct', { n: (k.refundRate * 100).toFixed(1) })} icon={UserRound} />
        <Kpi label={t('overview.net30')} value={formatRupees(k.net30, true)} sub={t('overview.netSub')} icon={CreditCard} tone="brand" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart title={t('overview.revenue')} description={t('overview.revenueDesc')} data={o.series} xKey="label" yKey="revenue" format={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}`} unit={t('overview.gross')} />
        <TrendChart title={t('overview.calls')} description={t('overview.callsDesc')} data={o.series} xKey="label" yKey="calls" format={(v) => String(Math.round(v))} unit={callsUnit} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BarsChart className="lg:col-span-2" title={t('overview.peakHours')} description={t('overview.peakDesc')} data={o.byHour} xKey="label" yKey="calls" format={(v) => String(Math.round(v))} unit={callsUnit} />
        <Card title={t('overview.byLanguage')} description={t('common.last30')}>
          <BarList items={o.languages.map((l) => ({ label: t(`lang.${l.code}`), value: l.calls }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('overview.funnel')} description={t('overview.funnelDesc')}>
          <BarList items={o.funnel.map((f) => ({ label: t(`overview.${f.key}`), value: f.value, hint: `${Math.round((f.value / funnelTop) * 100)}%` }))} max={funnelTop} />
        </Card>
        <Card title={t('overview.ratingDist')} description={t('overview.ratingDistDesc', { n: formatNumber(k.ratingCount) })}>
          <BarList items={o.ratingDist.map((r) => ({ label: r.label, value: r.count }))} />
        </Card>
        <Card title={t('overview.moneyFlow')} description={t('overview.moneyFlowDesc')}>
          <dl className="flex flex-col gap-2 text-sm">
            {(
              [
                [t('overview.callersPaid'), k.gross30],
                [t('overview.storeFee'), -Math.round((k.gross30 - (k.gross30 * 0.85) / 1.18) / 100) * 100],
                [t('overview.hostEarnings'), -Math.round(k.hostEarned30 / 100) * 100],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-fg-2">{label}</dt>
                <dd className="tabular shrink-0 font-medium">{formatRupees(v)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-2 border-t border-line pt-2">
              <dt className="font-medium">{t('overview.platformNet')}</dt>
              <dd className="tabular shrink-0 font-semibold text-good">{formatRupees(k.net30)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-fg-3">{t('overview.caNote')}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          className="lg:col-span-2"
          title={t('overview.bestImpression')}
          description={t('overview.bestImpressionDesc')}
          action={
            <Link href="/spotlight" className="text-xs font-medium text-brand hover:underline">
              {t('overview.seeRankings')}
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
                      ★ {h.stats.ratingAvg.toFixed(1)} · {t('overview.returnPct', { n: Math.round(h.stats.repeatCallerRate * 100) })}
                    </span>
                  </span>
                  <span className="hidden sm:inline">
                    <TierPill tier={q.tier} />
                  </span>
                  <span className="tabular w-8 text-right font-display font-semibold">{q.score}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-3">
            <Sparkles className="size-3.5" aria-hidden /> {t('overview.shownFirst')}
          </p>
        </Card>
        <Card className="lg:col-span-3" title={t('overview.live')} description={t('overview.liveDesc')}>
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
