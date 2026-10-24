'use client';

import { Ribbon, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { RiskPill, ScoreBar, TierPill } from '@/components/quality';
import { AccountStatus, PresencePill } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Card, DataTable, EmptyState, PageHeader, Pill, SearchInput, Tabs, type Column } from '@/components/ui';
import { effectiveLevel, formatNumber, formatRupees, hostNumbers, hostQuality } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import { LANGUAGE_LABEL, type Host } from '@/lib/data/types';
import type { QualityResult } from '@/lib/quality';

type Tab = 'all' | 'online' | 'featured' | 'risk' | 'suspended';
type Row = { h: Host; q: QualityResult; earned: number; calls: number; openReports: number };

function HostsPageView() {
  const data = useAdmin();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');

  const all: Row[] = useMemo(
    () =>
      data.hosts.map((h) => {
        const n = hostNumbers(data, h.id);
        return { h, q: hostQuality(h), earned: n.earned, calls: n.callCount, openReports: n.openReports };
      }),
    [data],
  );

  const rows = all.filter(({ h, q: quality }) => {
    if (tab === 'online' && (h.presence === 'offline' || h.status !== 'active')) return false;
    if (tab === 'featured' && !h.featured) return false;
    if (tab === 'risk' && !quality.atRisk) return false;
    if (tab === 'suspended' && h.status === 'active') return false;
    const term = q.trim().toLowerCase();
    return !term || `${h.name} ${h.city} ${h.phone} ${h.id}`.toLowerCase().includes(term);
  });

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Host',
      sort: (r) => r.h.name,
      cell: ({ h }) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={h.name} colors={h.colors} size={32} />
          <span>
            <span className="flex items-center gap-1 font-medium">
              {h.name}, {h.age}
              {h.featured && <Ribbon className="size-3.5 text-brand" aria-label="Featured" />}
            </span>
            <span className="block text-xs text-fg-3">
              {h.city} · {h.languages.map((l) => LANGUAGE_LABEL[l]).join(', ')}
            </span>
          </span>
        </span>
      ),
    },
    { key: 'level', header: 'Level', sort: (r) => effectiveLevel(r.h), cell: ({ h }) => <span className="tabular">L{effectiveLevel(h)}{h.levelOverride ? '*' : ''}</span> },
    { key: 'score', header: 'Spotlight', sort: (r) => r.q.score, cell: ({ q: quality }) => <ScoreBar score={quality.score} /> },
    { key: 'tier', header: 'Tier', cell: ({ q: quality }) => (quality.atRisk ? <RiskPill /> : <TierPill tier={quality.tier} />) },
    { key: 'rating', header: 'Rating', align: 'right', sort: (r) => r.h.stats.ratingAvg, cell: ({ h }) => `★ ${h.stats.ratingAvg.toFixed(1)}` },
    { key: 'calls', header: 'Calls (30d)', align: 'right', sort: (r) => r.calls, cell: (r) => formatNumber(r.calls) },
    { key: 'earned', header: 'Earned (30d)', align: 'right', sort: (r) => r.earned, cell: (r) => formatRupees(r.earned) },
    { key: 'reports', header: 'Open reports', align: 'right', sort: (r) => r.openReports, cell: (r) => (r.openReports ? <Pill tone="bad">{r.openReports}</Pill> : <span className="text-fg-3">0</span>) },
    { key: 'status', header: 'Status', cell: ({ h }) => (h.status === 'active' ? <PresencePill presence={h.presence} /> : <AccountStatus status={h.status} />) },
  ];

  return (
    <>
      <PageHeader title="Hosts" description="Verified women hosts with their Spotlight score, earnings and safety record." actions={<SearchInput value={q} onChange={setQ} placeholder="Search name, city, phone" />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: all.length },
          { value: 'online', label: 'Online now', count: all.filter((r) => r.h.status === 'active' && r.h.presence !== 'offline').length },
          { value: 'featured', label: 'Featured', count: all.filter((r) => r.h.featured).length },
          { value: 'risk', label: 'At risk', count: all.filter((r) => r.q.atRisk).length },
          { value: 'suspended', label: 'Suspended / banned', count: all.filter((r) => r.h.status !== 'active').length },
        ]}
      />
      <Card>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.h.id} onRowClick={(r) => router.push(`/hosts/${r.h.id}`)} initialSort={{ key: 'score', dir: 'desc' }} empty={<EmptyState icon={UserRound} title="No hosts match" />} />
      </Card>
    </>
  );
}

export default function HostsPage() {
  return (
    <Ready>
      <HostsPageView />
    </Ready>
  );
}
