'use client';

import { Download, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { ActivityFeed } from '@/components/feed';
import { Ready } from '@/components/shell';
import { Button, Card, DataTable, EmptyState, PageHeader, Pill, SearchInput, Select, Tabs, type Column } from '@/components/ui';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { AuditEntry } from '@/lib/data/types';

const TYPES: AuditEntry['targetType'][] = ['user', 'host', 'application', 'report', 'payout', 'purchase', 'call', 'review', 'config', 'system'];

function ActivityPageView() {
  const audit = useAdmin((s) => s.audit);
  const [tab, setTab] = useState<'audit' | 'live'>('audit');
  const [type, setType] = useState<'all' | AuditEntry['targetType']>('all');
  const [q, setQ] = useState('');

  const rows = audit.filter((a) => (type === 'all' || a.targetType === type) && (!q.trim() || `${a.action} ${a.detail} ${a.actor} ${a.targetId}`.toLowerCase().includes(q.trim().toLowerCase())));

  const columns: Column<AuditEntry>[] = [
    { key: 'at', header: 'When', sort: (a) => a.at, cell: (a) => <span className="whitespace-nowrap text-fg-2">{formatDateTime(a.at)}</span> },
    { key: 'actor', header: 'Admin', sort: (a) => a.actor, cell: (a) => <span className="font-medium">{a.actor}</span> },
    { key: 'action', header: 'Action', sort: (a) => a.action, cell: (a) => a.action },
    { key: 'type', header: 'On', cell: (a) => <Pill>{a.targetType}</Pill> },
    { key: 'detail', header: 'Details', cell: (a) => <span className="text-fg-2">{a.detail}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every admin action with who, what and why (append-only), plus a live feed of what users and hosts are doing."
        actions={
          <Button icon={Download} onClick={() => downloadCsv('audit-log.csv', ['time', 'admin', 'action', 'target_type', 'target_id', 'detail'], audit.map((a) => [new Date(a.at).toISOString(), a.actor, a.action, a.targetType, a.targetId, a.detail]))}>
            Export
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'audit', label: 'Admin actions', count: audit.length },
          { value: 'live', label: 'Platform activity' },
        ]}
      />
      {tab === 'audit' ? (
        <Card>
          <div className="flex flex-wrap gap-2 border-b border-line p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search actions and details" />
            <Select label="Type" value={type} onChange={setType} options={[{ value: 'all', label: 'Everything' }, ...TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]} />
          </div>
          <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} initialSort={{ key: 'at', dir: 'desc' }} pageSize={20} empty={<EmptyState icon={ShieldCheck} title="No admin actions yet" body="Approvals, bans, refunds and config changes will appear here." />} />
        </Card>
      ) : (
        <Card>
          <ActivityFeed limit={60} />
        </Card>
      )}
    </>
  );
}

export default function ActivityPage() {
  return (
    <Ready>
      <ActivityPageView />
    </Ready>
  );
}
