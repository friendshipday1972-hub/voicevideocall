'use client';

import { BadgeCheck, CheckCircle2, Clock, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Ready } from '@/components/shell';
import { Avatar, Button, Card, ConfirmAction, EmptyState, PageHeader, Pill, Tabs, cx, toast } from '@/components/ui';
import { formatDateTime, timeAgo } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import { LANGUAGE_LABEL, type Application } from '@/lib/data/types';

type Check = { label: string; ok: boolean; detail: string; blocking: boolean };

/** Automatic checks run on every application (provider results with the real KYC integration). */
function checks(a: Application, hostNames: Map<string, string>): Check[] {
  return [
    { label: 'Woman (from Aadhaar)', ok: a.aadhaarGender === 'female', detail: `Aadhaar gender: ${a.aadhaarGender}`, blocking: true },
    { label: '18 or older (from Aadhaar)', ok: a.aadhaarAge >= 18, detail: `Aadhaar age: ${a.aadhaarAge}${a.aadhaarAge !== a.age ? ` (said ${a.age})` : ''}`, blocking: true },
    { label: 'Selfie matches ID photo', ok: a.faceMatch >= 90, detail: `${a.faceMatch}% match (90%+ required)`, blocking: false },
    { label: 'Live person (liveness)', ok: a.livenessPassed, detail: a.livenessPassed ? 'Passed' : 'Failed: possible photo of a photo', blocking: false },
    { label: 'Not a duplicate ID', ok: !a.duplicateOf, detail: a.duplicateOf ? `PAN/face resembles host ${hostNames.get(a.duplicateOf) ?? a.duplicateOf}` : 'No match with existing hosts', blocking: false },
  ];
}

function recommendation(cs: Check[]): { tone: 'good' | 'warn' | 'bad'; text: string } {
  if (cs.some((c) => c.blocking && !c.ok)) return { tone: 'bad', text: 'Reject: fails a mandatory requirement' };
  if (cs.some((c) => !c.ok)) return { tone: 'warn', text: 'Review manually before approving' };
  return { tone: 'good', text: 'All checks passed: safe to approve' };
}

