import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useLanguage, useT } from '@/i18n';
import { tagLabel } from '@/i18n/labels';
import { formatWhen } from '@/lib/format';
import { type QualityFactor, type QualityResult, type QualityTier } from '@/lib/quality';
import { motion, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { UserAvatar } from './Avatar';
import { Card } from './Layout';

const TIER_ICON: Record<Exclude<QualityTier, 'none'>, ComponentProps<typeof Ionicons>['name']> = {
  spotlight: 'sparkles',
  top_rated: 'trophy',
  rising_star: 'trending-up',
};

/** Tier pill. `onImage` renders it on a dark translucent chip for photo/gradient backgrounds. */
export function TierBadge({ tier, onImage, size = 'md' }: { tier: QualityTier; onImage?: boolean; size?: 'sm' | 'md' }) {
  const { colors } = useTheme();
  const t = useT();
  if (tier === 'none') return null;
  const tint = tier === 'spotlight' ? colors.coin : tier === 'top_rated' ? colors.accent : colors.success;
  return (
    <View
      style={[styles.badge, size === 'sm' && styles.badgeSm, { backgroundColor: onImage ? 'rgba(0,0,0,0.38)' : colors.surfaceAlt, borderColor: onImage ? 'transparent' : colors.border }]}
      accessibilityLabel={t(`tier.${tier}`)}>
      <Ionicons name={TIER_ICON[tier]} size={size === 'sm' ? 11 : 13} color={onImage ? '#fff' : tint} />
      <AppText variant="caption" style={{ color: onImage ? '#fff' : colors.text, fontSize: size === 'sm' ? 10.5 : 12 }}>
        {t(`tier.${tier}`)}
      </AppText>
    </View>
  );
}

function FactorBar({ factor }: { factor: QualityFactor }) {
  const { colors } = useTheme();
  const t = useT();
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(Math.max(0.02, factor.value), { duration: motion.slow, easing: motion.ease }) }] }));
  const pct = Math.round(factor.value * 100);
  return (
    <View style={{ gap: 4 }} accessibilityLabel={`${t(`quality.factor.${factor.key}`)} ${pct}%`}>
      <View style={styles.between}>
        <AppText variant="caption" color="textSecondary">
          {t(`quality.factor.${factor.key}`)}
        </AppText>
        <AppText variant="caption" color="textMuted" tabular>
          {pct}%
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.primarySoft }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, bar]} />
      </View>
    </View>
  );
}

/** The host's own score: number, tier, what it is made of, and how to improve. */
export function SpotlightCard({ quality, compact }: { quality: QualityResult; compact?: boolean }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.headRow}>
        <View style={[styles.scoreCircle, { borderColor: colors.primary }]}>
          <AppText variant="h1" tabular>
            {quality.score}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="h3">{t('quality.score')}</AppText>
          {quality.tier !== 'none' ? (
            <TierBadge tier={quality.tier} />
          ) : (
            <AppText variant="caption" color="textSecondary">
              {t('quality.reachTier')}
            </AppText>
          )}
        </View>
      </View>
      {quality.atRisk && (
        <View style={[styles.alert, { backgroundColor: 'rgba(220,38,38,0.1)' }]}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <AppText variant="caption" color="danger" style={{ flex: 1 }}>
            {t('quality.atRisk')}
          </AppText>
        </View>
      )}
      {!compact && (
        <>
          {quality.factors.map((f) => (
            <FactorBar key={f.key} factor={f} />
          ))}
          {quality.tipKeys.length > 0 && (
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <AppText variant="label">{t('quality.howToGrow')}</AppText>
              {quality.tipKeys.map((k) => (
                <View key={k} style={styles.tip}>
                  <Ionicons name="bulb-outline" size={16} color={colors.coin} />
                  <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                    {t(`quality.tip.${k}`)}
                  </AppText>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={styles.stars} accessibilityLabel={t('rating.stars', { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? colors.coin : colors.textMuted} />
      ))}
    </View>
  );
}

export type ReviewItem = { id: string; author: string; avatarKey: string; stars: number; tags: string[]; text: string; when: number };

/** "Callers say you're…" tag counts across reviews. */
export function TagSummary({ reviews }: { reviews: ReviewItem[] }) {
  const { colors } = useTheme();
  const t = useT();
  const counts = new Map<string, number>();
  for (const r of reviews) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length) return null;
  return (
    <View style={styles.tags}>
      {top.map(([tag, n]) => (
        <View key={tag} style={[styles.tagChip, { backgroundColor: colors.primarySoft }]}>
          <AppText variant="caption" color="primary">
            {tagLabel(t, tag)}
          </AppText>
          <AppText variant="caption" color="textSecondary" tabular>
            ×{n}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function ReviewList({ reviews, limit }: { reviews: ReviewItem[]; limit?: number }) {
  const { colors } = useTheme();
  const t = useT();
  const lang = useLanguage();
  return (
    <View style={{ gap: spacing.md }}>
      {reviews.slice(0, limit).map((r, i) => (
        <Animated.View key={r.id} entering={FadeIn.delay(Math.min(i, 6) * 40).duration(motion.base)}>
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.reviewHead}>
              <UserAvatar avatarKey={r.avatarKey} size={32} />
              <View style={{ flex: 1 }}>
                <AppText variant="label">{r.author}</AppText>
                <AppText variant="caption" color="textMuted">
                  {formatWhen(r.when, lang)}
                </AppText>
              </View>
              <Stars value={r.stars} />
            </View>
            {r.text ? <AppText color="textSecondary">“{r.text}”</AppText> : null}
            {r.tags.length > 0 && (
              <View style={styles.tags}>
                {r.tags.map((tag) => (
                  <View key={tag} style={[styles.tagChip, { backgroundColor: colors.surfaceAlt }]}>
                    <AppText variant="caption" color="textSecondary">
                      {tagLabel(t, tag)}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  badgeSm: { paddingHorizontal: 6, paddingVertical: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  scoreCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 6, width: '100%', borderRadius: radius.pill, transformOrigin: 'left' },
  tip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  alert: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm },
  stars: { flexDirection: 'row', gap: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  tagChip: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
