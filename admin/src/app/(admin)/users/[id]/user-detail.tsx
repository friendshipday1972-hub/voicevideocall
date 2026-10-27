'use client';

import { ArrowLeft, Ban, Coins, Flag, PauseCircle, PhoneCall, PlayCircle, Receipt, RotateCcw, Trash2, UserX } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { StarsText } from '@/components/quality';
import { AccountStatus, ReportStatusPill, SeverityPill } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, ConfirmAction, DataTable, EmptyState, Field, Kpi, Modal, Pill, inputClass, toast, type Column } from '@/components/ui';
import { translateMaybe, useLang, useT } from '@/i18n';
import { formatDateTime, formatDuration, formatNumber, formatRupees, userNumbers } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Call, Purchase, UserStatus } from '@/lib/data/types';

type Pending = { kind: 'status'; status: UserStatus } | { kind: 'refundPurchase'; id: string } | { kind: 'refundCall'; id: string } | null;

const STATUS_COPY = {
  active: { title: 'user.confirmActive', body: 'user.bodyActive', label: 'common.reactivate' },
  suspended: { title: 'user.confirmSuspended', body: 'user.bodySuspended', label: 'common.suspend' },
  banned: { title: 'user.confirmBanned', body: 'user.bodyBanned', label: 'common.ban' },
  deleted: { title: 'user.confirmDeleted', body: 'user.bodyDeleted', label: 'common.delete' },
} as const;

