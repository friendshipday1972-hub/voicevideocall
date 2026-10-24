import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card, EmptyState, Header, Screen, SectionTitle } from '@/components/Layout';
import { ReviewList, SpotlightCard, Stars, TagSummary, type ReviewItem } from '@/components/Quality';
import { useT } from '@/i18n';
import { computeQuality } from '@/lib/quality';
import { hostQualityInput, useHost } from '@/stores/host';
import { radius, spacing, useTheme } from '@/theme';

/** Everything callers think of her: score, ratings, tags and written reviews. */
export default function HostFeedback() {
  const { colors } = useTheme();
  const t = useT();
  const reviews = useHost((s) => s.reviews);
  const stats = useHost((s) => s.qualityStats);
  const rings = useHost((s) => s.rings);
  const strikes = useHost((s) => s.strikes);
  const quality = computeQuality(hostQualityInput(stats, rings, strikes));

  const items: ReviewItem[] = reviews.map((r) => ({ ...r, when: r.createdAt }));
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.stars === n).length }));
  const maxCount = Math.max(1, ...dist.map((d) => d.count));

  return (
    <Screen>
      <Header title={t('feedback.title')} subtitle={t('feedback.subtitle')} />
      <SpotlightCard quality={quality} />

      <SectionTitle title={t('feedback.ratings')} />
      <Card style={styles.ratingCard}>
        <View style={styles.avg}>
          <AppText variant="display" tabular>
            {stats.ratingAvg ? stats.ratingAvg.toFixed(1) : '—'}
          </AppText>
          <Stars value={stats.ratingAvg} />
          <AppText variant="caption" color="textMuted">
            {t('feedback.ratingCount', { n: stats.ratingCount })}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 6 }} accessibilityLabel={t('feedback.ratings')}>
          {dist.map((d) => (
            <View key={d.n} style={styles.distRow}>
              <AppText variant="caption" color="textSecondary" style={{ width: 12 }}>
                {d.n}
              </AppText>
              <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.fill, { backgroundColor: colors.coin, width: `${(d.count / maxCount) * 100}%` }]} />
              </View>
              <AppText variant="caption" color="textMuted" tabular style={{ width: 20, textAlign: 'right' }}>
                {d.count}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      {items.length > 0 && (
        <>
          <SectionTitle title={t('quality.callersSay')} />
          <TagSummary reviews={items} />
        </>
      )}

      <SectionTitle title={t('feedback.reviews')} />
      {items.length === 0 ? <EmptyState icon="chatbubble-ellipses-outline" title={t('feedback.emptyTitle')} body={t('feedback.emptyBody')} /> : <ReviewList reviews={items} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ratingCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  avg: { alignItems: 'center', gap: 4 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
});
