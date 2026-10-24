'use client';

import { ArrowLeft, Ban, Eye, EyeOff, Flag, IndianRupee, MessageSquareQuote, PauseCircle, PhoneCall, PlayCircle, Ribbon, ShieldCheck, Star, UserX, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { FactorBreakdown, RiskPill, StarsText, TierPill } from '@/components/quality';
import { AccountStatus, PayoutStatus, PresencePill, ReportStatusPill, SeverityPill } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, ConfirmAction, DataTable, EmptyState, Kpi, Pill, Select, toast, type Column } from '@/components/ui';
import { effectiveLevel, formatDateTime, formatDuration, formatNumber, formatRupees, hostNumbers, hostQuality } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import { LANGUAGE_LABEL, REPORT_LABEL, type Call } from '@/lib/data/types';

type Pending = { kind: 'suspend' | 'ban' | 'reactivate' | 'strike' | 'clear' } | { kind: 'hide'; callId: string; hidden: boolean } | null;

function HostDetailView() {
  const { id } = useParams<{ id: string }>();
  const data = useAdmin();
  const host = data.hosts.find((h) => h.id === id);
  const [pending, setPending] = useState<Pending>(null);

  if (!host) return <EmptyState icon={UserX} title="Host not found" />;

  const q = hostQuality(host);
  const n = hostNumbers(data, host.id);
  const userName = (uid: string) => data.users.find((u) => u.id === uid)?.name ?? uid;
  const reviews = n.calls.filter((c) => c.rating).sort((a, b) => b.startedAt - a.startedAt);
  const payouts = data.payouts.filter((p) => p.hostId === host.id);
  const tagCounts = new Map<string, number>();
  for (const c of n.reviews) for (const t of c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);

  const callCols: Column<Call>[] = [
    { key: 'when', header: 'When', sort: (c) => c.startedAt, cell: (c) => formatDateTime(c.startedAt) },
    { key: 'caller', header: 'Caller', cell: (c) => <Link className="font-medium hover:underline" href={`/users/${c.userId}`}>{userName(c.userId)}</Link> },
    { key: 'type', header: 'Type', cell: (c) => `${c.type === 'audio' ? 'Voice' : 'Video'} · ${LANGUAGE_LABEL[c.language]}` },
    { key: 'dur', header: 'Duration', align: 'right', sort: (c) => c.durationSec, cell: (c) => formatDuration(c.durationSec) },
    { key: 'earned', header: 'She earned', align: 'right', sort: (c) => c.hostEarnedPaise, cell: (c) => formatRupees(c.hostEarnedPaise) },
    { key: 'gift', header: 'Gifts', align: 'right', sort: (c) => c.giftCoins, cell: (c) => (c.giftCoins ? `${c.giftCoins} coins` : <span className="text-fg-3">—</span>) },
  ];

  const copy: Record<string, { title: string; body: string; label: string; danger: boolean }> = {
    suspend: { title: `Suspend ${host.name}?`, body: 'She goes offline, disappears from the app and payouts are held until reactivated.', label: 'Suspend', danger: true },
    ban: { title: `Ban ${host.name}?`, body: 'Permanent. Her ID can’t be used to host again. Payouts are held for review.', label: 'Ban', danger: true },
    reactivate: { title: `Reactivate ${host.name}?`, body: 'She can go online again.', label: 'Reactivate', danger: false },
    strike: { title: `Add a strike to ${host.name}?`, body: 'A strike removes her Spotlight tier and cuts her score by 15% per strike. 3 strikes in 90 days means a ban.', label: 'Add strike', danger: true },
    clear: { title: 'Clear all strikes?', body: 'Use this after a successful appeal.', label: 'Clear strikes', danger: false },
    hide: { title: 'Hide this review?', body: 'Hidden reviews don’t count toward her rating or show in the app. Use for abusive or fake reviews.', label: 'Hide review', danger: true },
    show: { title: 'Restore this review?', body: 'It will count and show again.', label: 'Restore', danger: false },
  };
  const active = pending ? copy[pending.kind === 'hide' ? (pending.hidden ? 'hide' : 'show') : pending.kind] : null;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/hosts" className="inline-flex w-fit items-center gap-1 text-sm text-fg-3 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Hosts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={host.name} colors={host.colors} size={60} />
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
              {host.name}, {host.age}
              <ShieldCheck className="size-5 text-info" aria-label="KYC verified" />
            </h1>
            <p className="text-sm text-fg-3">
              {host.city} · {host.phone} · joined {new Date(host.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · ID {host.id}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {host.status === 'active' ? <PresencePill presence={host.presence} /> : <AccountStatus status={host.status} />}
              {q.atRisk ? <RiskPill /> : <TierPill tier={q.tier} />}
              {host.featured && <Pill tone="brand" icon={Ribbon}>Featured</Pill>}
              {host.strikes > 0 && <Pill tone="bad" icon={Flag}>{host.strikes} strike{host.strikes > 1 ? 's' : ''}</Pill>}
              <Pill>Level {effectiveLevel(host)}{host.levelOverride ? ' (override)' : ''}</Pill>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            icon={Ribbon}
            variant={host.featured ? 'secondary' : 'primary'}
            disabled={host.status !== 'active'}
            onClick={() => {
              data.setFeatured(host.id, !host.featured);
              toast.good(host.featured ? 'Removed from featured' : `${host.name} is now featured in Spotlight`);
            }}>
            {host.featured ? 'Unfeature' : 'Feature in Spotlight'}
          </Button>
          <Select
            label="Level override"
            value={String(host.levelOverride ?? 'auto')}
            onChange={(v) => {
              data.setLevelOverride(host.id, v === 'auto' ? null : (Number(v) as 1 | 2 | 3 | 4));
              toast.good('Level updated');
            }}
            options={[
              { value: 'auto', label: `Level: auto (L${host.level})` },
              { value: '1', label: 'Override: L1 · 35%' },
              { value: '2', label: 'Override: L2 · 40%' },
              { value: '3', label: 'Override: L3 · 45%' },
              { value: '4', label: 'Override: L4 · 50%' },
            ]}
          />
          <Button icon={Flag} onClick={() => setPending({ kind: 'strike' })}>
            Strike
          </Button>
          {host.strikes > 0 && (
            <Button variant="ghost" onClick={() => setPending({ kind: 'clear' })}>
              Clear strikes
            </Button>
          )}
          {host.status === 'active' ? (
            <Button icon={PauseCircle} onClick={() => setPending({ kind: 'suspend' })}>
              Suspend
            </Button>
          ) : (
            <Button icon={PlayCircle} onClick={() => setPending({ kind: 'reactivate' })}>
              Reactivate
            </Button>
          )}
          {host.status !== 'banned' && (
            <Button variant="danger" icon={Ban} onClick={() => setPending({ kind: 'ban' })}>
              Ban
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Spotlight score" value={String(q.score)} sub={q.atRisk ? 'at risk' : q.tier === 'none' ? 'no tier yet' : 'shown to callers'} icon={Star} tone="gold" />
        <Kpi label="Rating" value={host.stats.ratingAvg ? host.stats.ratingAvg.toFixed(2) : '—'} sub={`${formatNumber(host.stats.ratingCount)} ratings`} icon={MessageSquareQuote} />
        <Kpi label="Calls (30d)" value={formatNumber(n.callCount)} sub={`${formatNumber(n.minutes)} min · ${n.uniqueCallers} callers`} icon={PhoneCall} />
        <Kpi label="Earned (30d)" value={formatRupees(n.earned)} sub={`${n.gifts} gift coins`} icon={IndianRupee} tone="good" />
        <Kpi label="Callers who return" value={`${Math.round(host.stats.repeatCallerRate * 100)}%`} sub={`answers ${Math.round(host.stats.answerRate * 100)}% of calls`} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" title="Why her score is what it is" description="The same breakdown and tips she sees in her app">
          <FactorBreakdown quality={q} />
        </Card>
        <Card
          className="lg:col-span-3"
          title="Feedback from callers"
          description={`${reviews.length} rated calls in 30 days · visible to her in the app`}
          action={
            <div className="flex flex-wrap justify-end gap-1">
              {[...tagCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([t, c]) => (
                  <Pill key={t} tone="info">
                    {t} ×{c}
                  </Pill>
                ))}
            </div>
          }>
          {reviews.length === 0 ? (
            <EmptyState icon={MessageSquareQuote} title="No ratings yet" />
          ) : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
              {reviews.slice(0, 40).map((c) => (
                <li key={c.id} className={`rounded-lg border border-line p-3 ${c.reviewHidden ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <StarsText value={c.rating ?? 0} />
                    <span className="font-medium">{userName(c.userId)}</span>
                    <span className="text-xs text-fg-3">{formatDateTime(c.startedAt)}</span>
                    {c.reviewHidden && <Pill icon={EyeOff}>Hidden</Pill>}
                    <Button className="ml-auto" size="sm" variant="ghost" icon={c.reviewHidden ? Eye : EyeOff} onClick={() => setPending({ kind: 'hide', callId: c.id, hidden: !c.reviewHidden })}>
                      {c.reviewHidden ? 'Restore' : 'Hide'}
                    </Button>
                  </div>
                  {c.comment && <p className="mt-1 text-sm text-fg-2">“{c.comment}”</p>}
                  {!!c.tags?.length && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Pill key={t}>{t}</Pill>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Verification (KYC)">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-fg-3">PAN</dt>
              <dd className="font-medium">{host.kyc.pan.slice(0, 2)}•••••{host.kyc.pan.slice(-2)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-3">Aadhaar</dt>
              <dd className="font-medium">•••• •••• {host.kyc.aadhaarLast4}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-3">Selfie face match</dt>
              <dd className="font-medium">{host.kyc.faceMatch}%</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-3">Payout to</dt>
              <dd className="font-medium">{host.payout}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-fg-3">Bio</dt>
              <dd className="text-fg-2">{host.bio}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Reports & payouts">
          <div className="flex flex-col gap-2">
            {n.reports.length === 0 && payouts.length === 0 && <EmptyState icon={ShieldCheck} title="Clean record" body="No reports and no payouts yet." />}
            {n.reports.map((r) => (
              <Link key={r.id} href="/reports" className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2.5 text-sm hover:bg-surface-2">
                <SeverityPill severity={r.severity} />
                <span className="font-medium">{REPORT_LABEL[r.category]}</span>
                <span className="flex-1 truncate text-fg-3">{r.details}</span>
                <ReportStatusPill status={r.status} />
              </Link>
            ))}
            {payouts.map((p) => (
              <Link key={p.id} href="/payments" className="flex items-center gap-2 rounded-lg border border-line p-2.5 text-sm hover:bg-surface-2">
                <IndianRupee className="size-4 text-fg-3" aria-hidden />
                <span className="tabular flex-1 font-medium">{formatRupees(p.amountPaise)} payout</span>
                <PayoutStatus status={p.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Calls (30 days)">
        <DataTable rows={n.calls} columns={callCols} rowKey={(c) => c.id} pageSize={10} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={PhoneCall} title="No calls yet" />} />
      </Card>

      {active && (
        <ConfirmAction
          open
          onClose={() => setPending(null)}
          title={active.title}
          body={active.body}
          confirmLabel={active.label}
          danger={active.danger}
          onConfirm={(reason) => {
            if (!pending) return;
            if (pending.kind === 'suspend') data.setHostStatus(host.id, 'suspended', reason);
            if (pending.kind === 'ban') data.setHostStatus(host.id, 'banned', reason);
            if (pending.kind === 'reactivate') data.setHostStatus(host.id, 'active', reason);
            if (pending.kind === 'strike') data.addStrike(host.id, reason);
            if (pending.kind === 'clear') data.clearStrikes(host.id, reason);
            if (pending.kind === 'hide') data.setReviewHidden(pending.callId, pending.hidden, reason);
            toast.good(`${active.label}: done`);
          }}
        />
      )}
    </div>
  );
}

export default function HostDetail() {
  return (
    <Ready>
      <HostDetailView />
    </Ready>
  );
}
