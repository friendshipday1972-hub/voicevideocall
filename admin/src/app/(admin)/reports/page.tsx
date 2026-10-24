'use client';

import { AlarmClock, Flag, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ReportStatusPill, SeverityPill } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, EmptyState, Field, Modal, PageHeader, Pill, Tabs, cx, inputClass, toast } from '@/components/ui';
import { useLang, useT, type Translate } from '@/i18n';
import { formatDateTime, formatDuration, timeAgo } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Report, ReportDecision } from '@/lib/data/types';

type Tab = 'open' | 'actioned' | 'dismissed';

/** SLA (spec §9.4): sexual content and underage within 1 hour, everything else within 24 hours. */
const slaMs = (r: Report) => (r.severity >= 3 ? 3_600_000 : 24 * 3_600_000);

const DECISIONS: ReportDecision[] = ['dismiss', 'warn', 'strike', 'suspend', 'ban'];

/** "Warn: checked the call, first offence" in the admin's language; the note stays as typed. */
function resolutionText(r: Report, t: Translate): string {
  const label = r.decision ? t(`reports.action.${r.decision}`) : '';
  return [label, r.resolution].filter(Boolean).join(': ');
}

function ReportsPageView() {
  const data = useAdmin();
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<Tab>('open');
  const [active, setActive] = useState<Report | null>(null);
  const [action, setAction] = useState<ReportDecision>('warn');
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState(true);
  const [now] = useState(() => Date.now());

  const users = useMemo(() => new Map(data.users.map((u) => [u.id, u])), [data.users]);
  const hosts = useMemo(() => new Map(data.hosts.map((h) => [h.id, h])), [data.hosts]);
  const name = (id: string, role: 'user' | 'host') => (role === 'host' ? hosts.get(id)?.name : users.get(id)?.name) ?? id;

  const list = data.reports
    .filter((r) => (tab === 'open' ? r.status === 'open' || r.status === 'reviewing' : r.status === tab))
    .sort((a, b) => (tab === 'open' ? b.severity - a.severity || a.createdAt - b.createdAt : (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)));

  const open = (r: Report) => {
    setActive(r);
    setAction(r.severity >= 4 ? 'ban' : r.severity === 3 ? 'suspend' : r.severity === 2 ? (r.targetRole === 'host' ? 'strike' : 'warn') : 'warn');
    setNote('');
    setRefund(r.reporterRole === 'user');
  };

  const call = active?.callId ? data.calls.find((c) => c.id === active.callId) : undefined;
  const history = active ? data.reports.filter((r) => r.targetId === active.targetId && r.id !== active.id) : [];

  return (
    <>
      <PageHeader title={t('reports.title')} description={t('reports.description')} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'open', label: t('status.open'), count: data.reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length },
          { value: 'actioned', label: t('status.actioned'), count: data.reports.filter((r) => r.status === 'actioned').length },
          { value: 'dismissed', label: t('status.dismissed'), count: data.reports.filter((r) => r.status === 'dismissed').length },
        ]}
      />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={tab === 'open' ? t('reports.clear') : t('reports.nothing')} body={tab === 'open' ? t('reports.clearBody') : undefined} />
        ) : (
          <ul className="flex flex-col">
            {list.map((r) => {
              const overdue = tab === 'open' && now - r.createdAt > slaMs(r);
              const target = r.targetRole === 'host' ? hosts.get(r.targetId) : undefined;
              return (
                <li key={r.id} className="border-b border-line last:border-0">
                  <button onClick={() => open(r)} className="flex w-full cursor-pointer items-start gap-3 p-4 text-left hover:bg-surface-2">
                    <Avatar name={name(r.targetId, r.targetRole)} colors={target?.colors} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">
                        <span className="font-medium">{t(`reportCat.${r.category}`)}</span>
                        <span className="text-fg-3">{r.targetRole === 'host' ? t('reports.againstHost') : t('reports.againstCaller')}</span>
                        <span className="font-medium">{name(r.targetId, r.targetRole)}</span>
                        <span className="text-fg-3">{t('reports.by', { name: name(r.reporterId, r.reporterRole) })}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fg-3">{r.details}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <SeverityPill severity={r.severity} />
                        <ReportStatusPill status={r.status} />
                        {tab === 'open' ? (
                          <Pill tone={overdue ? 'bad' : 'neutral'} icon={AlarmClock}>
                            {overdue ? t('reports.slaMissed') : ''}
                            {timeAgo(r.createdAt, now, t)}
                          </Pill>
                        ) : (
                          <span className="text-xs text-fg-3">{resolutionText(r, t)}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {active && (
        <Modal
          wide
          open
          onClose={() => setActive(null)}
          title={t('reports.modalTitle', { category: t(`reportCat.${active.category}`) })}
          footer={
            active.status === 'open' || active.status === 'reviewing' ? (
              <>
                <Button variant="ghost" onClick={() => setActive(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant={action === 'dismiss' ? 'secondary' : 'danger'}
                  disabled={note.trim().length < 3}
                  onClick={() => {
                    data.resolveReport(active.id, action, note.trim(), refund);
                    toast.good(t('reports.loggedToast'));
                    setActive(null);
                  }}>
                  {t('reports.applyDecision')}
                </Button>
              </>
            ) : undefined
          }>
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <SeverityPill severity={active.severity} />
              <ReportStatusPill status={active.status} />
              <Pill>{formatDateTime(active.createdAt, lang)}</Pill>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-fg-3">{active.targetRole === 'host' ? t('reports.reportedHost') : t('reports.reportedCaller')}</p>
                <Link href={`/${active.targetRole === 'host' ? 'hosts' : 'users'}/${active.targetId}`} className="font-medium hover:underline">
                  {name(active.targetId, active.targetRole)}
                </Link>
                <p className="text-xs text-fg-3">{t('reports.otherReports', { n: history.length })}</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-fg-3">{t('reports.reportedBy')}</p>
                <p className="font-medium">{name(active.reporterId, active.reporterRole)}</p>
                {call && <p className="text-xs text-fg-3">{t('reports.callSummary', { type: t(call.type === 'audio' ? 'common.voice' : 'common.video'), dur: formatDuration(call.durationSec), coins: call.coins })}</p>}
              </div>
            </div>
            <blockquote className="rounded-lg border-l-4 border-bad bg-bad-soft/50 px-3 py-2 text-fg">“{active.details}”</blockquote>
            <p className="text-xs text-fg-3">{t('reports.snapshotNote')}</p>

            {active.status === 'open' || active.status === 'reviewing' ? (
              <>
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-fg-2">{t('reports.decision')}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {DECISIONS.filter((d) => d !== 'strike' || active.targetRole === 'host').map((d) => (
                      <label key={d} className={cx('flex cursor-pointer gap-2 rounded-lg border p-2.5', action === d ? 'border-brand bg-brand-soft/40' : 'border-line hover:bg-surface-2')}>
                        <input type="radio" name="action" value={d} checked={action === d} onChange={() => setAction(d)} className="mt-0.5 accent-[var(--brand)]" />
                        <span>
                          <span className="block font-medium">{t(`reports.action.${d}`)}</span>
                          <span className="block text-xs text-fg-3">{t(`reports.actionHint.${d}`)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {call && call.coins > 0 && action !== 'dismiss' && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} className="accent-[var(--brand)]" />
                    {t('reports.refundCaller', { n: call.coins })}
                  </label>
                )}
                <Field label={t('reports.noteField')}>{(id) => <textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={cx(inputClass, 'h-auto py-2')} placeholder={t('reports.notePlaceholder')} />}</Field>
              </>
            ) : (
              <p>
                <span className="text-fg-3">{t('reports.resolution')}</span>
                {resolutionText(active, t)}
              </p>
            )}
          </div>
        </Modal>
      )}
      {tab === 'open' && list.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-3">
          <Flag className="size-3.5" aria-hidden /> {t('reports.footer')}
        </p>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <Ready>
      <ReportsPageView />
    </Ready>
  );
}