function UserDetailView() {
  const { id } = useParams<{ id: string }>();
  const data = useAdmin();
  const t = useT();
  const lang = useLang();
  const user = data.users.find((u) => u.id === id);
  const [pending, setPending] = useState<Pending>(null);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [coinDelta, setCoinDelta] = useState('');
  const [coinReason, setCoinReason] = useState('');

  if (!user) return <EmptyState icon={UserX} title={t('user.notFound')} body={t('user.notFoundBody')} />;

  const n = userNumbers(data, user.id);
  const hostName = (hid: string) => data.hosts.find((h) => h.id === hid)?.name ?? hid;

  const purchaseCols: Column<Purchase>[] = [
    { key: 'pack', header: t('common.pack'), cell: (p) => <span className="font-medium">{t('payments.packCoins', { pack: translateMaybe(t, 'packName', p.pack), n: formatNumber(p.coins) })}</span> },
    { key: 'when', header: t('common.when'), sort: (p) => p.createdAt, cell: (p) => formatDateTime(p.createdAt, lang) },
    { key: 'platform', header: t('common.store'), cell: (p) => (p.platform === 'android' ? t('common.googlePlay') : t('common.appStore')) },
    { key: 'amount', header: t('common.amount'), align: 'right', sort: (p) => p.pricePaise, cell: (p) => formatRupees(p.pricePaise) },
    {
      key: 'status',
      header: '',
      align: 'right',
      cell: (p) =>
        p.status === 'refunded' ? (
          <Pill tone="neutral" icon={RotateCcw}>
            {t('common.refunded')}
          </Pill>
        ) : (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setPending({ kind: 'refundPurchase', id: p.id })}>
            {t('common.refund')}
          </Button>
        ),
    },
  ];

  const callCols: Column<Call>[] = [
    {
      key: 'host',
      header: t('common.host'),
      cell: (c) => (
        <Link className="font-medium hover:underline" href={`/hosts/${c.hostId}`}>
          {hostName(c.hostId)}
        </Link>
      ),
    },
    { key: 'when', header: t('common.when'), sort: (c) => c.startedAt, cell: (c) => formatDateTime(c.startedAt, lang) },
    { key: 'type', header: t('common.type'), cell: (c) => `${t(c.type === 'audio' ? 'common.voice' : 'common.video')} · ${t(`lang.${c.language}`)}` },
    { key: 'dur', header: t('common.duration'), align: 'right', sort: (c) => c.durationSec, cell: (c) => formatDuration(c.durationSec) },
    { key: 'coins', header: t('users.coins'), align: 'right', sort: (c) => c.coins, cell: (c) => (c.refundedCoins ? <span className="text-fg-3">{t('user.refundedOf', { coins: c.coins, refunded: c.refundedCoins })}</span> : c.coins + c.giftCoins) },
    { key: 'rating', header: t('user.rated'), cell: (c) => (c.rating ? <StarsText value={c.rating} /> : <span className="text-fg-3">—</span>) },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (c) =>
        c.coins > 0 ? (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setPending({ kind: 'refundCall', id: c.id })}>
            {t('common.refund')}
          </Button>
        ) : null,
    },
  ];

  const confirmCopy =
    pending?.kind === 'status'
      ? {
          title: t(STATUS_COPY[pending.status].title, { name: user.name }),
          body: t(STATUS_COPY[pending.status].body),
          label: t(STATUS_COPY[pending.status].label),
          danger: pending.status !== 'active',
        }
      : pending?.kind === 'refundPurchase'
        ? { title: t('user.refundPurchaseTitle'), body: t('user.refundPurchaseBody'), label: t('common.refund'), danger: true }
        : pending?.kind === 'refundCall'
          ? { title: t('user.refundCallTitle'), body: t('user.refundCallBody'), label: t('user.refundCall'), danger: true }
          : null;

  const delta = Number(coinDelta);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/users" className="inline-flex w-fit items-center gap-1 text-sm text-fg-3 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> {t('user.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={user.name} size={56} />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold sm:text-2xl">{user.name}</h1>
            <p className="text-sm text-fg-3">
              {user.phone} · {user.age} · {user.city} · {user.device} · {t('common.id', { id: user.id })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <AccountStatus status={user.status} />
              {user.flags.map((f) => (
                <Pill key={f} tone="warn" icon={Flag}>
                  {translateMaybe(t, 'flag', f)}
                </Pill>
              ))}
              {user.languages.map((l) => (
                <Pill key={l}>{t(`lang.${l}`)}</Pill>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Coins} onClick={() => setCoinsOpen(true)}>
            {t('user.adjustCoins')}
          </Button>
          {user.status === 'active' ? (
            <Button icon={PauseCircle} onClick={() => setPending({ kind: 'status', status: 'suspended' })}>
              {t('common.suspend')}
            </Button>
          ) : user.status !== 'deleted' ? (
            <Button icon={PlayCircle} onClick={() => setPending({ kind: 'status', status: 'active' })}>
              {t('common.reactivate')}
            </Button>
          ) : null}
          {user.status !== 'banned' && user.status !== 'deleted' && (
            <Button variant="danger" icon={Ban} onClick={() => setPending({ kind: 'status', status: 'banned' })}>
              {t('common.ban')}
            </Button>
          )}
          {user.status !== 'deleted' && (
            <Button variant="ghost" icon={Trash2} onClick={() => setPending({ kind: 'status', status: 'deleted' })}>
              {t('common.delete')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('user.totalSpent')} value={formatRupees(user.spentPaise)} sub={t('user.purchasesN', { n: n.purchases.length })} icon={Receipt} />
        <Kpi label={t('user.balance')} value={formatNumber(user.coins)} sub={t('user.currentWallet')} icon={Coins} />
        <Kpi label={t('user.calls')} value={formatNumber(n.calls.length)} sub={t('common.minutesN', { n: formatNumber(n.minutes) })} icon={PhoneCall} />
        <Kpi label={t('user.reportsAgainst')} value={String(n.reportsAgainst.length)} sub={t('user.filedByThem', { n: n.reportsFiled.length })} icon={Flag} tone={n.reportsAgainst.length ? 'bad' : undefined} />
      </div>

      <Card title={t('user.purchases')} description={t('user.purchasesDesc')}>
        <DataTable rows={n.purchases} columns={purchaseCols} rowKey={(p) => p.id} pageSize={8} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={Receipt} title={t('user.noPurchases')} />} />
      </Card>

      <Card title={t('user.calls')}>
        <DataTable rows={n.calls} columns={callCols} rowKey={(c) => c.id} pageSize={10} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={PhoneCall} title={t('user.noCalls')} />} />
      </Card>

      <Card title={t('user.reports')}>
        {n.reportsAgainst.length + n.reportsFiled.length === 0 ? (
          <EmptyState icon={Flag} title={t('user.noReports')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {[...n.reportsAgainst.map((r) => ({ r, against: true })), ...n.reportsFiled.map((r) => ({ r, against: false }))].map(({ r, against }) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-sm">
                <Pill tone={against ? 'bad' : 'neutral'}>{against ? t('user.against') : t('user.filed')}</Pill>
                <SeverityPill severity={r.severity} />
                <span className="font-medium">{t(`reportCat.${r.category}`)}</span>
                <span className="min-w-0 flex-1 basis-full text-fg-2 sm:basis-auto">{r.details}</span>
                <ReportStatusPill status={r.status} />
                <Link href="/reports" className="text-xs font-medium text-brand hover:underline">
                  {t('common.open')}
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
            if (!pending) return;
            const saved =
              pending.kind === 'status' ? data.setUserStatus(user.id, pending.status, reason) : pending.kind === 'refundPurchase' ? data.refundPurchase(pending.id, reason) : data.refundCall(pending.id, reason);
            const label = confirmCopy.label;
            saved.then(() => toast.good(t('common.doneLogged', { action: label })), () => {});
          }}
        />
      )}

      <Modal
        open={coinsOpen}
        onClose={() => setCoinsOpen(false)}
        title={t('user.adjustCoins')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCoinsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!Number.isInteger(delta) || delta === 0 || coinReason.trim().length < 3}
              onClick={() => {
                data.adjustCoins(user.id, delta, coinReason.trim()).then(() => toast.good(t(delta > 0 ? 'user.added' : 'user.removed', { n: Math.abs(delta) })), () => {});
                setCoinsOpen(false);
                setCoinDelta('');
                setCoinReason('');
              }}>
              {t('common.apply')}
            </Button>
          </>
        }>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-2">{t('user.currentBalance', { n: formatNumber(user.coins) })}</p>
          <Field label={t('user.coinsField')} hint={t('user.coinsHint')}>
            {(fid) => <input id={fid} type="number" step={1} value={coinDelta} onChange={(e) => setCoinDelta(e.target.value)} className={inputClass} />}
          </Field>
          <Field label={t('common.reasonRequired')}>{(fid) => <input id={fid} value={coinReason} onChange={(e) => setCoinReason(e.target.value)} placeholder={t('common.savedInAudit')} className={inputClass} />}</Field>
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
