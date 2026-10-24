'use client';

import { Ban, CheckCircle2, CircleDot, Clock, PauseCircle, Trash2, XCircle } from 'lucide-react';

import type { HostStatus, Payout, ReportStatus, UserStatus } from '@/lib/data/types';

import { Pill } from './ui';

export function AccountStatus({ status }: { status: UserStatus | HostStatus }) {
  if (status === 'active') return <Pill tone="good" icon={CheckCircle2}>Active</Pill>;
  if (status === 'suspended') return <Pill tone="warn" icon={PauseCircle}>Suspended</Pill>;
  if (status === 'banned') return <Pill tone="bad" icon={Ban}>Banned</Pill>;
  return <Pill icon={Trash2}>Deleted</Pill>;
}

export function PresencePill({ presence }: { presence: 'online' | 'busy' | 'offline' }) {
  if (presence === 'online') return <Pill tone="good" icon={CircleDot}>Online</Pill>;
  if (presence === 'busy') return <Pill tone="warn" icon={CircleDot}>In a call</Pill>;
  return <Pill icon={CircleDot}>Offline</Pill>;
}

export function PayoutStatus({ status }: { status: Payout['status'] }) {
  if (status === 'requested') return <Pill tone="warn" icon={Clock}>Requested</Pill>;
  if (status === 'approved') return <Pill tone="info" icon={CheckCircle2}>Approved</Pill>;
  if (status === 'paid') return <Pill tone="good" icon={CheckCircle2}>Paid</Pill>;
  return <Pill tone="bad" icon={XCircle}>Rejected</Pill>;
}

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  if (status === 'open') return <Pill tone="bad" icon={CircleDot}>Open</Pill>;
  if (status === 'reviewing') return <Pill tone="warn" icon={Clock}>Reviewing</Pill>;
  if (status === 'actioned') return <Pill tone="good" icon={CheckCircle2}>Actioned</Pill>;
  return <Pill icon={XCircle}>Dismissed</Pill>;
}

export function SeverityPill({ severity }: { severity: 1 | 2 | 3 | 4 }) {
  const label = ['Low', 'Medium', 'High', 'Critical'][severity - 1];
  return (
    <Pill tone={severity >= 3 ? 'bad' : severity === 2 ? 'warn' : 'neutral'} icon={CircleDot}>
      S{severity} · {label}
    </Pill>
  );
}
