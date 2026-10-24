'use client';

import { Download, PhoneCall, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { StarsText } from '@/components/quality';
import { Ready } from '@/components/shell';
import { Button, Card, ConfirmAction, DataTable, EmptyState, Kpi, PageHeader, Pill, SearchInput, Select, toast, type Column } from '@/components/ui';
import { useLang, useT } from '@/i18n';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Call } from '@/lib/data/types';

function CallsPageView() {
  const data = useAdmin();
  const t = useT();
  const lang = useLang();
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
    {
      key: 'people',
      header: `${t('common.caller')} → ${t('common.host')}`,
      sort: (c) => users.get(c.userId) ?? '',
      cell: (c) => (
        <span className="whitespace-nowrap">
          <Link href={`/users/${c.userId}`} className="font-medium hover:underline">
            {users.get(c.userId)}
          </Link>
          <span className="text-fg-3"> → </span>
          <Link href={`/hosts/${c.hostId}`} className="font-medium hover:underline">
            {hosts.get(c.hostId)}
          </Link>
        </span>
      ),
    },
    { key: 'when', header: t('common.when'), sort: (c) => c.startedAt, cell: (c) => <span className="whitespace-nowrap text-fg-2">{formatDateTime(c.startedAt, lang)}</span> },
    { key: 'type', header: t('common.type'), cell: (c) => <span className="whitespace-nowrap">{t(c.type === 'audio' ? 'common.voice' : 'common.video')} · {t(`lang.${c.language}`)}</span> },
    { key: 'dur', header: t('common.duration'), align: 'right', sort: (c) => c.durationSec, cell: (c) => formatDuration(c.durationSec) },
    { key: 'coins', header: t('users.coins'), align: 'right', sort: (c) => c.coins, cell: (c) => (c.refundedCoins ? <Pill icon={RotateCcw}>{t('calls.refundedN', { n: c.refundedCoins })}</Pill> : c.coins) },
    { key: 'gifts', header: t('common.gifts'), align: 'right', sort: (c) => c.giftCoins, cell: (c) => (c.giftCoins ? c.giftCoins : <span className="text-fg-3">—</span>) },
    { key: 'end', header: t('calls.ended'), cell: (c) => <span className="text-fg-2">{t(`endReason.${c.endReason}`)}</span> },
    { key: 'rating', header: t('common.rating'), sort: (c) => c.rating ?? 0, cell: (c) => (c.rating ? <StarsText value={c.rating} /> : <span className="text-fg-3">—</span>) },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (c) =>
        c.coins > 0 ? (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setRefund(c)}>
            {t('common.refund')}
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('calls.title')}
        description={t('calls.description')}
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
            {t('common.exportCsv')}
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('calls.shown')} value={formatNumber(rows.length)} icon={PhoneCall} />
        <Kpi label={t('calls.minutes')} value={formatNumber(totalMin)} sub={t('calls.avgPerCall', { n: avgMin.toFixed(1) })} icon={PhoneCall} />
        <Kpi label={t('calls.videoShare')} value={`${Math.round((rows.filter((c) => c.type === 'video').length / Math.max(1, rows.length)) * 100)}%`} sub={t('calls.ofShown')} icon={PhoneCall} />
        <Kpi label={t('common.refunded')} value={formatNumber(rows.filter((c) => c.refundedCoins).length)} sub={t('calls.shortFailed')} icon={RotateCcw} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder={t('calls.search')} />
          <Select
            label={t('calls.callType')}
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: t('calls.allTypes') },
              { value: 'audio', label: t('common.voice') },
              { value: 'video', label: t('common.video') },
            ]}
          />
          <Select
            label={t('calls.filter')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('calls.allCalls') },
              { value: 'refunded', label: t('common.refunded') },
              { value: 'low', label: t('calls.low') },
              { value: 'gifts', label: t('calls.withGifts') },
            ]}
          />
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={PhoneCall} title={t('calls.noMatch')} />} />
      </Card>
      {refund && (
        <ConfirmAction
          open
          onClose={() => setRefund(null)}
          title={t('calls.refundTitle', { n: refund.coins })}
          body={t('calls.refundBody', { user: users.get(refund.userId) ?? '', n: refund.coins, host: hosts.get(refund.hostId) ?? '' })}
          confirmLabel={t('calls.refundCall')}
          danger
          onConfirm={(reason) => {
            data.refundCall(refund.id, reason);
            toast.good(t('calls.refundedToast'));
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
