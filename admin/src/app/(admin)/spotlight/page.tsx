'use client';

import { AlertTriangle, Ribbon, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { RiskPill, ScoreBar, TierPill } from '@/components/quality';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, DataTable, EmptyState, PageHeader, Pill, toast, type Column } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { hostQuality } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Host } from '@/lib/data/types';
import { spotlightOrder, type QualityFactor, type QualityResult } from '@/lib/quality';

type Row = { id: string; h: Host; quality: QualityResult; featured: boolean };

const WEIGHTS: [QualityFactor['key'], number, TKey][] = [
  ['rating', 35, 'spotlight.wRating'],
  ['repeat', 20, 'spotlight.wRepeat'],
  ['engagement', 15, 'spotlight.wEngagement'],
  ['reliability', 15, 'spotlight.wReliability'],
  ['safety', 10, 'spotlight.wSafety'],
  ['consistency', 5, 'spotlight.wConsistency'],
];

const COLUMN_LABEL: Record<QualityFactor['key'], TKey> = {
  rating: 'spotlight.colRatings',
  repeat: 'spotlight.colReturn',
  engagement: 'spotlight.colLength',
  reliability: 'spotlight.colAnswers',
  safety: 'spotlight.colSafety',
  consistency: 'spotlight.colOnline',
};

