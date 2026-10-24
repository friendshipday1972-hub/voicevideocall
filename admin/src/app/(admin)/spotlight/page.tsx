'use client';

import { AlertTriangle, Ribbon, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { RiskPill, ScoreBar, TierPill } from '@/components/quality';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, DataTable, EmptyState, PageHeader, Pill, toast, type Column } from '@/components/ui';
import { hostQuality } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Host } from '@/lib/data/types';
import { spotlightOrder, type QualityResult } from '@/lib/quality';

type Row = { id: string; h: Host; quality: QualityResult; featured: boolean };

const WEIGHTS = [
  ['Ratings', 35, 'Bayesian average: a new host starts at 4.0 with 20 “virtual” ratings, so 3 perfect reviews can’t beat 300 great ones.'],
  ['Callers return', 20, 'Share of callers who call her again within 30 days. The strongest sign of a good impression.'],
  ['Call length', 15, 'Average minutes per call (full marks at 12+).'],
  ['Answers calls', 15, 'Answered ÷ rung while online. Declines and missed calls lower it.'],
  ['Safety', 10, 'Upheld reports per call. 2% or more scores zero here.'],
  ['Regularly online', 5, 'Days online in the last 30 (full marks at 20).'],
] as const;

function SpotlightPageView() {
  const data = useAdmin();
  const rows: Row[] = useMemo(() => data.hosts.filter((h) => h.status === 'active').map((h) => ({ id: h.id, h, quality: hostQuality(h), featured: h.featured })), [data.hosts]);
  const preview = spotlightOrder(rows, 8, data.config.spotlightMinScore);
  const rising = rows.filter((r) => r.quality.tier === 'rising_star').sort((a, b) => b.quality.score - a.quality.score);
  const atRisk = rows.filter((r) => r.quality.atRisk).sort((a, b) => a.quality.score - b.quality.score);

  const toggleFeature = (r: Row) => {
    data.setFeatured(r.id, !r.featured);
    toast.good(r.featured ? `${r.h.name} removed from featured` : `${r.h.name} featured: +8 ranking boost`);
  };

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Host',
      sort: (r) => r.h.name,
      cell: ({ h, featured }) => (
        <Link href={`/hosts/${h.id}`} className="flex items-center gap-2.5 hover:underline">
          <Avatar name={h.name} colors={h.colors} size={30} />
          <span className="font-medium">{h.name}</span>
          {featured && <Ribbon className="size-3.5 text-brand" aria-label="Featured" />}
        </Link>
      ),
    },
    { key: 'score', header: 'Score', sort: (r) => r.quality.score, cell: (r) => <ScoreBar score={r.quality.score} /> },
    { key: 'tier', header: 'Tier', cell: (r) => (r.quality.atRisk ? <RiskPill /> : <TierPill tier={r.quality.tier} />) },
    ...(['rating', 'repeat', 'engagement', 'reliability', 'safety', 'consistency'] as const).map((key) => ({
      key,
      header: { rating: 'Ratings', repeat: 'Return', engagement: 'Length', reliability: 'Answers', safety: 'Safety', consistency: 'Online' }[key],
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
          {r.featured ? 'Featured' : 'Feature'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Spotlight & rankings" description="Hosts who make the best impression are noticed automatically and shown first to callers. The score uses only behaviour that reflects good conversations, never looks." />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="What callers see first" description="The “In the spotlight” row in the app. Every 4th slot goes to a rising star so new hosts get a fair chance.">
          {preview.length === 0 ? (
            <EmptyState icon={Sparkles} title="No hosts qualify yet" />
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {preview.map((r, i) => (
                <li key={r.id}>
                  <Link href={`/hosts/${r.id}`} className="flex h-full flex-col items-center gap-2 rounded-xl p-3 text-center text-white transition-transform duration-150 hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${r.h.colors[0]}, ${r.h.colors[1]})` }}>
                    <span className="self-start text-xs font-semibold opacity-80">#{i + 1}</span>
                    <span className="font-display text-3xl font-semibold">{r.h.name[0]}</span>
                    <span className="text-sm font-medium">{r.h.name}</span>
                    <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px]">
                      {r.quality.tier === 'rising_star' ? 'Rising star' : r.quality.tier === 'spotlight' ? 'Spotlight' : r.quality.tier === 'top_rated' ? 'Top rated' : `Score ${r.quality.score}`}
                      {r.featured ? ' · Featured' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card className="xl:col-span-2" title="How the score works" description="0–100, recalculated nightly (live in this prototype)">
          <ul className="flex flex-col gap-2.5">
            {WEIGHTS.map(([label, w, text]) => (
              <li key={label} className="flex gap-3 text-sm">
                <span className="tabular w-9 shrink-0 font-display font-semibold text-data">{w}</span>
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-xs text-fg-3">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-1.5 border-t border-line pt-3 text-xs text-fg-2">
            <p className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-gold" aria-hidden /> Spotlight: 85+ with 50+ calls a month</p>
            <p className="flex items-center gap-1.5"><Ribbon className="size-3.5 text-info" aria-hidden /> Top rated: 72+ with 50+ calls a month</p>
            <p className="flex items-center gap-1.5"><TrendingUp className="size-3.5 text-good" aria-hidden /> Rising star: new host (&lt;50 calls) scoring 68+</p>
            <p className="flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-bad" aria-hidden /> At risk: under 45, report rate over 1.5%, or 2+ strikes. Hidden from Spotlight.</p>
            <p>Each strike removes the tier and cuts the score by 15%. Featured hosts get +8 in ranking.</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Rising stars" description="New hosts off to a great start. Consider featuring them.">
          {rising.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No rising stars right now" />
          ) : (
            <ul className="flex flex-col gap-2">
              {rising.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line p-2.5">
                  <Avatar name={r.h.name} colors={r.h.colors} />
                  <Link href={`/hosts/${r.id}`} className="flex-1 text-sm font-medium hover:underline">
                    {r.h.name} <span className="font-normal text-fg-3">· {r.h.stats.calls30d} calls · ★ {r.h.stats.ratingAvg.toFixed(1)}</span>
                  </Link>
                  <ScoreBar score={r.quality.score} />
                  <Button size="sm" variant={r.featured ? 'secondary' : 'primary'} icon={Ribbon} onClick={() => toggleFeature(r)}>
                    {r.featured ? 'Featured' : 'Feature'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="At risk" description="Low score or too many reports. Coach, warn or review.">
          {atRisk.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Nobody at risk" />
          ) : (
            <ul className="flex flex-col gap-2">
              {atRisk.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-2.5">
                  <Avatar name={r.h.name} colors={r.h.colors} />
                  <Link href={`/hosts/${r.id}`} className="flex-1 text-sm font-medium hover:underline">
                    {r.h.name}
                  </Link>
                  <Pill tone="bad">Reports {(r.h.stats.reportRate * 100).toFixed(1)}%</Pill>
                  {r.h.strikes > 0 && <Pill tone="bad">{r.h.strikes} strikes</Pill>}
                  <ScoreBar score={r.quality.score} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4" title="Leaderboard" description="Every factor as a percentage of its maximum. Under 50% is highlighted.">
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
