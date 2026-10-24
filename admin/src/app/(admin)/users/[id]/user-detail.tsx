'use client';

import { ArrowLeft, Ban, Coins, Flag, PauseCircle, PhoneCall, PlayCircle, Receipt, RotateCcw, Trash2, UserX } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { StarsText } from '@/components/quality';
import { AccountStatus, ReportStatusPill, SeverityPill } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, ConfirmAction, DataTable, EmptyState, Field, Kpi, Modal, Pill, inputClass, toast, type Column } from '@/components/ui';
import { formatDateTime, formatDuration, formatNumber, formatRupees, userNumbers } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import { LANGUAGE_LABEL, REPORT_LABEL, type Call, type Purchase, type UserStatus } from '@/lib/data/types';

type Pending = { kind: 'status'; status: UserStatus } | { kind: 'refundPurchase'; id: string } | { kind: 'refundCall'; id: string } | null;

function UserDetailView() {
  const { id } = useParams<{ id: string }>();
  const data = useAdmin();
  const user = data.users.find((u) => u.id === id);
  const [pending, setPending] = useState<Pending>(null);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [coinDelta, setCoinDelta] = useState('');
  const [coinReason, setCoinReason] = useState('');

  if (!user) return <EmptyState icon={UserX} title="Caller not found" body="This caller may have been removed." />;

  const n = userNumbers(data, user.id);
  const hostName = (hid: string) => data.hosts.find((h) => h.id === hid)?.name ?? hid;

  const purchaseCols: Column<Purchase>[] = [
    { key: 'when', header: 'When', sort: (p) => p.createdAt, cell: (p) => formatDateTime(p.createdAt) },
    { key: 'pack', header: 'Pack', cell: (p) => `${p.pack} · ${formatNumber(p.coins)} coins` },
    { key: 'platform', header: 'Store', cell: (p) => (p.platform === 'android' ? 'Google Play' : 'App Store') },
    { key: 'amount', header: 'Amount', align: 'right', sort: (p) => p.pricePaise, cell: (p) => formatRupees(p.pricePaise) },
    {
      key: 'status',
      header: '',
      align: 'right',
      cell: (p) =>
        p.status === 'refunded' ? (
          <Pill tone="neutral" icon={RotateCcw}>Refunded</Pill>
        ) : (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setPending({ kind: 'refundPurchase', id: p.id })}>
            Refund
          </Button>
        ),
    },
  ];

  const callCols: Column<Call>[] = [
    { key: 'when', header: 'When', sort: (c) => c.startedAt, cell: (c) => formatDateTime(c.startedAt) },
    { key: 'host', header: 'Host', cell: (c) => <Link className="font-medium hover:underline" href={`/hosts/${c.hostId}`}>{hostName(c.hostId)}</Link> },
    { key: 'type', header: 'Type', cell: (c) => `${c.type === 'audio' ? 'Voice' : 'Video'} · ${LANGUAGE_LABEL[c.language]}` },
    { key: 'dur', header: 'Duration', align: 'right', sort: (c) => c.durationSec, cell: (c) => formatDuration(c.durationSec) },
    { key: 'coins', header: 'Coins', align: 'right', sort: (c) => c.coins, cell: (c) => (c.refundedCoins ? <span className="text-fg-3">{c.coins} (refunded {c.refundedCoins})</span> : c.coins + c.giftCoins) },
    { key: 'rating', header: 'Rated', cell: (c) => (c.rating ? <StarsText value={c.rating} /> : <span className="text-fg-3">—</span>) },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (c) =>
        c.coins > 0 ? (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setPending({ kind: 'refundCall', id: c.id })}>
            Refund
          </Button>
        ) : null,
    },
  ];

  const confirmCopy =
    pending?.kind === 'status'
      ? {
          title: pending.status === 'active' ? `Reactivate ${user.name}?` : pending.status === 'suspended' ? `Suspend ${user.name}?` : pending.status === 'banned' ? `Ban ${user.name}?` : `Delete ${user.name}?`,
          body:
            pending.status === 'banned'
              ? 'They will be logged out and cannot sign up again with this phone or device.'
              : pending.status === 'deleted'
                ? 'Profile data is anonymised. Payment and call records required by law are kept.'
                : pending.status === 'suspended'
                  ? 'They cannot make calls or buy coins until reactivated.'
                  : 'They can use the app again.',
          label: pending.status === 'active' ? 'Reactivate' : pending.status === 'suspended' ? 'Suspend' : pending.status === 'banned' ? 'Ban' : 'Delete',
          danger: pending.status !== 'active',
        }
      : pending?.kind === 'refundPurchase'
        ? { title: 'Refund this purchase?', body: 'The coins are removed from the wallet. Related host earnings are clawed back during the hold window.', label: 'Refund', danger: true }
        : pending?.kind === 'refundCall'
          ? { title: 'Refund this call?', body: 'All coins for the call go back to the caller and the host earning is reversed.', label: 'Refund call', danger: true }
          : null;

  const delta = Number(coinDelta);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/users" className="inline-flex w-fit items-center gap-1 text-sm text-fg-3 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Callers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size={56} />
          <div>
            <h1 className="font-display text-2xl font-semibold">{user.name}</h1>
            <p className="text-sm text-fg-3">
              {user.phone} · {user.age} · {user.city} · {user.device} · ID {user.id}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <AccountStatus status={user.status} />
              {user.flags.map((f) => (
                <Pill key={f} tone="warn" icon={Flag}>
                  {f}
                </Pill>
              ))}
              {user.languages.map((l) => (
                <Pill key={l}>{LANGUAGE_LABEL[l]}</Pill>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Coins} onClick={() => setCoinsOpen(true)}>
            Adjust coins
          </Button>
          {user.status === 'active' ? (
            <Button icon={PauseCircle} onClick={() => setPending({ kind: 'status', status: 'suspended' })}>
              Suspend
            </Button>
          ) : user.status !== 'deleted' ? (
            <Button icon={PlayCircle} onClick={() => setPending({ kind: 'status', status: 'active' })}>
              Reactivate
            </Button>
          ) : null}
          {user.status !== 'banned' && user.status !== 'deleted' && (
            <Button variant="danger" icon={Ban} onClick={() => setPending({ kind: 'status', status: 'banned' })}>
              Ban
            </Button>
          )}
          {user.status !== 'deleted' && (
            <Button variant="ghost" icon={Trash2} onClick={() => setPending({ kind: 'status', status: 'deleted' })}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total spent" value={formatRupees(user.spentPaise)} sub={`${n.purchases.length} purchases`} icon={Receipt} />
        <Kpi label="Coin balance" value={formatNumber(user.coins)} sub="current wallet" icon={Coins} />
        <Kpi label="Calls" value={formatNumber(n.calls.length)} sub={`${formatNumber(n.minutes)} minutes`} icon={PhoneCall} />
        <Kpi label="Reports against" value={String(n.reportsAgainst.length)} sub={`${n.reportsFiled.length} filed by them`} icon={Flag} tone={n.reportsAgainst.length ? 'bad' : undefined} />
      </div>

      <Card title="Purchases" description="Verified with Google Play / App Store">
        <DataTable rows={n.purchases} columns={purchaseCols} rowKey={(p) => p.id} pageSize={8} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={Receipt} title="No purchases yet" />} />
      </Card>

      <Card title="Calls">
        <DataTable rows={n.calls} columns={callCols} rowKey={(c) => c.id} pageSize={10} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={PhoneCall} title="No calls yet" />} />
      </Card>

      <Card title="Reports involving this caller">
        {n.reportsAgainst.length + n.reportsFiled.length === 0 ? (
          <EmptyState icon={Flag} title="No reports" />
        ) : (
          <ul className="flex flex-col gap-2">
            {[...n.reportsAgainst.map((r) => ({ r, against: true })), ...n.reportsFiled.map((r) => ({ r, against: false }))].map(({ r, against }) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-sm">
                <Pill tone={against ? 'bad' : 'neutral'}>{against ? 'Against them' : 'Filed by them'}</Pill>
                <SeverityPill severity={r.severity} />
                <span className="font-medium">{REPORT_LABEL[r.category]}</span>
                <span className="flex-1 text-fg-2">{r.details}</span>
                <ReportStatusPill status={r.status} />
                <Link href="/reports" className="text-xs font-medium text-brand hover:underline">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirmCopy && (
        <ConfirmAction
          open
          onClose={() => setPending(null)}
          title={confirmCopy.title}
          body={confirmCopy.body}
          confirmLabel={confirmCopy.label}
          danger={confirmCopy.danger}
          onConfirm={(reason) => {
            if (pending?.kind === 'status') data.setUserStatus(user.id, pending.status, reason);
            if (pending?.kind === 'refundPurchase') data.refundPurchase(pending.id, reason);
            if (pending?.kind === 'refundCall') data.refundCall(pending.id, reason);
            toast.good(`${confirmCopy.label} done. Logged in the activity log.`);
          }}
        />
      )}

      <Modal
        open={coinsOpen}
        onClose={() => setCoinsOpen(false)}
        title="Adjust coins"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCoinsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!Number.isInteger(delta) || delta === 0 || coinReason.trim().length < 3}
              onClick={() => {
                data.adjustCoins(user.id, delta, coinReason.trim());
                toast.good(`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} coins`);
                setCoinsOpen(false);
                setCoinDelta('');
                setCoinReason('');
              }}>
              Apply
            </Button>
          </>
        }>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-2">
            Current balance: <span className="tabular font-medium text-fg">{formatNumber(user.coins)}</span> coins. Use a negative number to remove coins.
          </p>
          <Field label="Coins (+/-)" hint="e.g. 50 for goodwill, -40 to reverse a bonus">
            {(fid) => <input id={fid} type="number" step={1} value={coinDelta} onChange={(e) => setCoinDelta(e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Reason (required)">
            {(fid) => <input id={fid} value={coinReason} onChange={(e) => setCoinReason(e.target.value)} placeholder="Saved in the audit log" className={inputClass} />}
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export default function UserDetail() {
  return (
    <Ready>
      <UserDetailView />
    </Ready>
  );
}
