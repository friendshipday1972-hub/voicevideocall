'use client';

import { Ban, CheckCircle2, CircleDot, Clock, PauseCircle, Trash2, XCircle } from 'lucide-react';

import { useT } from '@/i18n';
import type { HostStatus, Payout, ReportStatus, UserStatus } from '@/lib/data/types';

import { Pill } from './ui';

export function AccountStatus({ status }: { status: UserStatus | HostStatus }) {
  const t = useT();
  if (status === 'active') return <Pill tone="good" icon={CheckCircle2}>{t('status.active')}</Pill>;
  if (status === 'suspended') return <Pill tone="warn" icon={PauseCircle}>{t('status.suspended')}</Pill>;
  if (status === 'banned') return <Pill tone="bad" icon={Ban}>{t('status.banned')}</Pill>;
  return <Pill icon={Trash2}>{t('status.deleted')}</Pill>;
}

export function PresencePill({ presence }: { presence: 'online' | 'busy' | 'offline' }) {
  const t = useT();
  if (presence === 'online') return <Pill tone="good" icon={CircleDot}>{t('status.online')}</Pill>;
  if (presence === 'busy') return <Pill tone="warn" icon={CircleDot}>{t('status.busy')}</Pill>;
  return <Pill icon={CircleDot}>{t('status.offline')}</Pill>;
}

export function PayoutStatus({ status }: { status: Payout['status'] }) {
  const t = useT();
  if (status === 'requested') return <Pill tone="warn" icon={Clock}>{t('status.requested')}</Pill>;
  if (status === 'approved') return <Pill tone="info" icon={CheckCircle2}>{t('status.approved')}</Pill>;
  if (status === 'paid') return <Pill tone="good" icon={CheckCircle2}>{t('status.paid')}</Pill>;
  return <Pill tone="bad" icon={XCircle}>{t('status.rejected')}</Pill>;
}

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  const t = useT();
  if (status === 'open') return <Pill tone="bad" icon={CircleDot}>{t('status.open')}</Pill>;
  if (status === 'reviewing') return <Pill tone="warn" icon={Clock}>{t('status.reviewing')}</Pill>;
  if (status === 'actioned') return <Pill tone="good" icon={CheckCircle2}>{t('status.actioned')}</Pill>;
  return <Pill icon={XCircle}>{t('status.dismissed')}</Pill>;
}

export function SeverityPill({ severity }: { severity: 1 | 2 | 3 | 4 }) {
  const t = useT();
  const label = t(`status.sev${severity}`);
  return (
    <Pill tone={severity >= 3 ? 'bad' : severity === 2 ? 'warn' : 'neutral'} icon={CircleDot}>
      {t('status.severity', { n: severity, label })}
    </Pill>
  );
}
