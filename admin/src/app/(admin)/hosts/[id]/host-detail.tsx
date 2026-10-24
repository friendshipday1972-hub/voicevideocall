'use client';

import { ArrowLeft, Ban, Eye, EyeOff, Flag, IndianRupee, MessageSquareQuote, PauseCircle, PhoneCall, PlayCircle, Ribbon, ShieldCheck, Star, UserX, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { FactorBreakdown, RiskPill, StarsText, TierPill } from '@/components/quality';
import { AccountStatus, PayoutStatus, PresencePill, ReportStatusPill, SeverityPill } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, ConfirmAction, DataTable, EmptyState, Kpi, Pill, Select, toast, type Column } from '@/components/ui';
import { translateMaybe, useLang, useT } from '@/i18n';
import { effectiveLevel, formatDate, formatDateTime, formatDuration, formatNumber, formatRupees, hostNumbers, hostQuality } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Call } from '@/lib/data/types';

type Pending = { kind: 'suspend' | 'ban' | 'reactivate' | 'strike' | 'clear' } | { kind: 'hide'; callId: string; hidden: boolean } | null;

const SHARE = [35, 40, 45, 50];

function HostDetailView() {
  const { id } = useParams<{ id: string }>();
  const data = useAdmin();
  const t = useT();
  const lang = useLang();
  const host = data.hosts.find((h) => h.id === id);
  const [pending, setPending] = useState<Pending>(null);

  if (!host) return <EmptyState icon={UserX} title={t('host.notFound')} />;

  const q = hostQuality(host);
  const n = hostNumbers(data, host.id);
  const userName = (uid: string) => data.users.find((u) => u.id === uid)?.name ?? uid;
  const reviews = n.calls.filter((c) => c.rating).sort((a, b) => b.startedAt - a.startedAt);
  const payouts = data.payouts.filter((p) => p.hostId === host.id);
  const tagCounts = new Map<string, number>();
  for (const c of n.reviews) for (const tag of c.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

  const callCols: Column<Call>[] = [
    {
      key: 'caller',
      header: t('common.caller'),
      cell: (c) => (
        <Link className="font-medium hover:underline" href={`/users/${c.userId}`}>
          {userName(c.userId)}
        </Link>
      ),
    },
    { key: 'when', header: t('common.when'), sort: (c) => c.startedAt, cell: (c) => formatDateTime(c.startedAt, lang) },
    { key: 'type', header: t('common.type'), cell: (c) => `${t(c.type === 'audio' ? 'common.voice' : 'common.video')} · ${t(`lang.${c.language}`)}` },
    { key: 'dur', header: t('common.duration'), align: 'right', sort: (c) => c.durationSec, cell: (c) => formatDuration(c.durationSec) },
    { key: 'earned', header: t('host.sheEarned'), align: 'right', sort: (c) => c.hostEarnedPaise, cell: (c) => formatRupees(c.hostEarnedPaise) },
    { key: 'gift', header: t('common.gifts'), align: 'right', sort: (c) => c.giftCoins, cell: (c) => (c.giftCoins ? t('common.coinsN', { n: c.giftCoins }) : <span className="text-fg-3">—</span>) },
  ];

  const copy = {
    suspend: { title: t('host.suspendTitle', { name: host.name }), body: t('host.suspendBody'), label: t('common.suspend'), danger: true },
    ban: { title: t('host.banTitle', { name: host.name }), body: t('host.banBody'), label: t('common.ban'), danger: true },
    reactivate: { title: t('host.reactivateTitle', { name: host.name }), body: t('host.reactivateBody'), label: t('common.reactivate'), danger: false },
    strike: { title: t('host.strikeTitle', { name: host.name }), body: t('host.strikeBody'), label: t('host.addStrike'), danger: true },
    clear: { title: t('host.clearTitle'), body: t('host.clearBody'), label: t('host.clearStrikes'), danger: false },
    hide: { title: t('host.hideTitle'), body: t('host.hideBody'), label: t('host.hideReview'), danger: true },
    show: { title: t('host.showTitle'), body: t('host.showBody'), label: t('common.restore'), danger: false },
  };
  const active = pending ? copy[pending.kind === 'hide' ? (pending.hidden ? 'hide' : 'show') : pending.kind] : null;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/hosts" className="inline-flex w-fit items-center gap-1 text-sm text-fg-3 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> {t('host.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={host.name} colors={host.colors} size={60} />
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-xl font-semibold sm:text-2xl">
              {host.name}, {host.age}
              <ShieldCheck className="size-5 text-info" aria-label={t('host.kycVerified')} />
            </h1>
            <p className="text-sm text-fg-3">
              {host.city} · {host.phone} · {t('host.joined', { date: formatDate(host.joinedAt, lang, { month: 'short', year: 'numeric' }) })} · {t('common.id', { id: host.id })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {host.status === 'active' ? <PresencePill presence={host.presence} /> : <AccountStatus status={host.status} />}
              {q.atRisk ? <RiskPill /> : <TierPill tier={q.tier} />}
              {host.featured && (
                <Pill tone="brand" icon={Ribbon}>
                  {t('common.featured')}
                </Pill>
              )}
              {host.strikes > 0 && (
                <Pill tone="bad" icon={Flag}>
                  {host.strikes === 1 ? t('host.strikeOne') : t('host.strikesN', { n: host.strikes })}
                </Pill>
              )}
              <Pill>
                {t('common.levelN', { n: effectiveLevel(host) })}
                {host.levelOverride ? t('host.override') : ''}
              </Pill>
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
              toast.good(host.featured ? t('host.unfeatured') : t('host.nowFeatured', { name: host.name }));
            }}>
            {host.featured ? t('host.unfeature') : t('host.featureInSpotlight')}
          </Button>
          <Select
            label={t('host.levelOverride')}
            value={String(host.levelOverride ?? 'auto')}
            onChange={(v) => {
              data.setLevelOverride(host.id, v === 'auto' ? null : (Number(v) as 1 | 2 | 3 | 4));
              toast.good(t('host.levelUpdated'));
            }}
            options={[{ value: 'auto', label: t('host.levelAuto', { n: host.level }) }, ...SHARE.map((pct, i) => ({ value: String(i + 1), label: t('host.overrideOption', { n: i + 1, pct }) }))]}
          />
          <Button icon={Flag} onClick={() => setPending({ kind: 'strike' })}>
            {t('host.strike')}
          </Button>
          {host.strikes > 0 && (
            <Button variant="ghost" onClick={() => setPending({ kind: 'clear' })}>
              {t('host.clearStrikes')}
            </Button>
          )}
          {host.status === 'active' ? (
            <Button icon={PauseCircle} onClick={() => setPending({ kind: 'suspend' })}>
              {t('common.suspend')}
            </Button>
          ) : (
            <Button icon={PlayCircle} onClick={() => setPending({ kind: 'reactivate' })}>
              {t('common.reactivate')}
            </Button>
          )}
          {host.status !== 'banned' && (
            <Button variant="danger" icon={Ban} onClick={() => setPending({ kind: 'ban' })}>
              {t('common.ban')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={t('host.score')} value={String(q.score)} sub={q.atRisk ? t('host.atRisk') : q.tier === 'none' ? t('host.noTier') : t('host.shown')} icon={Star} tone="gold" />
        <Kpi label={t('common.rating')} value={host.stats.ratingAvg ? host.stats.ratingAvg.toFixed(2) : '—'} sub={t('common.ratingsN', { n: formatNumber(host.stats.ratingCount) })} icon={MessageSquareQuote} />
        <Kpi label={t('host.calls30')} value={formatNumber(n.callCount)} sub={t('host.callsSub', { min: formatNumber(n.minutes), callers: n.uniqueCallers })} icon={PhoneCall} />
        <Kpi label={t('host.earned30')} value={formatRupees(n.earned)} sub={t('host.giftCoins', { n: n.gifts })} icon={IndianRupee} tone="good" />
        <Kpi label={t('host.returnRate')} value={`${Math.round(host.stats.repeatCallerRate * 100)}%`} sub={t('host.answers', { n: Math.round(host.stats.answerRate * 100) })} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" title={t('host.whyScore')} description={t('host.whyScoreDesc')}>
          <FactorBreakdown quality={q} />
        </Card>
        <Card
          className="lg:col-span-3"
          title={t('host.feedback')}
          description={t('host.feedbackDesc', { n: reviews.length })}
          action={
            <div className="flex flex-wrap gap-1 sm:justify-end">
              {[...tagCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([tag, c]) => (
                  <Pill key={tag} tone="info">
                    {translateMaybe(t, 'tag', tag)} ×{c}
                  </Pill>
                ))}
            </div>
          }>
          {reviews.length === 0 ? (
            <EmptyState icon={MessageSquareQuote} title={t('host.noRatings')} />
          ) : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
              {reviews.slice(0, 40).map((c) => (
                <li key={c.id} className={`rounded-lg border border-line p-3 ${c.reviewHidden ? 'opacity-50' : ''}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <StarsText value={c.rating ?? 0} />
                    <span className="font-medium">{userName(c.userId)}</span>
                    <span className="text-xs text-fg-3">{formatDateTime(c.startedAt, lang)}</span>
                    {c.reviewHidden && <Pill icon={EyeOff}>{t('common.hidden')}</Pill>}
                    <Button className="ml-auto" size="sm" variant="ghost" icon={c.reviewHidden ? Eye : EyeOff} onClick={() => setPending({ kind: 'hide', callId: c.id, hidden: !c.reviewHidden })}>
                      {c.reviewHidden ? t('common.restore') : t('common.hide')}
                    </Button>
                  </div>
                  {c.comment && <p className="mt-1 text-sm text-fg-2">“{c.comment}”</p>}
                  {!!c.tags?.length && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.tags.map((tag) => (
                        <Pill key={tag}>{translateMaybe(t, 'tag', tag)}</Pill>
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
        <Card title={t('host.kyc')}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-fg-3">{t('host.pan')}</dt>
              <dd className="font-medium">
                {host.kyc.pan.slice(0, 2)}•••••{host.kyc.pan.slice(-2)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-3">{t('host.aadhaar')}</dt>
              <dd className="font-medium">•••• •••• {host.kyc.aadhaarLast4}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-3">{t('host.faceMatch')}</dt>
              <dd className="font-medium">{host.kyc.faceMatch}%</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-fg-3">{t('host.payoutTo')}</dt>
              <dd className="break-all font-medium">{host.payout}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-fg-3">{t('host.bio')}</dt>
              <dd className="text-fg-2">{host.bio}</dd>
            </div>
          </dl>
        </Card>
        <Card title={t('host.reportsPayouts')}>
          <div className="flex flex-col gap-2">
            {n.reports.length === 0 && payouts.length === 0 && <EmptyState icon={ShieldCheck} title={t('host.clean')} body={t('host.cleanBody')} />}
            {n.reports.map((r) => (
              <Link key={r.id} href="/reports" className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2.5 text-sm hover:bg-surface-2">
                <SeverityPill severity={r.severity} />
                <span className="font-medium">{t(`reportCat.${r.category}`)}</span>
                <span className="min-w-0 flex-1 truncate text-fg-3">{r.details}</span>
                <ReportStatusPill status={r.status} />
              </Link>
            ))}
            {payouts.map((p) => (
              <Link key={p.id} href="/payments" className="flex items-center gap-2 rounded-lg border border-line p-2.5 text-sm hover:bg-surface-2">
                <IndianRupee className="size-4 text-fg-3" aria-hidden />
                <span className="tabular flex-1 font-medium">{t('host.payoutOf', { amount: formatRupees(p.amountPaise) })}</span>
                <PayoutStatus status={p.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card title={t('host.calls')}>
        <DataTable rows={n.calls} columns={callCols} rowKey={(c) => c.id} pageSize={10} initialSort={{ key: 'when', dir: 'desc' }} empty={<EmptyState icon={PhoneCall} title={t('host.noCalls')} />} />
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
            toast.good(t('common.done', { action: active.label }));
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
