'use client';

import { BadgeCheck, CheckCircle2, Clock, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Ready } from '@/components/shell';
import { Avatar, Button, Card, ConfirmAction, EmptyState, PageHeader, Pill, Tabs, cx, toast } from '@/components/ui';
import { useLang, useT, type Translate } from '@/i18n';
import { formatDateTime, timeAgo } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Application } from '@/lib/data/types';

type Check = { key: string; label: string; ok: boolean; detail: string; blocking: boolean };

/** Automatic checks run on every application (provider results with the real KYC integration). */
function checks(a: Application, hostNames: Map<string, string>, t: Translate): Check[] {
  return [
    { key: 'woman', label: t('apps.checkWoman'), ok: a.gender === 'female', detail: t('apps.checkWomanDetail', { gender: t(a.gender === 'female' ? 'apps.female' : a.gender === 'male' ? 'apps.male' : 'apps.other') }), blocking: true },
    { key: 'adult', label: t('apps.checkAdult'), ok: a.age >= 18, detail: t('apps.checkAdultDetail', { n: a.age }), blocking: true },
    // Until a KYC provider scores the selfie, this stays a manual check (non-blocking warning).
    { key: 'face', label: t('apps.checkFace'), ok: a.faceMatch !== null && a.faceMatch >= 90, detail: a.faceMatch === null ? t('apps.faceManual') : t('apps.checkFaceDetail', { n: a.faceMatch }), blocking: false },
    { key: 'live', label: t('apps.checkLive'), ok: a.selfieDone, detail: a.selfieDone ? t('apps.livePassed') : t('apps.liveFailed'), blocking: false },
    { key: 'dup', label: t('apps.checkDup'), ok: !a.duplicateOf, detail: a.duplicateOf ? t('apps.dupFound', { name: hostNames.get(a.duplicateOf) ?? a.duplicateOf }) : t('apps.dupNone'), blocking: false },
  ];
}

function recommendation(cs: Check[], t: Translate): { tone: 'good' | 'warn' | 'bad'; text: string } {
  if (cs.some((c) => c.blocking && !c.ok)) return { tone: 'bad', text: t('apps.recReject') };
  if (cs.some((c) => !c.ok)) return { tone: 'warn', text: t('apps.recReview') };
  return { tone: 'good', text: t('apps.recApprove') };
}

function ApplicationsPageView() {
  const data = useAdmin();
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<Application['status']>('pending');
  const [action, setAction] = useState<{ app: Application; kind: 'approve' | 'reject' } | null>(null);
  const [now] = useState(() => Date.now());
  const hostNames = new Map(data.hosts.map((h) => [h.id, h.name]));
  const list = data.applications.filter((a) => a.status === tab).sort((a, b) => (tab === 'pending' ? a.submittedAt - b.submittedAt : (b.decidedAt ?? 0) - (a.decidedAt ?? 0)));

  return (
    <>
      <PageHeader title={t('apps.title')} description={t('apps.description')} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pending', label: t('apps.waiting'), count: data.applications.filter((a) => a.status === 'pending').length },
          { value: 'approved', label: t('common.approved'), count: data.applications.filter((a) => a.status === 'approved').length },
          { value: 'rejected', label: t('common.rejected'), count: data.applications.filter((a) => a.status === 'rejected').length },
        ]}
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={BadgeCheck} title={tab === 'pending' ? t('apps.caughtUp') : t('apps.nothing')} body={tab === 'pending' ? t('apps.caughtUpBody') : undefined} />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((a) => {
            const cs = checks(a, hostNames, t);
            const rec = recommendation(cs, t);
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
                        {a.city} · {a.phone} · {a.languages.map((l) => t(`lang.${l}`)).join(', ')}
                      </p>
                    </div>
                    {tab === 'pending' ? (
                      <Pill tone={overdue ? 'bad' : 'neutral'} icon={Clock}>
                        {overdue ? t('apps.overdue') : ''}
                        {timeAgo(a.submittedAt, now, t)}
                      </Pill>
                    ) : (
                      <Pill tone={a.status === 'approved' ? 'good' : 'bad'} icon={a.status === 'approved' ? CheckCircle2 : XCircle}>
                        {a.status === 'approved' ? t('common.approved') : t('common.rejected')} {a.decidedAt ? formatDateTime(a.decidedAt, lang) : ''}
                      </Pill>
                    )}
                  </div>

                  <p className="text-sm text-fg-2">“{a.bio}”</p>

                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {cs.map((c) => (
                      <li key={c.key} className={cx('flex items-start gap-2 rounded-lg p-2 text-sm', c.ok ? 'bg-surface-2' : c.blocking ? 'bg-bad-soft' : 'bg-warn-soft')}>
                        {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" aria-label={t('apps.passed')} /> : <XCircle className={cx('mt-0.5 size-4 shrink-0', c.blocking ? 'text-bad' : 'text-warn')} aria-label={t('apps.failed')} />}
                        <span>
                          <span className="block font-medium">{c.label}</span>
                          <span className="block text-xs text-fg-2">{c.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="grid grid-cols-2 gap-2 text-xs text-fg-3 sm:grid-cols-3">
                    <span>
                      {t('host.pan')} <span className="font-medium text-fg-2">{a.pan.slice(0, 2)}•••••{a.pan.slice(-2)}</span>
                    </span>
                    <span>
                      {t('host.aadhaar')} <span className="font-medium text-fg-2">••••{a.aadhaarLast4}</span>
                    </span>
                    <span className="col-span-2 break-all sm:col-span-1">
                      {t('apps.payout')} <span className="font-medium text-fg-2">{a.payout}</span>
                    </span>
                  </div>

                  {a.decisionNote && <p className="text-sm text-fg-2">{t('apps.decisionNote', { note: a.decisionNote })}</p>}

                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Pill tone={rec.tone} icon={rec.tone === 'good' ? ShieldCheck : ShieldAlert} className="whitespace-normal">
                      {rec.text}
                    </Pill>
                    {tab === 'pending' && (
                      <div className="ml-auto flex gap-2">
                        <Button variant="ghost" icon={XCircle} onClick={() => setAction({ app: a, kind: 'reject' })}>
                          {t('common.reject')}
                        </Button>
                        <Button variant="success" icon={CheckCircle2} disabled={rec.tone === 'bad'} title={rec.tone === 'bad' ? t('apps.failsMandatory') : undefined} onClick={() => setAction({ app: a, kind: 'approve' })}>
                          {t('common.approve')}
                        </Button>
                      </div>
                    )}
                    {a.status === 'approved' && (
                      <Link href="/hosts" className="ml-auto text-xs font-medium text-brand hover:underline">
                        {t('apps.viewInHosts')}
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
          title={action.kind === 'approve' ? t('apps.approveTitle', { name: action.app.name }) : t('apps.rejectTitle', { name: action.app.name })}
          body={action.kind === 'approve' ? t('apps.approveBody') : t('apps.rejectBody')}
          confirmLabel={action.kind === 'approve' ? t('apps.approveHost') : t('common.reject')}
          danger={action.kind === 'reject'}
          reasonRequired={action.kind === 'reject'}
          placeholder={action.kind === 'approve' ? t('apps.optionalNote') : t('apps.rejectPlaceholder')}
          onConfirm={(note) => {
            if (action.kind === 'approve') {
              const name = action.app.name;
              data.approveApplication(action.app.id, note).then(() => toast.good(t('apps.approvedToast', { name })), () => {});
            } else {
              const name = action.app.name;
              data.rejectApplication(action.app.id, note).then(() => toast.info(t('apps.rejectedToast', { name })), () => {});
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
