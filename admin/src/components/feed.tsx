'use client';

import { BadgeCheck, Flag, IndianRupee, MessageSquareQuote, PhoneCall, ShieldCheck, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { activityFeed, timeAgo, type ActivityItem } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';

import { cx } from './ui';

const KIND: Record<ActivityItem['kind'], { icon: LucideIcon; className: string; label: string }> = {
  call: { icon: PhoneCall, className: 'bg-info-soft text-info', label: 'Call' },
  purchase: { icon: IndianRupee, className: 'bg-good-soft text-good', label: 'Payment' },
  kyc: { icon: BadgeCheck, className: 'bg-brand-soft text-brand', label: 'KYC' },
  report: { icon: Flag, className: 'bg-bad-soft text-bad', label: 'Report' },
  admin: { icon: ShieldCheck, className: 'bg-surface-2 text-fg-2', label: 'Admin' },
  review: { icon: MessageSquareQuote, className: 'bg-warn-soft text-gold', label: 'Review' },
};

export function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const data = useAdmin();
  const [now] = useState(() => Date.now());
  const items = useMemo(() => activityFeed(data, limit), [data, limit]);
  return (
    <ul className="flex flex-col">
      {items.map((it, i) => {
        const k = KIND[it.kind];
        const body = (
          <>
            <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg', k.className)} title={k.label}>
              <k.icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-sm text-fg-2">
              <span className="sr-only">{k.label}: </span>
              {it.text}
            </span>
            <span className="shrink-0 text-xs text-fg-3">{timeAgo(it.at, now)}</span>
          </>
        );
        return (
          <li key={`${it.kind}-${it.at}-${i}`} className="border-b border-line last:border-0">
            {it.href ? (
              <Link href={it.href} className="flex items-start gap-3 rounded-lg px-1 py-2 hover:bg-surface-2">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-1 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
