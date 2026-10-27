'use client';

import { CheckCircle2, Download, IndianRupee, Receipt, RotateCcw, Send, Wallet, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BarList } from '@/components/charts';
import { PayoutStatus } from '@/components/status';
import { Ready } from '@/components/shell';
import { Button, Card, ConfirmAction, DataTable, EmptyState, Kpi, PageHeader, Pill, Tabs, toast, type Column } from '@/components/ui';
import { translateMaybe, useLang, useT } from '@/i18n';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatNumber, formatRupees } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Payout, Purchase } from '@/lib/data/types';

type Pending = { kind: 'refund'; p: Purchase } | { kind: 'payout'; p: Payout; to: 'approved' | 'paid' | 'rejected' } | null;

function PaymentsPageView() {
  const data = useAdmin();
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<'purchases' | 'payouts'>('purchases');
  const [pending, setPending] = useState<Pending>(null);
  const users = useMemo(() => new Map(data.users.map((u) => [u.id, u.name])), [data.users]);
  const hosts = useMemo(() => new Map(data.hosts.map((h) => [h.id, h.name])), [data.hosts]);
  const packName = (pack: string) => translateMaybe(t, 'packName', pack);

  const verified = data.purchases.filter((p) => p.status === 'verified');
  const gross = verified.reduce((a, p) => a + p.pricePaise, 0);
  const refunded = data.purchases.filter((p) => p.status === 'refunded');
  const byPack = ['Starter', 'Basic', 'Plus', 'Max'].map((pack) => ({ label: packName(pack), value: verified.filter((p) => p.pack === pack).reduce((a, p) => a + p.pricePaise, 0) }));
  const due = data.payouts.filter((p) => p.status === 'requested' || p.status === 'approved');

  const purchaseCols: Column<Purchase>[] = [
    { key: 'user', header: t('common.caller'), sort: (p) => users.get(p.userId) ?? '', cell: (p) => <Link href={`/users/${p.userId}`} className="font-medium hover:underline">{users.get(p.userId)}</Link> },
    { key: 'when', header: t('common.when'), sort: (p) => p.createdAt, cell: (p) => <span className="whitespace-nowrap text-fg-2">{formatDateTime(p.createdAt, lang)}</span> },
    { key: 'pack', header: t('common.pack'), sort: (p) => p.pricePaise, cell: (p) => t('payments.packCoins', { pack: packName(p.pack), n: formatNumber(p.coins) }) },
    { key: 'store', header: t('common.store'), cell: (p) => (p.platform === 'android' ? t('common.googlePlay') : t('common.appStore')) },
    { key: 'amount', header: t('common.amount'), align: 'right', sort: (p) => p.pricePaise, cell: (p) => formatRupees(p.pricePaise) },
    {
      key: 'status',
      header: '',
      align: 'right',
      cell: (p) =>
        p.status === 'refunded' ? (
          <Pill icon={RotateCcw}>{t('common.refunded')}</Pill>
        ) : (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setPending({ kind: 'refund', p })}>
            {t('common.refund')}
          </Button>
        ),
    },
  ];

  const payoutCols: Column<Payout>[] = [
    { key: 'host', header: t('common.host'), sort: (p) => hosts.get(p.hostId) ?? '', cell: (p) => <Link href={`/hosts/${p.hostId}`} className="font-medium hover:underline">{hosts.get(p.hostId)}</Link> },
    { key: 'when', header: t('payments.requested'), sort: (p) => p.requestedAt, cell: (p) => <span className="whitespace-nowrap text-fg-2">{formatDateTime(p.requestedAt, lang)}</span> },
    { key: 'method', header: t('payments.payTo'), cell: (p) => <span className="break-all text-fg-2">{p.method}</span> },
    { key: 'amount', header: t('common.amount'), align: 'right', sort: (p) => p.amountPaise, cell: (p) => formatRupees(p.amountPaise) },
    { key: 'tds', header: t('payments.tds'), align: 'right', cell: (p) => formatRupees(p.tdsPaise) },
    { key: 'net', header: t('payments.net'), align: 'right', sort: (p) => p.amountPaise - p.tdsPaise, cell: (p) => <span className="font-medium">{formatRupees(p.amountPaise - p.tdsPaise)}</span> },
    { key: 'status', header: t('common.status'), sort: (p) => p.status, cell: (p) => <PayoutStatus status={p.status} /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (p) =>
        p.status === 'requested' ? (
          <span className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setPending({ kind: 'payout', p, to: 'rejected' })}>
              {t('common.reject')}
            </Button>
            <Button size="sm" icon={CheckCircle2} onClick={() => setPending({ kind: 'payout', p, to: 'approved' })}>
              {t('common.approve')}
            </Button>
          </span>
        ) : p.status === 'approved' ? (
          <Button size="sm" variant="success" icon={Send} onClick={() => setPending({ kind: 'payout', p, to: 'paid' })}>
            {t('payments.markPaid')}
          </Button>
        ) : null,
    },
  ];

  const copy =
    pending?.kind === 'refund'
      ? {
          title: t('payments.refundTitle', { amount: formatRupees(pending.p.pricePaise) }),
          body: t('payments.refundBody', { n: pending.p.coins, user: users.get(pending.p.userId) ?? '' }),
          label: t('common.refund'),
          danger: true,
          required: true,
        }
      : pending?.kind === 'payout'
        ? {
            title: pending.to === 'approved' ? t('payments.approveTitle') : pending.to === 'paid' ? t('payments.paidTitle') : t('payments.rejectTitle'),
            body:
              pending.to === 'paid'
                ? t('payments.paidBody', { amount: formatRupees(pending.p.amountPaise - pending.p.tdsPaise), to: pending.p.method })
                : pending.to === 'approved'
                  ? t('payments.approveBody', { host: hosts.get(pending.p.hostId) ?? '', amount: formatRupees(pending.p.amountPaise) })
                  : t('payments.rejectBody'),
            label: pending.to === 'approved' ? t('common.approve') : pending.to === 'paid' ? t('payments.markPaid') : t('common.reject'),
            danger: pending.to === 'rejected',
            required: pending.to !== 'approved',
          }
        : null;

  return (
    <>
      <PageHeader
        title={t('payments.title')}
        description={t('payments.description')}
        actions={
          tab === 'payouts' ? (
            <Button
              icon={Download}
              onClick={() =>
                downloadCsv(
                  'payout-batch.csv',
                  ['payout_id', 'host', 'pay_to', 'amount_inr', 'tds_inr', 'net_inr', 'status'],
                  due.map((p) => [p.id, hosts.get(p.hostId) ?? '', p.method, (p.amountPaise / 100).toFixed(2), (p.tdsPaise / 100).toFixed(2), ((p.amountPaise - p.tdsPaise) / 100).toFixed(2), p.status]),
                )
              }>
              {t('payments.exportBatch')}
            </Button>
          ) : (
            <Button icon={Download} onClick={() => downloadCsv('purchases.csv', ['id', 'date', 'caller', 'pack', 'coins', 'amount_inr', 'store', 'status'], data.purchases.map((p) => [p.id, new Date(p.createdAt).toISOString(), users.get(p.userId) ?? '', p.pack, p.coins, (p.pricePaise / 100).toFixed(2), p.platform, p.status]))}>
              {t('common.exportCsv')}
            </Button>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('payments.gross30')} value={formatRupees(gross)} sub={t('user.purchasesN', { n: formatNumber(verified.length) })} icon={IndianRupee} tone="good" />
        <Kpi label={t('payments.avgOrder')} value={formatRupees(Math.round(gross / Math.max(1, verified.length)))} sub={t('payments.perPurchase')} icon={Receipt} />
        <Kpi label={t('payments.refunds')} value={formatNumber(refunded.length)} sub={formatRupees(refunded.reduce((a, p) => a + p.pricePaise, 0))} icon={RotateCcw} tone={refunded.length ? 'warn' : undefined} />
        <Kpi label={t('payments.payoutsDue')} value={formatRupees(due.reduce((a, p) => a + p.amountPaise, 0))} sub={t('payments.hostsN', { n: due.length })} icon={Wallet} tone="warn" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'purchases', label: t('payments.purchasesTab'), count: data.purchases.length },
          { value: 'payouts', label: t('payments.payoutsTab'), count: data.payouts.length },
        ]}
      />

      {tab === 'purchases' ? (
        <div className="grid gap-4 xl:grid-cols-4">
          <Card className="xl:col-span-3">
            <DataTable rows={data.purchases} columns={purchaseCols} rowKey={(p) => p.id} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={Receipt} title={t('payments.noPurchases')} />} />
          </Card>
          <Card title={t('payments.byPack')} description={t('common.last30')}>
            <BarList items={byPack} format={(v) => formatRupees(v, true)} />
          </Card>
        </div>
      ) : (
        <Card>
          <DataTable rows={data.payouts} columns={payoutCols} rowKey={(p) => p.id} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={Wallet} title={t('payments.noPayouts')} />} />
        </Card>
      )}

      {copy && pending && (
        <ConfirmAction
          open
          onClose={() => setPending(null)}
          title={copy.title}
          body={copy.body}
          confirmLabel={copy.label}
          danger={copy.danger}
          reasonRequired={copy.required}
          placeholder={pending.kind === 'payout' && pending.to === 'paid' ? t('payments.utrPlaceholder') : undefined}
          onConfirm={(reason) => {
            const saved = pending.kind === 'refund' ? data.refundPurchase(pending.p.id, reason) : data.decidePayout(pending.p.id, pending.to, reason);
            const label = copy.label;
            saved.then(() => toast.good(t('common.done', { action: label })), () => {});
          }}
        />
      )}
    </>
  );
}

export default function PaymentsPage() {
  return (
    <Ready>
      <PaymentsPageView />
    </Ready>
  );
}