function ApplicationsPageView() {
  const data = useAdmin();
  const [tab, setTab] = useState<Application['status']>('pending');
  const [action, setAction] = useState<{ app: Application; kind: 'approve' | 'reject' } | null>(null);
  const [now] = useState(() => Date.now());
  const hostNames = new Map(data.hosts.map((h) => [h.id, h.name]));
  const list = data.applications.filter((a) => a.status === tab).sort((a, b) => (tab === 'pending' ? a.submittedAt - b.submittedAt : (b.decidedAt ?? 0) - (a.decidedAt ?? 0)));

  return (
    <>
      <PageHeader title="KYC approvals" description="Women who applied to become hosts. Nobody goes live without passing ID, age, gender and selfie checks plus your approval. Oldest first." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pending', label: 'Waiting', count: data.applications.filter((a) => a.status === 'pending').length },
          { value: 'approved', label: 'Approved', count: data.applications.filter((a) => a.status === 'approved').length },
          { value: 'rejected', label: 'Rejected', count: data.applications.filter((a) => a.status === 'rejected').length },
        ]}
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={BadgeCheck} title={tab === 'pending' ? 'All caught up' : 'Nothing here yet'} body={tab === 'pending' ? 'New applications will appear here.' : undefined} />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((a) => {
            const cs = checks(a, hostNames);
            const rec = recommendation(cs);
            const overdue = tab === 'pending' && now - a.submittedAt > 24 * 3_600_000;
            return (
              <Card key={a.id}>
                <div className="flex flex-col gap-4 p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Avatar name={a.name} colors={['#F472B6', '#7C3AED']} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-semibold">
                        {a.name}, {a.age}
                      </p>
                      <p className="text-sm text-fg-3">
                        {a.city} · {a.phone} · {a.languages.map((l) => LANGUAGE_LABEL[l]).join(', ')}
                      </p>
                    </div>
                    {tab === 'pending' ? (
                      <Pill tone={overdue ? 'bad' : 'neutral'} icon={Clock}>
                        {overdue ? 'Over 24h · ' : ''}
                        {timeAgo(a.submittedAt, now)}
                      </Pill>
                    ) : (
                      <Pill tone={a.status === 'approved' ? 'good' : 'bad'} icon={a.status === 'approved' ? CheckCircle2 : XCircle}>
                        {a.status === 'approved' ? 'Approved' : 'Rejected'} {a.decidedAt ? formatDateTime(a.decidedAt) : ''}
                      </Pill>
                    )}
                  </div>

                  <p className="text-sm text-fg-2">“{a.bio}”</p>

                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {cs.map((c) => (
                      <li key={c.label} className={cx('flex items-start gap-2 rounded-lg p-2 text-sm', c.ok ? 'bg-surface-2' : c.blocking ? 'bg-bad-soft' : 'bg-warn-soft')}>
                        {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" aria-label="Passed" /> : <XCircle className={cx('mt-0.5 size-4 shrink-0', c.blocking ? 'text-bad' : 'text-warn')} aria-label="Failed" />}
                        <span>
                          <span className="block font-medium">{c.label}</span>
                          <span className="block text-xs text-fg-2">{c.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="grid grid-cols-2 gap-2 text-xs text-fg-3 sm:grid-cols-3">
                    <span>
                      PAN <span className="font-medium text-fg-2">{a.pan.slice(0, 2)}•••••{a.pan.slice(-2)}</span>
                    </span>
                    <span>
                      Aadhaar <span className="font-medium text-fg-2">••••{a.aadhaarLast4}</span>
                    </span>
                    <span>
                      Payout <span className="font-medium text-fg-2">{a.payout}</span>
                    </span>
                  </div>

                  {a.decisionNote && <p className="text-sm text-fg-2">Decision note: {a.decisionNote}</p>}

                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Pill tone={rec.tone} icon={rec.tone === 'good' ? ShieldCheck : ShieldAlert}>
                      {rec.text}
                    </Pill>
                    {tab === 'pending' && (
                      <div className="ml-auto flex gap-2">
                        <Button variant="ghost" icon={XCircle} onClick={() => setAction({ app: a, kind: 'reject' })}>
                          Reject
                        </Button>
                        <Button variant="success" icon={CheckCircle2} disabled={rec.tone === 'bad'} title={rec.tone === 'bad' ? 'Fails a mandatory requirement' : undefined} onClick={() => setAction({ app: a, kind: 'approve' })}>
                          Approve
                        </Button>
                      </div>
                    )}
                    {a.status === 'approved' && (
                      <Link href="/hosts" className="ml-auto text-xs font-medium text-brand hover:underline">
                        View in hosts
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {action && (
        <ConfirmAction
          open
          onClose={() => setAction(null)}
          title={action.kind === 'approve' ? `Approve ${action.app.name} as a host?` : `Reject ${action.app.name}?`}
          body={action.kind === 'approve' ? 'She can go online right away, starting at Level 1 (35% share). She’ll be told in the app.' : 'She’ll see the reason in the app and can re-apply with correct documents.'}
          confirmLabel={action.kind === 'approve' ? 'Approve host' : 'Reject'}
          danger={action.kind === 'reject'}
          reasonRequired={action.kind === 'reject'}
          placeholder={action.kind === 'approve' ? 'Optional note' : 'e.g. Selfie doesn’t match the ID photo'}
          onConfirm={(note) => {
            if (action.kind === 'approve') {
              data.approveApplication(action.app.id, note);
              toast.good(`${action.app.name} approved. She can now go online.`);
            } else {
              data.rejectApplication(action.app.id, note);
              toast.info(`${action.app.name}'s application was rejected`);
            }
          }}
        />
      )}
    </>
  );
}

export default function ApplicationsPage() {
  return (
    <Ready>
      <ApplicationsPageView />
    </Ready>
  );
}
