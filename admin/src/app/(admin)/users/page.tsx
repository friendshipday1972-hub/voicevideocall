'use client';

import { Flag, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { AccountStatus } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Card, DataTable, EmptyState, PageHeader, Pill, SearchInput, Tabs, type Column } from '@/components/ui';
import { translateMaybe, useT } from '@/i18n';
import { formatNumber, formatRupees, timeAgo } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { User } from '@/lib/data/types';

type Tab = 'all' | 'active' | 'suspended' | 'banned' | 'flagged';

function UsersPageView() {
  const users = useAdmin((s) => s.users);
  const calls = useAdmin((s) => s.calls);
  const router = useRouter();
  const t = useT();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [now] = useState(() => Date.now());

  const callCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of calls) m.set(c.userId, (m.get(c.userId) ?? 0) + 1);
    return m;
  }, [calls]);

  const visible = users.filter((u) => u.status !== 'deleted' || tab === 'all');
  const rows = visible.filter((u) => {
    if (tab === 'flagged' && u.flags.length === 0) return false;
    if (tab !== 'all' && tab !== 'flagged' && u.status !== tab) return false;
    const term = q.trim().toLowerCase();
    return !term || `${u.name} ${u.phone} ${u.city} ${u.id}`.toLowerCase().includes(term);
  });

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: t('common.caller'),
      sort: (u) => u.name,
      cell: (u) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={u.name} size={30} />
          <span>
            <span className="block font-medium">{u.name}</span>
            <span className="block text-xs text-fg-3">{u.phone}</span>
          </span>
        </span>
      ),
    },
    { key: 'city', header: t('common.city'), sort: (u) => u.city, cell: (u) => <span className="text-fg-2">{u.city}</span> },
    { key: 'joined', header: t('users.joined'), sort: (u) => u.joinedAt, cell: (u) => <span className="text-fg-2">{timeAgo(u.joinedAt, now, t)}</span> },
    { key: 'active', header: t('users.lastActive'), sort: (u) => u.lastActiveAt, cell: (u) => <span className="text-fg-2">{timeAgo(u.lastActiveAt, now, t)}</span> },
    { key: 'spent', header: t('users.spent'), align: 'right', sort: (u) => u.spentPaise, cell: (u) => formatRupees(u.spentPaise) },
    { key: 'coins', header: t('users.coins'), align: 'right', sort: (u) => u.coins, cell: (u) => formatNumber(u.coins) },
    { key: 'calls', header: t('users.calls'), align: 'right', sort: (u) => callCount.get(u.id) ?? 0, cell: (u) => formatNumber(callCount.get(u.id) ?? 0) },
    {
      key: 'status',
      header: t('common.status'),
      sort: (u) => u.status,
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          <AccountStatus status={u.status} />
          {u.flags.map((f) => (
            <Pill key={f} tone="warn" icon={Flag}>
              {translateMaybe(t, 'flag', f)}
            </Pill>
          ))}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('users.title')} description={t('users.description')} actions={<SearchInput value={q} onChange={setQ} placeholder={t('users.search')} />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: t('common.all'), count: visible.length },
          { value: 'active', label: t('status.active'), count: users.filter((u) => u.status === 'active').length },
          { value: 'suspended', label: t('status.suspended'), count: users.filter((u) => u.status === 'suspended').length },
          { value: 'banned', label: t('status.banned'), count: users.filter((u) => u.status === 'banned').length },
          { value: 'flagged', label: t('users.flagged'), count: users.filter((u) => u.flags.length > 0).length },
        ]}
      />
      <Card>
        <DataTable rows={rows} columns={columns} rowKey={(u) => u.id} onRowClick={(u) => router.push(`/users/${u.id}`)} initialSort={{ key: 'active', dir: 'desc' }} empty={<EmptyState icon={UsersRound} title={t('users.noMatch')} body={t('users.noMatchBody')} />} />
      </Card>
    </>
  );
}

export default function UsersPage() {
  return (
    <Ready>
      <UsersPageView />
    </Ready>
  );
}
