import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { HostAvatar, PresenceDot } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card, Divider, ListRow, Screen, SectionTitle } from '@/components/Layout';
import { PressableScale } from '@/components/PressableScale';
import { ReviewList, SpotlightCard } from '@/components/Quality';
import { appConfig, formatRupees, levelRequirements } from '@/config/appConfig';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { computeQuality } from '@/lib/quality';
import { hostBalances, hostQualityInput, useHost } from '@/stores/host';
import { useSession } from '@/stores/session';
import { levelColors, motion, radius, spacing, useTheme } from '@/theme';

function LevelProgress() {
const { colors } = useTheme();
const t = useT();
  const level = useHost((s) => s.level);
  const minutes = useHost((s) => s.minutes30d);
  const rating = useHost((s) => s.rating);
  const cur = levelRequirements[level - 1];
  const next = level < levelRequirements.length ? levelRequirements[level as 1 | 2 | 3] : null;
  const progress = next ? Math.min(1, minutes / next.minutes) : 1;
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(progress, { duration: motion.base, easing: motion.ease }) }] }));

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.between}>
        <View style={styles.inline}>
          <View style={[styles.levelBadge, { backgroundColor: levelColors[level] }]}>
            <AppText variant="label" style={{ color: '#fff' }}>
              L{level}
            </AppText>
          </View>
          <View>
            <AppText variant="h3">
              {t('hostHome.levelTitle', { n: level, title: t(`hostHome.levelNames.l${level}`) })}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('hostHome.levelShare', { pct: cur.share })}
            </AppText>
          </View>
        </View>
      </View>
      {next ? (
        <>
          <View style={[styles.track, { backgroundColor: colors.primarySoft }]}>
            <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, bar]} />
          </View>
          <AppText variant="caption" color="textSecondary">
            {t('hostHome.levelNext', { min: minutes, need: next.minutes, rating: next.rating.toFixed(1), mine: rating.toFixed(1), next: next.level, pct: next.share })}
          </AppText>
        </>
      ) : (
        <AppText variant="caption" color="success">
          {t('hostHome.levelTop')}
        </AppText>
      )}
    </Card>
  );
}

export default function HostDashboard() {
  const { colors } = useTheme();
  const t = useT();
  const name = useSession((s) => s.profile?.displayName ?? '');
  const online = useHost((s) => s.online);
  const setOnline = useHost((s) => s.setOnline);
  const earnings = useHost((s) => s.earnings);
  const minutes = useHost((s) => s.minutes30d);
  const rating = useHost((s) => s.rating);
  const strikes = useHost((s) => s.strikes);
  const stats = useHost((s) => s.qualityStats);
  const rings = useHost((s) => s.rings);
  const latest = useHost((s) => s.reviews[0]);
  const quality = computeQuality(hostQualityInput(stats, rings, strikes));

  const b = hostBalances(earnings);

  return (
    <Screen edges={['top']}>
      <View style={styles.greeting}>
        <HostAvatar host={{ name: name || 'H', colors: [colors.secondary, colors.accent] as const }} size={48} />
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="textSecondary">
            {t('hostHome.welcomeBack')}
          </AppText>
          <AppText variant="h2" numberOfLines={1}>
            {name}
          </AppText>
        </View>
        <View style={[styles.verified, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
          <AppText variant="caption" color="accent">
            {t('common.verified')}
          </AppText>
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(320)}>
        <LinearGradient colors={online ? colors.gradientPrimary : [colors.surfaceAlt, colors.surfaceAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.toggleCard, !online && { borderWidth: 1, borderColor: colors.border }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.inline}>
              <PresenceDot presence={online ? 'online' : 'offline'} size={10} />
              <AppText variant="h2" style={{ color: online ? '#fff' : colors.text }}>
                {online ? t('hostHome.youreOnline') : t('hostHome.youreOffline')}
              </AppText>
            </View>
            <AppText variant="caption" style={{ color: online ? 'rgba(255,255,255,0.88)' : colors.textSecondary }}>
              {online ? t('hostHome.onlineBody') : t('hostHome.offlineBody')}
            </AppText>
          </View>
          <Switch
            value={online}
            onValueChange={(v) => {
              setOnline(v);
              haptic.success();
            }}
            trackColor={{ true: 'rgba(255,255,255,0.45)', false: colors.border }}
            thumbColor={online ? '#fff' : colors.surface}
            accessibilityLabel={t('hostHome.goOnline')}
            style={{ transform: [{ scale: 1.15 }] }}
          />
        </LinearGradient>
      </Animated.View>

      {online && (
        <Animated.View entering={FadeIn.duration(250)} style={{ marginTop: spacing.md }}>
          <Button title={t('hostHome.simulate')} variant="secondary" icon="call" onPress={() => router.push('/host-mode/incoming')} />
        </Animated.View>
      )}

      <View style={styles.grid}>
        {[
          { label: t('hostHome.today'), value: formatRupees(b.today), icon: 'today' as const },
          { label: t('hostHome.withdrawable'), value: formatRupees(b.available), icon: 'wallet' as const },
          { label: t('hostHome.minutes30'), value: String(minutes), icon: 'time' as const },
          { label: t('hostHome.rating'), value: rating.toFixed(1), icon: 'star' as const },
        ].map((s, i) => (
          <Animated.View key={s.label} entering={FadeInDown.delay(60 + i * 40).duration(300)} style={styles.gridItem}>
            <Card style={{ gap: spacing.xs }}>
              <Ionicons name={s.icon} size={18} color={colors.primary} />
              <AppText variant="h2" tabular numberOfLines={1} adjustsFontSizeToFit>
                {s.value}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {s.label}
              </AppText>
            </Card>
          </Animated.View>
        ))}
      </View>

      <SectionTitle title={t('hostHome.impression')} action={t('hostHome.allFeedback')} onAction={() => router.push('/host-mode/feedback')} />
      <PressableScale onPress={() => router.push('/host-mode/feedback')} scaleTo={0.99} accessibilityLabel={`${t('quality.score')} ${quality.score}. ${t('hostHome.allFeedback')}`}>
        <SpotlightCard quality={quality} compact />
      </PressableScale>
      {latest && (
        <View style={{ marginTop: spacing.md }}>
          <ReviewList reviews={[{ ...latest, when: latest.createdAt }]} />
        </View>
      )}

      <SectionTitle title={t('hostHome.yourLevel')} />
      <LevelProgress />

      <SectionTitle title={t('hostHome.manage')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="cash-outline" title={t('hostHome.earningsRow')} subtitle={t('hostHome.earningsRowSub', { pending: formatRupees(b.pending), available: formatRupees(b.available) })} onPress={() => router.push('/earnings')} />
        <Divider />
        <ListRow icon="shield-checkmark-outline" title={t('hostHome.rulesRow')} subtitle={strikes ? t('hostHome.strikes', { n: strikes }) : t('hostHome.noStrikes')} onPress={() => router.push('/settings/help')} />
      </Card>

      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.lg }}>
        {t('hostHome.footer', { days: appConfig.holdDays, min: formatRupees(appConfig.minWithdrawalPaise) })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg, marginBottom: spacing.lg },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  levelBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, width: '100%', borderRadius: radius.pill, transformOrigin: 'left' },
});
