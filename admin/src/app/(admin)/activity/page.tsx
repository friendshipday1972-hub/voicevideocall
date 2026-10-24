'use client';

import { Download, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { ActivityFeed } from '@/components/feed';
import { Ready } from '@/components/shell';
import { Button, Card, DataTable, EmptyState, PageHeader, Pill, SearchInput, Select, Tabs, type Column } from '@/components/ui';
import { useLang, useT } from '@/i18n';
import { downloadCsv } from '@/lib/csv';
import { auditAction, formatDateTime } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { AuditEntry } from '@/lib/data/types';

const TYPES: AuditEntry['targetType'][] = ['user', 'host', 'application', 'report', 'payout', 'purchase', 'call', 'review', 'config', 'system'];

function ActivityPageView() {
  const audit = useAdmin((s) => s.audit);
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<'audit' | 'live'>('audit');
  const [type, setType] = useState<'all' | AuditEntry['targetType']>('all');
  const [q, setQ] = useState('');

  const actionText = (a: AuditEntry) => auditAction(t, a.action, a.vars);
  const detailText = (a: AuditEntry) => (a.action === 'demoGenerated' && a.vars ? t('audit.demoGeneratedDetail', a.vars) : a.detail);
  const rows = audit.filter((a) => (type === 'all' || a.targetType === type) && (!q.trim() || `${actionText(a)} ${a.detail} ${a.actor} ${a.targetId}`.toLowerCase().includes(q.trim().toLowerCase())));

  const columns: Column<AuditEntry>[] = [
    { key: 'action', header: t('activity.action'), sort: (a) => actionText(a), cell: (a) => <span className="font-medium">{actionText(a)}</span> },
    { key: 'at', header: t('common.when'), sort: (a) => a.at, cell: (a) => <span className="whitespace-nowrap text-fg-2">{formatDateTime(a.at, lang)}</span> },
    { key: 'actor', header: t('activity.admin'), sort: (a) => a.actor, cell: (a) => <span className="break-all">{a.actor}</span> },
    { key: 'type', header: t('activity.on'), cell: (a) => <Pill>{t(`activity.target.${a.targetType}`)}</Pill> },
    { key: 'detail', header: t('common.details'), cell: (a) => <span className="text-fg-2">{detailText(a)}</span> },
  ];

  return (
    <>
      <PageHeader
        title={t('activity.title')}
        description={t('activity.description')}
        actions={
          <Button icon={Download} onClick={() => downloadCsv('audit-log.csv', ['time', 'admin', 'action', 'target_type', 'target_id', 'detail'], audit.map((a) => [new Date(a.at).toISOString(), a.actor, actionText(a), a.targetType, a.targetId, detailText(a)]))}>
            {t('common.export')}
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'audit', label: t('activity.adminActions'), count: audit.length },
          { value: 'live', label: t('activity.platform') },
        ]}
      />
      {tab === 'audit' ? (
        <Card>
          <div className="flex flex-wrap gap-2 border-b border-line p-3">
            <SearchInput value={q} onChange={setQ} placeholder={t('activity.search')} />
            <Select label={t('activity.typeLabel')} value={type} onChange={setType} options={[{ value: 'all', label: t('activity.everything') }, ...TYPES.map((v) => ({ value: v, label: t(`activity.target.${v}`) }))]} />
          </div>
          <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} initialSort={{ key: 'at', dir: 'desc' }} pageSize={20} empty={<EmptyState icon={ShieldCheck} title={t('activity.empty')} body={t('activity.emptyBody')} />} />
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