function SpotlightPageView() {
  const data = useAdmin();
  const t = useT();
  const rows: Row[] = useMemo(() => data.hosts.filter((h) => h.status === 'active').map((h) => ({ id: h.id, h, quality: hostQuality(h), featured: h.featured })), [data.hosts]);
  const preview = spotlightOrder(rows, 8, data.config.spotlightMinScore);
  const rising = rows.filter((r) => r.quality.tier === 'rising_star').sort((a, b) => b.quality.score - a.quality.score);
  const atRisk = rows.filter((r) => r.quality.atRisk).sort((a, b) => a.quality.score - b.quality.score);

  const toggleFeature = (r: Row) => {
    const message = r.featured ? t('spotlight.removedToast', { name: r.h.name }) : t('spotlight.featuredToast', { name: r.h.name });
    data.setFeatured(r.id, !r.featured).then(() => toast.good(message), () => {});
  };

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: t('common.host'),
      sort: (r) => r.h.name,
      cell: ({ h, featured }) => (
        <Link href={`/hosts/${h.id}`} className="flex items-center gap-2.5 hover:underline">
          <Avatar name={h.name} colors={h.colors} size={30} />
          <span className="font-medium">{h.name}</span>
          {featured && <Ribbon className="size-3.5 text-brand" aria-label={t('common.featured')} />}
        </Link>
      ),
    },
    { key: 'score', header: t('host.score'), sort: (r) => r.quality.score, cell: (r) => <ScoreBar score={r.quality.score} /> },
    { key: 'tier', header: t('common.tier'), cell: (r) => (r.quality.atRisk ? <RiskPill /> : <TierPill tier={r.quality.tier} />) },
    ...(['rating', 'repeat', 'engagement', 'reliability', 'safety', 'consistency'] as const).map((key) => ({
      key,
      header: t(COLUMN_LABEL[key]),
      align: 'right' as const,
      sort: (r: Row) => r.quality.factors.find((f) => f.key === key)?.value ?? 0,
      cell: (r: Row) => {
        const f = r.quality.factors.find((x) => x.key === key);
        const pct = Math.round((f?.value ?? 0) * 100);
        return <span className={pct < 50 ? 'font-medium text-bad' : 'text-fg-2'}>{pct}%</span>;
      },
    })),
    {
      key: 'feature',
      header: '',
      align: 'right',
      cell: (r) => (
        <Button size="sm" variant={r.featured ? 'secondary' : 'ghost'} icon={Ribbon} disabled={r.quality.atRisk && !r.featured} onClick={() => toggleFeature(r)}>
          {r.featured ? t('common.featured') : t('common.feature')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('spotlight.title')} description={t('spotlight.description')} />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title={t('spotlight.seeFirst')} description={t('spotlight.seeFirstDesc')}>
          {preview.length === 0 ? (
            <EmptyState icon={Sparkles} title={t('spotlight.noneQualify')} />
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {preview.map((r, i) => (
                <li key={r.id}>
                  <Link href={`/hosts/${r.id}`} className="flex h-full flex-col items-center gap-2 rounded-xl p-3 text-center text-white transition-transform duration-150 hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${r.h.colors[0]}, ${r.h.colors[1]})` }}>
                    <span className="self-start text-xs font-semibold opacity-80">#{i + 1}</span>
                    <span className="font-display text-3xl font-semibold">{r.h.name[0]}</span>
                    <span className="text-sm font-medium">{r.h.name}</span>
                    <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px]">
                      {r.quality.tier === 'none' ? t('tier.score', { n: r.quality.score }) : t(`tier.${r.quality.tier}`)}
                      {r.featured ? ` · ${t('common.featured')}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card className="xl:col-span-2" title={t('spotlight.howTitle')} description={t('spotlight.howDesc')}>
          <ul className="flex flex-col gap-2.5">
            {WEIGHTS.map(([key, w, text]) => (
              <li key={key} className="flex gap-3 text-sm">
                <span className="tabular w-9 shrink-0 font-display font-semibold text-data">{w}</span>
                <span>
                  <span className="font-medium">{t(`factor.${key}`)}</span>
                  <span className="block text-xs text-fg-3">{t(text)}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-1.5 border-t border-line pt-3 text-xs text-fg-2">
            <p className="flex items-start gap-1.5">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden /> {t('spotlight.ruleSpotlight')}
            </p>
            <p className="flex items-start gap-1.5">
              <Ribbon className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden /> {t('spotlight.ruleTop')}
            </p>
            <p className="flex items-start gap-1.5">
              <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden /> {t('spotlight.ruleRising')}
            </p>
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden /> {t('spotlight.ruleRisk')}
            </p>
            <p>{t('spotlight.ruleStrike')}</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={t('spotlight.rising')} description={t('spotlight.risingDesc')}>
          {rising.length === 0 ? (
            <EmptyState icon={TrendingUp} title={t('spotlight.noRising')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {rising.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-2.5">
                  <Avatar name={r.h.name} colors={r.h.colors} />
                  <Link href={`/hosts/${r.id}`} className="min-w-0 flex-1 text-sm font-medium hover:underline">
                    {r.h.name} <span className="block font-normal text-fg-3 sm:inline">· {t('spotlight.risingLine', { calls: r.h.stats.calls30d, rating: r.h.stats.ratingAvg.toFixed(1) })}</span>
                  </Link>
                  <ScoreBar score={r.quality.score} />
                  <Button size="sm" variant={r.featured ? 'secondary' : 'primary'} icon={Ribbon} onClick={() => toggleFeature(r)}>
                    {r.featured ? t('common.featured') : t('common.feature')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('spotlight.atRisk')} description={t('spotlight.atRiskDesc')}>
          {atRisk.length === 0 ? (
            <EmptyState icon={AlertTriangle} title={t('spotlight.nobodyAtRisk')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {atRisk.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-2.5">
                  <Avatar name={r.h.name} colors={r.h.colors} />
                  <Link href={`/hosts/${r.id}`} className="flex-1 text-sm font-medium hover:underline">
                    {r.h.name}
                  </Link>
                  <Pill tone="bad">{t('spotlight.reportsPct', { n: (r.h.stats.reportRate * 100).toFixed(1) })}</Pill>
                  {r.h.strikes > 0 && <Pill tone="bad">{t('host.strikesN', { n: r.h.strikes })}</Pill>}
                  <ScoreBar score={r.quality.score} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4" title={t('spotlight.leaderboard')} description={t('spotlight.leaderboardDesc')}>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} initialSort={{ key: 'score', dir: 'desc' }} pageSize={20} />
      </Card>
    </>
  );
}

export default function SpotlightPage() {
  return (
    <Ready>
      <SpotlightPageView />
    </Ready>
  );
}
