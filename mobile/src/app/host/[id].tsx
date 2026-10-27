import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { PresenceDot } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { CoinIcon } from '@/components/CoinBadge';
import { IconButton } from '@/components/IconButton';
import { Card, EmptyState, MAX_WIDTH } from '@/components/Layout';
import { ReviewList, Stars, TagSummary, TierBadge, type ReviewItem } from '@/components/Quality';
import { ReportSheet } from '@/components/ReportSheet';
import { toast } from '@/components/Toast';
import type { Review } from '@/data/catalog';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { haptic } from '@/lib/haptics';
import { useStartCall } from '@/lib/useStartCall';
import { fetchReviews, useHostById, usePresence } from '@/stores/hosts';
import { useSession } from '@/stores/session';
import { useSocial } from '@/stores/social';
import { fonts, levelColors, motion, radius, spacing, useTheme } from '@/theme';



export default function HostProfile() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const host = useHostById(id);
  const presence = usePresence((s) => (id ? (s.presence[id] ?? host?.presence) : 'offline')) ?? 'offline';
  const [others, setOthers] = useState<Review[]>([]);
  const isFav = useSocial((s) => (id ? s.favorites.includes(id) : false));
  const toggleFavorite = useSocial((s) => s.toggleFavorite);
  const block = useSocial((s) => s.block);
  const [reporting, setReporting] = useState(false);
  const { start, sheet } = useStartCall();
  const myCalls = useSocial((s) => s.calls);
  const myName = useSession((s) => s.profile?.displayName ?? '');
  const myAvatar = useSession((s) => s.profile?.avatarKey ?? 'sun');

  useEffect(() => {
    if (id) fetchReviews(id).then(setOthers, () => {});
  }, [id]);

  if (!host) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <EmptyState icon="person-remove" title={t('hostProfile.notFound')} body={t('hostProfile.notFoundBody')} action={<Button title={t('common.goBack')} onPress={() => router.back()} />} />
      </View>
    );
  }

  const canCall = presence === 'online';
  // Your own rated calls with her come first, then other callers' reviews.
  const reviews: ReviewItem[] = [
    ...myCalls
      .filter((c) => c.hostId === host.id && c.rating)
      .map((c) => ({ id: c.id, author: t('hostProfile.you', { name: myName }), avatarKey: myAvatar, stars: c.rating ?? 0, tags: c.tags ?? [], text: c.comment ?? '', when: c.startedAt })),
    ...others.filter((r) => !myCalls.some((c) => c.id === r.id && c.hostId === host.id)).map((r) => ({ ...r, when: r.createdAt })),
  ];

  const confirmBlock = () =>
    Alert.alert(t('hostProfile.blockTitle', { name: host.name }), t('hostProfile.blockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('hostProfile.blockConfirm'),
        style: 'destructive',
        onPress: () => {
          block(host.id).catch(() => toast.error(t('errors.network')));
          haptic.success();
          toast.success(t('hostProfile.blocked', { name: host.name }));
          router.back();
        },
      },
    ]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={host.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { height: 300 + insets.top, paddingTop: insets.top }]}>
          <View style={[styles.heroBar, { top: insets.top + spacing.sm }]}>
            <IconButton icon="chevron-down" label={t('common.close')} onPress={() => router.back()} background="rgba(0,0,0,0.25)" color="#fff" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <IconButton
                icon={isFav ? 'heart' : 'heart-outline'}
                label={isFav ? t('hostProfile.removeFav') : t('hostProfile.addFav')}
                background="rgba(0,0,0,0.25)"
                color="#fff"
                onPress={() => {
                  toggleFavorite(host.id).catch(() => toast.error(t("errors.network")));
                  haptic.success();
                  toast.success(isFav ? t('hostProfile.favRemoved') : t('hostProfile.favAdded'));
                }}
              />
              <IconButton icon="flag-outline" label={t('hostProfile.report')} background="rgba(0,0,0,0.25)" color="#fff" onPress={() => setReporting(true)} />
            </View>
          </View>
          <Animated.Text entering={FadeIn.duration(motion.slow)} style={styles.initial}>
            {host.name[0]}
          </Animated.Text>
        </LinearGradient>

        <View style={styles.column}>
          <Animated.View entering={FadeInDown.duration(320)}>
            <Card style={styles.headCard}>
              <View style={styles.nameRow}>
                <AppText variant="h1" style={{ flexShrink: 1 }}>
                  {host.name}, {host.age}
                </AppText>
                <Ionicons name="shield-checkmark" size={22} color={colors.accent} accessibilityLabel={t('common.verified')} />
              </View>
              <TierBadge tier={host.quality.tier} />
              <View style={styles.metaRow}>
                <View style={styles.meta}>
                  <PresenceDot presence={presence} />
                  <AppText variant="label" color="textSecondary">
                    {presence === 'online' ? t('common.onlineNow') : t(`common.presence.${presence}`)}
                  </AppText>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <AppText variant="label" color="textSecondary">
                    {host.city}
                  </AppText>
                </View>
                <View style={[styles.level, { backgroundColor: levelColors[host.level] }]}>
                  <AppText variant="caption" style={{ color: '#fff' }}>
                    {t('common.level', { n: host.level })}
                  </AppText>
                </View>
              </View>
              <View style={[styles.stats, { borderColor: colors.divider }]}>
                {[
                  { label: t('hostProfile.rating'), value: host.rating.toFixed(1), icon: 'star' as const },
                  { label: t('hostProfile.calls'), value: host.totalCalls.toLocaleString('en-IN'), icon: 'call' as const },
                  { label: t('hostProfile.replies'), value: `${host.responseRate}%`, icon: 'flash' as const },
                ].map((s) => (
                  <View key={s.label} style={styles.stat}>
                    <View style={styles.meta}>
                      <Ionicons name={s.icon} size={14} color={colors.primary} />
                      <AppText variant="h3" tabular>
                        {s.value}
                      </AppText>
                    </View>
                    <AppText variant="caption" color="textMuted">
                      {s.label}
                    </AppText>
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(320)} style={{ gap: spacing.md }}>
            <AppText variant="h3">{t('hostProfile.about')}</AppText>
            <AppText color="textSecondary">{host.bio}</AppText>
            <View style={styles.chips}>
              {host.interests.map((i) => (
                <Chip key={i} label={i} size="sm" />
              ))}
            </View>
            <AppText variant="h3" style={{ marginTop: spacing.md }}>
              {t('hostProfile.speaks')}
            </AppText>
            <View style={styles.chips}>
              {host.languages.map((l) => (
                <Chip key={l} label={languageName(t, l)} size="sm" icon="language" />
              ))}
            </View>

            <AppText variant="h3" style={{ marginTop: spacing.md }}>
              {t('hostProfile.rates')}
            </AppText>
            <View style={styles.rates}>
              {[
                { icon: 'call' as const, label: t('common.voice'), rate: host.audioRate },
                { icon: 'videocam' as const, label: t('common.video'), rate: host.videoRate },
              ].map((r) => (
                <Card key={r.label} style={styles.rateCard}>
                  <Ionicons name={r.icon} size={20} color={colors.primary} />
                  <AppText variant="label">{r.label}</AppText>
                  <View style={styles.meta}>
                    <CoinIcon size={16} />
                    <AppText variant="h3" tabular>
                      {r.rate}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {t('common.perMin')}
                    </AppText>
                  </View>
                </Card>
              ))}
            </View>
            <AppText variant="caption" color="textMuted">
              {t('hostProfile.ratesNote')}
            </AppText>

            <View style={[styles.metaRow, { marginTop: spacing.md, justifyContent: 'space-between' }]}>
              <AppText variant="h3">{t('hostProfile.whatCallersSay')}</AppText>
              <View style={styles.meta}>
                <Stars value={host.rating} />
                <AppText variant="caption" color="textSecondary" tabular>
                  {host.rating.toFixed(1)} · {host.ratingCount.toLocaleString('en-IN')}
                </AppText>
              </View>
            </View>
            <TagSummary reviews={reviews} />
            <ReviewList reviews={reviews} limit={4} />

            <Button title={t('hostProfile.block', { name: host.name })} variant="ghost" icon="ban" onPress={confirmBlock} style={{ marginTop: spacing.lg }} />
          </Animated.View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopColor: colors.divider }]}>
        <View style={[styles.column, styles.footerRow]}>
          <Button title={t('common.voiceCall')} variant="secondary" icon="call" disabled={!canCall} onPress={() => start(host, 'audio')} style={{ flex: 1 }} />
          <Button title={t('common.videoCall')} icon="videocam" disabled={!canCall} onPress={() => start(host, 'video')} style={{ flex: 1 }} />
        </View>
      </View>

      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetId={host.id} targetName={host.name} onReported={(blocked) => blocked && router.back()} />
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', justifyContent: 'center' },
  heroBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  initial: { fontFamily: fonts.heading, fontSize: 120, lineHeight: 132, color: 'rgba(255,255,255,0.92)' },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg, gap: spacing.lg },
  headCard: { marginTop: -48, gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  level: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rates: { flexDirection: 'row', gap: spacing.md },
  rateCard: { flex: 1, gap: spacing.xs },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: 'row', gap: spacing.md },
});
