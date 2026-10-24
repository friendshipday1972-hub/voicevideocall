'use client';

import { AlarmClock, Flag, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ReportStatusPill, SeverityPill } from '@/components/status';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, EmptyState, Field, Modal, PageHeader, Pill, Tabs, cx, inputClass, toast } from '@/components/ui';
import { formatDateTime, formatDuration, timeAgo } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import { REPORT_LABEL, type Report } from '@/lib/data/types';

type Tab = 'open' | 'actioned' | 'dismissed';
type Action = 'dismiss' | 'warn' | 'strike' | 'suspend' | 'ban';

/** SLA (spec §9.4): sexual content and underage within 1 hour, everything else within 24 hours. */
const slaMs = (r: Report) => (r.severity >= 3 ? 3_600_000 : 24 * 3_600_000);

const ACTIONS: { value: Action; label: string; hint: string }[] = [
  { value: 'dismiss', label: 'Dismiss', hint: 'No rule was broken.' },
  { value: 'warn', label: 'Warn', hint: 'Send a warning. Severity 1.' },
  { value: 'strike', label: 'Strike (hosts)', hint: 'Removes tier, −15% score. 3 strikes = ban.' },
  { value: 'suspend', label: 'Suspend 7 days', hint: 'Can’t use the app; payouts held.' },
  { value: 'ban', label: 'Ban permanently', hint: 'Underage, repeated sexual content, extortion.' },
];

function ReportsPageView() {
  const data = useAdmin();
  const [tab, setTab] = useState<Tab>('open');
  const [active, setActive] = useState<Report | null>(null);
  const [action, setAction] = useState<Action>('warn');
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
      <PageHeader title="Reports" description="Safety queue, most serious first. Sexual-content and underage reports must be handled within 1 hour; everything else within 24 hours." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'open', label: 'Open', count: data.reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length },
          { value: 'actioned', label: 'Actioned', count: data.reports.filter((r) => r.status === 'actioned').length },
          { value: 'dismissed', label: 'Dismissed', count: data.reports.filter((r) => r.status === 'dismissed').length },
        ]}
      />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={tab === 'open' ? 'Queue is clear' : 'Nothing here'} body={tab === 'open' ? 'New reports from callers and hosts appear here.' : undefined} />
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
                        <span className="font-medium">{REPORT_LABEL[r.category]}</span>
                        <span className="text-fg-3"> against {r.targetRole === 'host' ? 'host' : 'caller'} </span>
                        <span className="font-medium">{name(r.targetId, r.targetRole)}</span>
                        <span className="text-fg-3"> · by {name(r.reporterId, r.reporterRole)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fg-3">{r.details}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <SeverityPill severity={r.severity} />
                        <ReportStatusPill status={r.status} />
                        {tab === 'open' ? (
                          <Pill tone={overdue ? 'bad' : 'neutral'} icon={AlarmClock}>
                            {overdue ? 'SLA missed · ' : ''}
                            {timeAgo(r.createdAt, now)}
                          </Pill>
                        ) : (
                          <span className="text-xs text-fg-3">{r.resolution}</span>
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
          title={`Report · ${REPORT_LABEL[active.category]}`}
          footer={
            active.status === 'open' || active.status === 'reviewing' ? (
              <>
                <Button variant="ghost" onClick={() => setActive(null)}>
                  Cancel
                </Button>
                <Button
                  variant={action === 'dismiss' ? 'secondary' : 'danger'}
                  disabled={note.trim().length < 3}
                  onClick={() => {
                    const label = ACTIONS.find((a) => a.value === action)?.label ?? action;
                    data.resolveReport(active.id, action === 'dismiss' ? 'dismissed' : 'actioned', `${label}: ${note.trim()}`, action === 'dismiss' ? undefined : action, action !== 'dismiss' && refund);
                    toast.good(`Report ${action === 'dismiss' ? 'dismissed' : 'actioned'} and logged`);
                    setActive(null);
                  }}>
                  Apply decision
                </Button>
              </>
            ) : undefined
          }>
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <SeverityPill severity={active.severity} />
              <ReportStatusPill status={active.status} />
              <Pill>{formatDateTime(active.createdAt)}</Pill>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-fg-3">Reported {active.targetRole === 'host' ? 'host' : 'caller'}</p>
                <Link href={`/${active.targetRole === 'host' ? 'hosts' : 'users'}/${active.targetId}`} className="font-medium hover:underline">
                  {name(active.targetId, active.targetRole)}
                </Link>
                <p className="text-xs text-fg-3">{history.length} other report{history.length === 1 ? '' : 's'} on record</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-fg-3">Reported by</p>
                <p className="font-medium">{name(active.reporterId, active.reporterRole)}</p>
                {call && (
                  <p className="text-xs text-fg-3">
                    {call.type === 'audio' ? 'Voice' : 'Video'} call · {formatDuration(call.durationSec)} · {call.coins} coins
                  </p>
                )}
              </div>
            </div>
            <blockquote className="rounded-lg border-l-4 border-bad bg-bad-soft/50 px-3 py-2 text-fg">“{active.details}”</blockquote>
            <p className="text-xs text-fg-3">Video reports include a short snapshot taken at the time of the report (shown here once the backend and moderation API are connected).</p>

            {active.status === 'open' || active.status === 'reviewing' ? (
              <>
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-fg-2">Decision</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ACTIONS.filter((a) => a.value !== 'strike' || active.targetRole === 'host').map((a) => (
                      <label key={a.value} className={cx('flex cursor-pointer gap-2 rounded-lg border p-2.5', action === a.value ? 'border-brand bg-brand-soft/40' : 'border-line hover:bg-surface-2')}>
                        <input type="radio" name="action" value={a.value} checked={action === a.value} onChange={() => setAction(a.value)} className="mt-0.5 accent-[var(--brand)]" />
                        <span>
                          <span className="block font-medium">{a.label}</span>
                          <span className="block text-xs text-fg-3">{a.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {call && call.coins > 0 && action !== 'dismiss' && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} className="accent-[var(--brand)]" />
                    Refund the caller for this call ({call.coins} coins)
                  </label>
                )}
                <Field label="Note to the record (required)">{(id) => <textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={cx(inputClass, 'h-auto py-2')} placeholder="What you checked and why" />}</Field>
              </>
            ) : (
              <p>
                <span className="text-fg-3">Resolution: </span>
                {active.resolution}
              </p>
            )}
          </div>
        </Modal>
      )}
      {tab === 'open' && list.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-3">
          <Flag className="size-3.5" aria-hidden /> Every decision is written to the activity log with your name.
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
