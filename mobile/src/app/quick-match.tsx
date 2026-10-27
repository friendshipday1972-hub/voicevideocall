import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { HostAvatar, UserAvatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { MAX_WIDTH } from '@/components/Layout';
import type { Host } from '@/data/catalog';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { haptic } from '@/lib/haptics';
import { useStartCall } from '@/lib/useStartCall';
import { useHosts, usePresence } from '@/stores/hosts';
import { useSession } from '@/stores/session';
import { useBlockedIds } from '@/stores/social';
import { motion, radius, spacing, useTheme } from '@/theme';

const SEARCH_MS = 2200;

function RadarRing({ v, color }: { v: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - v.value), transform: [{ scale: 0.4 + v.value * 1.6 }] }));
  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

/** Smart ranking (spec §12.10): language match + Spotlight Score (rating, returning callers, reliability, safety). Never by appearance. */
function pickBest(hosts: Host[], lang: string, exclude: string[], presence: Record<string, string>, blocked: string[], myLangs: string[]): Host | null {
  const pool = hosts.filter((h) => presence[h.id] === 'online' && !blocked.includes(h.id) && !exclude.includes(h.id));
  const score = (h: Host) =>
    (lang !== 'all' && h.languages.includes(lang as never) ? 100 : 0) + (h.languages.some((l) => myLangs.includes(l)) ? 40 : 0) + h.quality.score + (h.featured ? 8 : 0) + Math.random() * 8;
  return pool.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export default function QuickMatch() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { lang = 'all' } = useLocalSearchParams<{ lang?: string }>();
  const profile = useSession((s) => s.profile);
  const blocked = useBlockedIds();
  const { start, sheet } = useStartCall();
  const t = useT();
  const [match, setMatch] = useState<Host | null | undefined>(undefined);
  const [skipped, setSkipped] = useState<string[]>([]);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const r3 = useSharedValue(0);

  useEffect(() => {
    const anim = (d: number) => withDelay(d, withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false));
    r1.set(anim(0));
    r2.set(anim(650));
    r3.set(anim(1300));
  }, [r1, r2, r3]);

  useEffect(() => {
    if (match !== undefined) return;
    const id = setTimeout(() => {
      const best = pickBest(useHosts.getState().hosts, lang, skipped, usePresence.getState().presence, blocked, profile?.languages ?? []);
      setMatch(best);
      if (best) haptic.success();
      else haptic.warning();
    }, SEARCH_MS);
    return () => clearTimeout(id);
  }, [match, lang, skipped, blocked, profile?.languages]);

  const label = useMemo(() => (lang === 'all' ? t('quickMatch.anyLanguage') : languageName(t, lang)), [lang, t]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <LinearGradient colors={colors.gradientHero} style={StyleSheet.absoluteFill} />
      <View style={[styles.flex, styles.column, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
        <IconButton icon="close" label={t('quickMatch.close')} onPress={() => router.back()} />

        <View style={styles.center}>
          <View style={styles.radar}>
            {match === undefined && (
              <>
                <RadarRing v={r1} color={colors.primary} />
                <RadarRing v={r2} color={colors.primary} />
                <RadarRing v={r3} color={colors.primary} />
              </>
            )}
            {match ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <HostAvatar host={match} size={140} presence="online" />
              </Animated.View>
            ) : (
              <UserAvatar avatarKey={profile?.avatarKey} size={110} />
            )}
          </View>

          {match === undefined && (
            <Animated.View entering={FadeIn} style={styles.text}>
              <AppText variant="h1" align="center">
                {t('quickMatch.finding')}
              </AppText>
              <AppText color="textSecondary" align="center">
                {t('quickMatch.findingBody', { lang: label })}
              </AppText>
            </Animated.View>
          )}

          {match && (
            <Animated.View entering={FadeInUp.duration(motion.slow)} style={styles.text}>
              <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="sparkles" size={14} color={colors.primary} />
                <AppText variant="caption" color="primary">
                  {t('quickMatch.match')}
                </AppText>
              </View>
              <AppText variant="h1" align="center">
                {match.name}, {match.age}
              </AppText>
              <AppText color="textSecondary" align="center">
                {match.languages.map((l) => languageName(t, l)).join(' · ')} · ★ {match.rating.toFixed(1)}
              </AppText>
            </Animated.View>
          )}

          {match === null && (
            <Animated.View entering={FadeIn} style={styles.text}>
              <AppText variant="h1" align="center">
                {t('quickMatch.busyTitle')}
              </AppText>
              <AppText color="textSecondary" align="center">
                {t('quickMatch.busyBody', { lang: label })}
              </AppText>
            </Animated.View>
          )}
        </View>

        {match && (
          <Animated.View entering={FadeInUp.delay(120)} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button title={t('common.voiceCall')} variant="secondary" icon="call" style={{ flex: 1 }} onPress={() => start(match, 'audio')} />
              <Button title={t('common.videoCall')} icon="videocam" style={{ flex: 1 }} onPress={() => start(match, 'video')} />
            </View>
            <Button
              title={t('quickMatch.another')}
              variant="ghost"
              icon="shuffle"
              onPress={() => {
                setSkipped((s) => [...s, match.id]);
                setMatch(undefined);
              }}
            />
          </Animated.View>
        )}
        {match === null && (
          <Button
            title={t('quickMatch.tryAgain')}
            icon="refresh"
            onPress={() => {
              setSkipped([]);
              setMatch(undefined);
            }}
          />
        )}
      </View>
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xxl },
  radar: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 2 },
  text: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
});
