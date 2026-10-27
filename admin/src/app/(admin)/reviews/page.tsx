'use client';

import { Eye, EyeOff, MessageSquareQuote, Star } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BarList } from '@/components/charts';
import { StarsText } from '@/components/quality';
import { Ready } from '@/components/shell';
import { Avatar, Button, Card, ConfirmAction, EmptyState, Kpi, PageHeader, Pill, Select, cx, toast } from '@/components/ui';
import { translateMaybe, useLang, useT } from '@/i18n';
import { formatDateTime, formatNumber } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { Call } from '@/lib/data/types';

type Filter = 'all' | 'comments' | 'low' | 'hidden';

function ReviewsPageView() {
  const data = useAdmin();
  const t = useT();
  const lang = useLang();
  const [filter, setFilter] = useState<Filter>('comments');
  const [hostId, setHostId] = useState('all');
  const [stars, setStars] = useState('all');
  const [limit, setLimit] = useState(30);
  const [toggle, setToggle] = useState<Call | null>(null);

  const users = useMemo(() => new Map(data.users.map((u) => [u.id, u.name])), [data.users]);
  const hosts = useMemo(() => new Map(data.hosts.map((h) => [h.id, h])), [data.hosts]);
  const tagLabel = (tag: string) => translateMaybe(t, 'tag', tag);

  const rated = data.calls.filter((c) => c.rating);
  const visible = rated.filter((c) => !c.reviewHidden);
  const avg = visible.reduce((a, c) => a + (c.rating ?? 0), 0) / Math.max(1, visible.length);
  const tagCounts = new Map<string, number>();
  for (const c of visible) for (const tag of c.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

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
      <PageHeader title={t('reviews.title')} description={t('reviews.description')} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('overview.avgRating')} value={avg.toFixed(2)} sub={t('common.ratingsN', { n: formatNumber(visible.length) })} icon={Star} tone="gold" />
        <Kpi label={t('reviews.written')} value={formatNumber(visible.filter((c) => c.comment).length)} sub={t('reviews.withComment')} icon={MessageSquareQuote} />
        <Kpi label={t('reviews.lowRatings')} value={formatNumber(visible.filter((c) => (c.rating ?? 5) <= 2).length)} sub={t('reviews.worthLook')} icon={Star} tone="bad" />
        <Kpi label={t('reviews.ratedCalls')} value={`${Math.round((rated.length / Math.max(1, data.calls.length)) * 100)}%`} sub={t('reviews.ofAllCalls')} icon={Star} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <Select
              label={t('reviews.show')}
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setLimit(30);
              }}
              options={[
                { value: 'comments', label: t('reviews.withComments') },
                { value: 'low', label: t('reviews.needsAttention') },
                { value: 'all', label: t('reviews.allRatings') },
                { value: 'hidden', label: t('reviews.hiddenByAdmins') },
              ]}
            />
            <Select label={t('reviews.host')} value={hostId} onChange={setHostId} options={[{ value: 'all', label: t('reviews.allHosts') }, ...data.hosts.map((h) => ({ value: h.id, label: h.name }))]} />
            <Select label={t('reviews.stars')} value={stars} onChange={setStars} options={[{ value: 'all', label: t('reviews.anyStars') }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: t('common.starsN', { n }) }))]} />
            <span className="tabular ml-auto text-xs text-fg-3">{t('reviews.count', { n: formatNumber(rows.length) })}</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={MessageSquareQuote} title={t('reviews.noMatch')} />
          ) : (
            <ul className="flex flex-col">
              {rows.slice(0, limit).map((c) => {
                const h = hosts.get(c.hostId);
                return (
                  <li key={c.id} className={cx('flex gap-3 border-b border-line p-4 last:border-0', c.reviewHidden && 'opacity-50')}>
                    <span className="hidden sm:block">{h && <Avatar name={h.name} colors={h.colors} />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <StarsText value={c.rating ?? 0} />
                        <span>
                          <Link href={`/users/${c.userId}`} className="font-medium hover:underline">
                            {users.get(c.userId)}
                          </Link>
                          <span className="text-fg-3">{t('reviews.rated')}</span>
                          <Link href={`/hosts/${c.hostId}`} className="font-medium hover:underline">
                            {h?.name}
                          </Link>
                        </span>
                        <span className="text-xs text-fg-3">{formatDateTime(c.startedAt, lang)}</span>
                        {c.reviewHidden && <Pill icon={EyeOff}>{t('common.hidden')}</Pill>}
                      </div>
                      {c.comment && <p className="mt-1 text-sm text-fg-2">“{c.comment}”</p>}
                      {!!c.tags?.length && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.tags.map((tag) => (
                            <Pill key={tag}>{tagLabel(tag)}</Pill>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" icon={c.reviewHidden ? Eye : EyeOff} onClick={() => setToggle(c)}>
                      {c.reviewHidden ? t('common.restore') : t('common.hide')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {rows.length > limit && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" onClick={() => setLimit(limit + 30)}>
                {t('common.showMore')}
              </Button>
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t('reviews.praise')} description={t('reviews.praiseDesc')}>
            <BarList items={[...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, value]) => ({ label: tagLabel(tag), value }))} />
          </Card>
          <Card title={t('reviews.mix')}>
            <BarList items={[5, 4, 3, 2, 1].map((n) => ({ label: t('common.starsN', { n }), value: visible.filter((c) => c.rating === n).length }))} />
          </Card>
        </div>
      </div>

      {toggle && (
        <ConfirmAction
          open
          onClose={() => setToggle(null)}
          title={toggle.reviewHidden ? t('reviews.restoreTitle') : t('reviews.hideTitle')}
          body={toggle.reviewHidden ? t('reviews.restoreBody') : t('reviews.hideBody')}
          confirmLabel={toggle.reviewHidden ? t('common.restore') : t('common.hide')}
          danger={!toggle.reviewHidden}
          onConfirm={(reason) => {
            const message = toggle.reviewHidden ? t('reviews.restoredToast') : t('reviews.hiddenToast');
            data.setReviewHidden(toggle.id, !toggle.reviewHidden, reason).then(() => toast.good(message), () => {});
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
