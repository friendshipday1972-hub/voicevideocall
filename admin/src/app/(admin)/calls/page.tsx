'use client';

import { Download, PhoneCall, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { StarsText } from '@/components/quality';
import { Ready } from '@/components/shell';
import { Button, Card, ConfirmAction, DataTable, EmptyState, Kpi, PageHeader, Pill, SearchInput, Select, toast, type Column } from '@/components/ui';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import { LANGUAGE_LABEL, type Call, type CallEndReason } from '@/lib/data/types';

const END: Record<CallEndReason, string> = { caller_hangup: 'Caller ended', host_hangup: 'Host ended', low_balance: 'Out of coins', network: 'Network drop', moderation: 'Ended by safety' };

function CallsPageView() {
  const data = useAdmin();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | 'audio' | 'video'>('all');
  const [filter, setFilter] = useState<'all' | 'refunded' | 'low' | 'gifts'>('all');
  const [refund, setRefund] = useState<Call | null>(null);

  const users = useMemo(() => new Map(data.users.map((u) => [u.id, u.name])), [data.users]);
  const hosts = useMemo(() => new Map(data.hosts.map((h) => [h.id, h.name])), [data.hosts]);

  const rows = data.calls.filter((c) => {
    if (type !== 'all' && c.type !== type) return false;
    if (filter === 'refunded' && !c.refundedCoins) return false;
    if (filter === 'low' && !(c.rating && c.rating <= 2)) return false;
    if (filter === 'gifts' && !c.giftCoins) return false;
    const term = q.trim().toLowerCase();
    return !term || `${users.get(c.userId)} ${hosts.get(c.hostId)} ${c.id}`.toLowerCase().includes(term);
  });

  const totalMin = Math.round(rows.reduce((a, c) => a + c.durationSec, 0) / 60);
  const avgMin = rows.length ? totalMin / rows.length : 0;

  const columns: Column<Call>[] = [
    { key: 'when', header: 'When', sort: (c) => c.startedAt, cell: (c) => <span className="whitespace-nowrap text-fg-2">{formatDateTime(c.startedAt)}</span> },
    { key: 'caller', header: 'Caller', sort: (c) => users.get(c.userId) ?? '', cell: (c) => <Link href={`/users/${c.userId}`} className="font-medium hover:underline">{users.get(c.userId)}</Link> },
    { key: 'host', header: 'Host', sort: (c) => hosts.get(c.hostId) ?? '', cell: (c) => <Link href={`/hosts/${c.hostId}`} className="font-medium hover:underline">{hosts.get(c.hostId)}</Link> },
    { key: 'type', header: 'Type', cell: (c) => <span className="whitespace-nowrap">{c.type === 'audio' ? 'Voice' : 'Video'} · {LANGUAGE_LABEL[c.language]}</span> },
    { key: 'dur', header: 'Duration', align: 'right', sort: (c) => c.durationSec, cell: (c) => formatDuration(c.durationSec) },
    { key: 'coins', header: 'Coins', align: 'right', sort: (c) => c.coins, cell: (c) => (c.refundedCoins ? <Pill icon={RotateCcw}>Refunded {c.refundedCoins}</Pill> : c.coins) },
    { key: 'gifts', header: 'Gifts', align: 'right', sort: (c) => c.giftCoins, cell: (c) => (c.giftCoins ? c.giftCoins : <span className="text-fg-3">—</span>) },
    { key: 'end', header: 'Ended', cell: (c) => <span className="whitespace-nowrap text-fg-2">{END[c.endReason]}</span> },
    { key: 'rating', header: 'Rating', sort: (c) => c.rating ?? 0, cell: (c) => (c.rating ? <StarsText value={c.rating} /> : <span className="text-fg-3">—</span>) },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (c) =>
        c.coins > 0 ? (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setRefund(c)}>
            Refund
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Calls"
        description="Every connected call in the last 30 days. Calls under 10 seconds are refunded automatically; refund others here."
        actions={
          <Button
            icon={Download}
            onClick={() =>
              downloadCsv(
                'calls.csv',
                ['id', 'started', 'caller', 'host', 'type', 'language', 'seconds', 'coins', 'refunded', 'gift_coins', 'host_earned_inr', 'end', 'rating'],
                rows.map((c) => [c.id, new Date(c.startedAt).toISOString(), users.get(c.userId) ?? '', hosts.get(c.hostId) ?? '', c.type, c.language, c.durationSec, c.coins, c.refundedCoins, c.giftCoins, (c.hostEarnedPaise / 100).toFixed(2), c.endReason, c.rating ?? '']),
              )
            }>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Calls shown" value={formatNumber(rows.length)} icon={PhoneCall} />
        <Kpi label="Minutes" value={formatNumber(totalMin)} sub={`avg ${avgMin.toFixed(1)} min per call`} icon={PhoneCall} />
        <Kpi label="Video share" value={`${Math.round((rows.filter((c) => c.type === 'video').length / Math.max(1, rows.length)) * 100)}%`} sub="of calls shown" icon={PhoneCall} />
        <Kpi label="Refunded" value={formatNumber(rows.filter((c) => c.refundedCoins).length)} sub="short or failed calls" icon={RotateCcw} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search caller or host" />
          <Select label="Call type" value={type} onChange={setType} options={[{ value: 'all', label: 'All types' }, { value: 'audio', label: 'Voice' }, { value: 'video', label: 'Video' }]} />
          <Select label="Filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All calls' }, { value: 'refunded', label: 'Refunded' }, { value: 'low', label: 'Rated 1–2★' }, { value: 'gifts', label: 'With gifts' }]} />
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={PhoneCall} title="No calls match" />} />
      </Card>
      {refund && (
        <ConfirmAction
          open
          onClose={() => setRefund(null)}
          title={`Refund ${refund.coins} coins?`}
          body={`${users.get(refund.userId)} gets ${refund.coins} coins back and ${hosts.get(refund.hostId)}'s earning for this call is reversed.`}
          confirmLabel="Refund call"
          danger
          onConfirm={(reason) => {
            data.refundCall(refund.id, reason);
            toast.good('Call refunded');
          }}
        />
      )}
    </>
  );
}

export default function CallsPage() {
  return (
    <Ready>
      <CallsPageView />
    </Ready>
  );
}
