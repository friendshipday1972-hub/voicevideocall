import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { Chip } from '@/components/Chip';
import { CoinBadge } from '@/components/CoinBadge';
import { HostCard } from '@/components/HostCard';
import { EmptyState, MAX_WIDTH } from '@/components/Layout';
import { PressableScale } from '@/components/PressableScale';
import { SpotlightRow } from '@/components/SpotlightRow';
import { HOSTS, LANGUAGES, type Host, type LanguageCode, type Presence } from '@/data/mock';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { useStartCall } from '@/lib/useStartCall';
import { usePresence } from '@/stores/presence';
import { useSession } from '@/stores/session';
import { useSocial } from '@/stores/social';
import { useWallet } from '@/stores/wallet';
import { radius, spacing, useTheme } from '@/theme';

const ORDER: Record<Presence, number> = { online: 0, busy: 1, offline: 2 };
const WIDE_COLUMN = 960;

function QuickMatchCard({ language }: { language: LanguageCode | 'all' }) {
const { colors } = useTheme();
const t = useT();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.6 }] }));

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/quick-match', params: { lang: language } })}
      accessibilityLabel={t('home.quickMatchA11y')}
      scaleTo={0.98}>
      <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quick}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="h2" style={{ color: '#fff' }}>
            {t('home.quickMatch')}
          </AppText>
          <AppText style={{ color: 'rgba(255,255,255,0.88)' }}>{t('home.quickMatchBody')}</AppText>
        </View>
        <View style={styles.quickBtnWrap}>
          <Animated.View style={[styles.quickRing, ring]} />
          <View style={styles.quickBtn}>
            <Ionicons name="flash" size={26} color={colors.primary} />
          </View>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const profile = useSession((s) => s.profile);
  const balance = useWallet((s) => s.balance);
  const presence = usePresence((s) => s.presence);
  const favorites = useSocial((s) => s.favorites);
  const blocked = useSocial((s) => s.blocked);
  const [language, setLanguage] = useState<LanguageCode | 'all'>(profile?.languages[0] ?? 'all');
  const [refreshing, setRefreshing] = useState(false);
  const { start, sheet } = useStartCall();
  const t = useT();

  const contentWidth = Math.min(width, WIDE_COLUMN);
  const columns = contentWidth >= 720 ? 3 : 2;
  const gap = spacing.md;

  const myLangs = profile?.languages;
  const tabs = useMemo(() => [...LANGUAGES.filter((l) => myLangs?.includes(l.code)), ...LANGUAGES.filter((l) => !myLangs?.includes(l.code))], [myLangs]);

  const hosts = useMemo(
    () =>
      HOSTS.filter((h) => !blocked.includes(h.id) && (language === 'all' || h.languages.includes(language))).sort(
        // Available hosts first, then by Spotlight Score (featured hosts get a small boost).
        (a, b) => ORDER[presence[a.id]] - ORDER[presence[b.id]] || b.quality.score + (b.featured ? 8 : 0) - (a.quality.score + (a.featured ? 8 : 0)),
      ),
    [blocked, language, presence],
  );
  const onlineCount = hosts.filter((h) => presence[h.id] === 'online').length;

  const openHost = useCallback((h: Host) => router.push({ pathname: '/host/[id]', params: { id: h.id } }), []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <View style={styles.top}>
        <PressableScale onPress={() => router.push('/profile')} accessibilityLabel={t('home.openProfile')}>
          <UserAvatar avatarKey={profile?.avatarKey} size={44} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="textSecondary">
            {t('home.namaste')}
          </AppText>
          <AppText variant="h2" numberOfLines={1}>
            {profile?.displayName}
          </AppText>
        </View>
        <PressableScale onPress={() => router.push('/wallet')} accessibilityLabel={t('home.walletA11y', { n: balance })}>
          <CoinBadge amount={balance} />
        </PressableScale>
      </View>

      <QuickMatchCard language={language} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
        <Chip label={t('home.all')} selected={language === 'all'} onPress={() => setLanguage('all')} />
        {tabs.map((l) => (
          <Chip key={l.code} label={languageName(t, l.code)} selected={language === l.code} onPress={() => setLanguage(l.code)} />
        ))}
      </ScrollView>

      <SpotlightRow hosts={hosts} presence={presence} onOpen={openHost} />

      <View style={styles.countRow}>
        <View style={[styles.liveDot, { backgroundColor: colors.online }]} />
        <AppText variant="label" color="textSecondary">
          {t('home.onlineCount', { n: onlineCount })}
        </AppText>
      </View>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        key={columns}
        data={hosts}
        keyExtractor={(h) => h.id}
        numColumns={columns}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="people" title={t('home.emptyTitle')} body={t('home.emptyBody')} />}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={[styles.list, { maxWidth: WIDE_COLUMN, gap }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)} style={{ flex: 1 / columns }}>
            <HostCard host={item} presence={presence[item.id]} favorite={favorites.includes(item.id)} onOpen={openHost} onCall={start} />
          </Animated.View>
        )}
      />
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { width: '100%', alignSelf: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
  quick: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl, borderRadius: radius.xl, maxWidth: MAX_WIDTH * 1.5 },
  quickBtnWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  quickRing: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  quickBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
});
