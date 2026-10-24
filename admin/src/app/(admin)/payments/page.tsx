'use client';

import { CheckCircle2, Download, IndianRupee, Receipt, RotateCcw, Send, Wallet, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BarList } from '@/components/charts';
import { PayoutStatus } from '@/components/status';
import { Ready } from '@/components/shell';
import { Button, Card, ConfirmAction, DataTable, EmptyState, Kpi, PageHeader, Pill, Tabs, toast, type Column } from '@/components/ui';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatNumber, formatRupees } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Payout, Purchase } from '@/lib/data/types';

type Pending = { kind: 'refund'; p: Purchase } | { kind: 'payout'; p: Payout; to: 'approved' | 'paid' | 'rejected' } | null;

function PaymentsPageView() {
  const data = useAdmin();
  const [tab, setTab] = useState<'purchases' | 'payouts'>('purchases');
  const [pending, setPending] = useState<Pending>(null);
  const users = useMemo(() => new Map(data.users.map((u) => [u.id, u.name])), [data.users]);
  const hosts = useMemo(() => new Map(data.hosts.map((h) => [h.id, h.name])), [data.hosts]);

  const verified = data.purchases.filter((p) => p.status === 'verified');
  const gross = verified.reduce((a, p) => a + p.pricePaise, 0);
  const refunded = data.purchases.filter((p) => p.status === 'refunded');
  const byPack = ['Starter', 'Basic', 'Plus', 'Max'].map((pack) => ({ label: pack, value: verified.filter((p) => p.pack === pack).reduce((a, p) => a + p.pricePaise, 0) }));
  const due = data.payouts.filter((p) => p.status === 'requested' || p.status === 'approved');

  const purchaseCols: Column<Purchase>[] = [
    { key: 'when', header: 'When', sort: (p) => p.createdAt, cell: (p) => <span className="whitespace-nowrap text-fg-2">{formatDateTime(p.createdAt)}</span> },
    { key: 'user', header: 'Caller', sort: (p) => users.get(p.userId) ?? '', cell: (p) => <Link href={`/users/${p.userId}`} className="font-medium hover:underline">{users.get(p.userId)}</Link> },
    { key: 'pack', header: 'Pack', sort: (p) => p.pricePaise, cell: (p) => `${p.pack} · ${formatNumber(p.coins)} coins` },
    { key: 'store', header: 'Store', cell: (p) => (p.platform === 'android' ? 'Google Play' : 'App Store') },
    { key: 'amount', header: 'Amount', align: 'right', sort: (p) => p.pricePaise, cell: (p) => formatRupees(p.pricePaise) },
    {
      key: 'status',
      header: '',
      align: 'right',
      cell: (p) =>
        p.status === 'refunded' ? (
          <Pill icon={RotateCcw}>Refunded</Pill>
        ) : (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setPending({ kind: 'refund', p })}>
            Refund
          </Button>
        ),
    },
  ];

  const payoutCols: Column<Payout>[] = [
    { key: 'when', header: 'Requested', sort: (p) => p.requestedAt, cell: (p) => <span className="whitespace-nowrap text-fg-2">{formatDateTime(p.requestedAt)}</span> },
    { key: 'host', header: 'Host', sort: (p) => hosts.get(p.hostId) ?? '', cell: (p) => <Link href={`/hosts/${p.hostId}`} className="font-medium hover:underline">{hosts.get(p.hostId)}</Link> },
    { key: 'method', header: 'Pay to', cell: (p) => <span className="text-fg-2">{p.method}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sort: (p) => p.amountPaise, cell: (p) => formatRupees(p.amountPaise) },
    { key: 'tds', header: 'TDS (1%)', align: 'right', cell: (p) => formatRupees(p.tdsPaise) },
    { key: 'net', header: 'Net', align: 'right', sort: (p) => p.amountPaise - p.tdsPaise, cell: (p) => <span className="font-medium">{formatRupees(p.amountPaise - p.tdsPaise)}</span> },
    { key: 'status', header: 'Status', sort: (p) => p.status, cell: (p) => <PayoutStatus status={p.status} /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (p) => (
        <span className="flex justify-end gap-1">
          {p.status === 'requested' && (
            <>
              <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setPending({ kind: 'payout', p, to: 'rejected' })}>
                Reject
              </Button>
              <Button size="sm" icon={CheckCircle2} onClick={() => setPending({ kind: 'payout', p, to: 'approved' })}>
                Approve
              </Button>
            </>
          )}
          {p.status === 'approved' && (
            <Button size="sm" variant="success" icon={Send} onClick={() => setPending({ kind: 'payout', p, to: 'paid' })}>
              Mark paid
            </Button>
          )}
        </span>
      ),
    },
  ];

  const copy =
    pending?.kind === 'refund'
      ? { title: `Refund ${formatRupees(pending.p.pricePaise)}?`, body: `${pending.p.coins} coins are removed from ${users.get(pending.p.userId)}'s wallet. Issue the money refund in the Play Console / App Store.`, label: 'Refund', danger: true, required: true }
      : pending?.kind === 'payout'
        ? {
            title: pending.to === 'approved' ? 'Approve payout?' : pending.to === 'paid' ? 'Mark as paid?' : 'Reject payout?',
            body:
              pending.to === 'paid'
                ? `Confirm ${formatRupees(pending.p.amountPaise - pending.p.tdsPaise)} was sent to ${pending.p.method} (RazorpayX / Cashfree reference in the note).`
                : pending.to === 'approved'
                  ? `${hosts.get(pending.p.hostId)} · ${formatRupees(pending.p.amountPaise)}. It joins Monday's payout batch.`
                  : 'The amount returns to her withdrawable balance.',
            label: pending.to === 'approved' ? 'Approve' : pending.to === 'paid' ? 'Mark paid' : 'Reject',
            danger: pending.to === 'rejected',
            required: pending.to !== 'approved',
          }
        : null;

  return (
    <>
      <PageHeader
        title="Payments & payouts"
        description="Money in from callers (Google Play / App Store) and money out to hosts (weekly, after the 7-day hold)."
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
              Export payout batch
            </Button>
          ) : (
            <Button icon={Download} onClick={() => downloadCsv('purchases.csv', ['id', 'date', 'caller', 'pack', 'coins', 'amount_inr', 'store', 'status'], data.purchases.map((p) => [p.id, new Date(p.createdAt).toISOString(), users.get(p.userId) ?? '', p.pack, p.coins, (p.pricePaise / 100).toFixed(2), p.platform, p.status]))}>
              Export CSV
            </Button>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Gross revenue (30d)" value={formatRupees(gross)} sub={`${formatNumber(verified.length)} purchases`} icon={IndianRupee} tone="good" />
        <Kpi label="Average order" value={formatRupees(Math.round(gross / Math.max(1, verified.length)))} sub="per purchase" icon={Receipt} />
        <Kpi label="Refunds" value={formatNumber(refunded.length)} sub={formatRupees(refunded.reduce((a, p) => a + p.pricePaise, 0))} icon={RotateCcw} tone={refunded.length ? 'warn' : undefined} />
        <Kpi label="Payouts due" value={formatRupees(due.reduce((a, p) => a + p.amountPaise, 0))} sub={`${due.length} hosts`} icon={Wallet} tone="warn" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'purchases', label: 'Coin purchases', count: data.purchases.length },
          { value: 'payouts', label: 'Host payouts', count: data.payouts.length },
        ]}
      />

      {tab === 'purchases' ? (
        <div className="grid gap-4 xl:grid-cols-4">
          <Card className="xl:col-span-3">
            <DataTable rows={data.purchases} columns={purchaseCols} rowKey={(p) => p.id} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={Receipt} title="No purchases" />} />
          </Card>
          <Card title="Revenue by pack" description="Last 30 days">
            <BarList items={byPack} format={(v) => formatRupees(v, true)} />
          </Card>
        </div>
      ) : (
        <Card>
          <DataTable rows={data.payouts} columns={payoutCols} rowKey={(p) => p.id} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={Wallet} title="No payout requests" />} />
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
          placeholder={pending.kind === 'payout' && pending.to === 'paid' ? 'Transfer reference, e.g. UTR 4012…' : undefined}
          onConfirm={(reason) => {
            if (pending.kind === 'refund') data.refundPurchase(pending.p.id, reason);
            else data.decidePayout(pending.p.id, pending.to, reason);
            toast.good(`${copy.label}: done`);
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
