'use client';

import { Flag, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { AccountStatus } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Card, DataTable, EmptyState, PageHeader, Pill, SearchInput, Tabs, type Column } from '@/components/ui';
import { formatNumber, formatRupees, timeAgo } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { User } from '@/lib/data/types';

type Tab = 'all' | 'active' | 'suspended' | 'banned' | 'flagged';

function UsersPageView() {
  const users = useAdmin((s) => s.users);
  const calls = useAdmin((s) => s.calls);
  const router = useRouter();
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
      header: 'Caller',
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
    { key: 'city', header: 'City', sort: (u) => u.city, cell: (u) => <span className="text-fg-2">{u.city}</span> },
    { key: 'joined', header: 'Joined', sort: (u) => u.joinedAt, cell: (u) => <span className="text-fg-2">{timeAgo(u.joinedAt, now)}</span> },
    { key: 'active', header: 'Last active', sort: (u) => u.lastActiveAt, cell: (u) => <span className="text-fg-2">{timeAgo(u.lastActiveAt, now)}</span> },
    { key: 'spent', header: 'Spent', align: 'right', sort: (u) => u.spentPaise, cell: (u) => formatRupees(u.spentPaise) },
    { key: 'coins', header: 'Coins', align: 'right', sort: (u) => u.coins, cell: (u) => formatNumber(u.coins) },
    { key: 'calls', header: 'Calls', align: 'right', sort: (u) => callCount.get(u.id) ?? 0, cell: (u) => formatNumber(callCount.get(u.id) ?? 0) },
    {
      key: 'status',
      header: 'Status',
      sort: (u) => u.status,
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          <AccountStatus status={u.status} />
          {u.flags.map((f) => (
            <Pill key={f} tone="warn" icon={Flag}>
              {f}
            </Pill>
          ))}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Callers" description="Everyone who calls hosts. Open a caller to see their payments, calls and reports, or to suspend, ban or adjust coins." actions={<SearchInput value={q} onChange={setQ} placeholder="Search name, phone, city" />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: visible.length },
          { value: 'active', label: 'Active', count: users.filter((u) => u.status === 'active').length },
          { value: 'suspended', label: 'Suspended', count: users.filter((u) => u.status === 'suspended').length },
          { value: 'banned', label: 'Banned', count: users.filter((u) => u.status === 'banned').length },
          { value: 'flagged', label: 'Flagged', count: users.filter((u) => u.flags.length > 0).length },
        ]}
      />
      <Card>
        <DataTable rows={rows} columns={columns} rowKey={(u) => u.id} onRowClick={(u) => router.push(`/users/${u.id}`)} initialSort={{ key: 'active', dir: 'desc' }} empty={<EmptyState icon={UsersRound} title="No callers match" body="Try a different search or tab." />} />
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
