'use client';

import { Eye, EyeOff, MessageSquareQuote, Star } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BarList } from '@/components/charts';
import { StarsText } from '@/components/quality';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, ConfirmAction, EmptyState, Kpi, PageHeader, Pill, Select, cx, toast } from '@/components/ui';
import { formatDateTime, formatNumber } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Call } from '@/lib/data/types';

type Filter = 'all' | 'comments' | 'low' | 'hidden';

function ReviewsPageView() {
  const data = useAdmin();
  const [filter, setFilter] = useState<Filter>('comments');
  const [hostId, setHostId] = useState('all');
  const [stars, setStars] = useState('all');
  const [limit, setLimit] = useState(30);
  const [toggle, setToggle] = useState<Call | null>(null);

  const users = useMemo(() => new Map(data.users.map((u) => [u.id, u.name])), [data.users]);
  const hosts = useMemo(() => new Map(data.hosts.map((h) => [h.id, h])), [data.hosts]);

  const rated = data.calls.filter((c) => c.rating);
  const visible = rated.filter((c) => !c.reviewHidden);
  const avg = visible.reduce((a, c) => a + (c.rating ?? 0), 0) / Math.max(1, visible.length);
  const tagCounts = new Map<string, number>();
  for (const c of visible) for (const t of c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);

  const rows = rated
    .filter((c) => {
      if (filter === 'comments' && !c.comment) return false;
      if (filter === 'low' && (c.rating ?? 5) > 2) return false;
      if (filter === 'hidden' ? !c.reviewHidden : false) return false;
      if (hostId !== 'all' && c.hostId !== hostId) return false;
      if (stars !== 'all' && c.rating !== Number(stars)) return false;
      return true;
    })
    .sort((a, b) => b.startedAt - a.startedAt);

  return (
    <>
      <PageHeader title="Ratings & reviews" description="What callers say after every call. Hosts see their own feedback in the app; hide reviews that are abusive or fake." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Average rating" value={avg.toFixed(2)} sub={`${formatNumber(visible.length)} ratings`} icon={Star} tone="gold" />
        <Kpi label="Written reviews" value={formatNumber(visible.filter((c) => c.comment).length)} sub="with a comment" icon={MessageSquareQuote} />
        <Kpi label="Low ratings (1–2★)" value={formatNumber(visible.filter((c) => (c.rating ?? 5) <= 2).length)} sub="worth a look" icon={Star} tone="bad" />
        <Kpi label="Rated calls" value={`${Math.round((rated.length / Math.max(1, data.calls.length)) * 100)}%`} sub="of all calls get a rating" icon={Star} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <Select
              label="Show"
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setLimit(30);
              }}
              options={[
                { value: 'comments', label: 'With comments' },
                { value: 'low', label: 'Needs attention (1–2★)' },
                { value: 'all', label: 'All ratings' },
                { value: 'hidden', label: 'Hidden by admins' },
              ]}
            />
            <Select label="Host" value={hostId} onChange={setHostId} options={[{ value: 'all', label: 'All hosts' }, ...data.hosts.map((h) => ({ value: h.id, label: h.name }))]} />
            <Select label="Stars" value={stars} onChange={setStars} options={[{ value: 'all', label: 'Any stars' }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n}★` }))]} />
            <span className="tabular ml-auto text-xs text-fg-3">{formatNumber(rows.length)} reviews</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={MessageSquareQuote} title="No reviews match" />
          ) : (
            <ul className="flex flex-col">
              {rows.slice(0, limit).map((c) => {
                const h = hosts.get(c.hostId);
                return (
                  <li key={c.id} className={cx('flex gap-3 border-b border-line p-4 last:border-0', c.reviewHidden && 'opacity-50')}>
                    {h && <Avatar name={h.name} colors={h.colors} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <StarsText value={c.rating ?? 0} />
                        <span>
                          <Link href={`/users/${c.userId}`} className="font-medium hover:underline">
                            {users.get(c.userId)}
                          </Link>
                          <span className="text-fg-3"> rated </span>
                          <Link href={`/hosts/${c.hostId}`} className="font-medium hover:underline">
                            {h?.name}
                          </Link>
                        </span>
                        <span className="text-xs text-fg-3">{formatDateTime(c.startedAt)}</span>
                        {c.reviewHidden && <Pill icon={EyeOff}>Hidden</Pill>}
                      </div>
                      {c.comment && <p className="mt-1 text-sm text-fg-2">“{c.comment}”</p>}
                      {!!c.tags?.length && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <Pill key={t}>{t}</Pill>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" icon={c.reviewHidden ? Eye : EyeOff} onClick={() => setToggle(c)}>
                      {c.reviewHidden ? 'Restore' : 'Hide'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {rows.length > limit && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" onClick={() => setLimit(limit + 30)}>
                Show more
              </Button>
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="What callers praise" description="Most used tags">
            <BarList items={[...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
          </Card>
          <Card title="Rating mix">
            <BarList items={[5, 4, 3, 2, 1].map((n) => ({ label: `${n}★`, value: visible.filter((c) => c.rating === n).length }))} />
          </Card>
        </div>
      </div>

      {toggle && (
        <ConfirmAction
          open
          onClose={() => setToggle(null)}
          title={toggle.reviewHidden ? 'Restore this review?' : 'Hide this review?'}
          body={toggle.reviewHidden ? 'It will show in the app again.' : 'It won’t show in the app or count in averages. Use for abusive, fake or off-platform-contact reviews.'}
          confirmLabel={toggle.reviewHidden ? 'Restore' : 'Hide'}
          danger={!toggle.reviewHidden}
          onConfirm={(reason) => {
            data.setReviewHidden(toggle.id, !toggle.reviewHidden, reason);
            toast.good(toggle.reviewHidden ? 'Review restored' : 'Review hidden');
          }}
        />
      )}
    </>
  );
}

export default function ReviewsPage() {
  return (
    <Ready>
      <ReviewsPageView />
    </Ready>
  );
}
