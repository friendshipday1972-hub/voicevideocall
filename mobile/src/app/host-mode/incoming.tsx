import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { IconButton } from '@/components/IconButton';
import { MAX_WIDTH } from '@/components/Layout';
import { toast } from '@/components/Toast';
import { appConfig } from '@/config/appConfig';
import { AVATARS } from '@/data/mock';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { haptic } from '@/lib/haptics';
import { useHost } from '@/stores/host';
import { useTheme, spacing, radius } from '@/theme';

const CALLERS = ['Rahul', 'Arjun', 'Vikram', 'Sai', 'Karthik', 'Aman', 'Rohit'];

/**
 * Full-screen incoming call. In the live app this is shown by CallKeep / ConnectionService
 * from a high-priority FCM push, even when the app is killed.
 */
export default function Incoming() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [caller] = useState(() => ({
      name: CALLERS[Math.floor(Math.random() * CALLERS.length)],
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)].key,
      lang: ['te', 'hi', 'ta', 'kn'][Math.floor(Math.random() * 4)],
      type: Math.random() < 0.5 ? ('audio' as const) : ('video' as const),
  }));
  const [left, setLeft] = useState<number>(appConfig.ringTimeoutSeconds);
  const recordRing = useHost((s) => s.recordRing);
  const shake = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    shake.set(withRepeat(withSequence(withTiming(-12, { duration: 70 }), withTiming(12, { duration: 70 }), withTiming(-8, { duration: 70 }), withTiming(0, { duration: 70 }), withTiming(0, { duration: 900 })), -1, false));
    glow.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    haptic.warning();
  }, [shake, glow]);

  useEffect(() => {
    if (left <= 0) {
      recordRing(false);
      toast.info(t('incoming.missed', { name: caller.name }));
      router.back();
      return;
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left, caller.name, recordRing, t]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - glow.value), transform: [{ scale: 1 + glow.value * 0.8 }] }));

  return (
    <View style={styles.flex}>
      <LinearGradient colors={colors.gradientCall} style={StyleSheet.absoluteFill} />
      <View style={[styles.flex, styles.column, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]}>
        <Animated.View entering={FadeIn} style={styles.center}>
          <View style={[styles.chip]}>
            <Ionicons name={caller.type === 'video' ? 'videocam' : 'call'} size={14} color="#fff" />
            <AppText variant="caption" style={{ color: '#fff' }}>
              {t('incoming.title', { type: caller.type === 'video' ? t('common.video') : t('common.voice') })}
            </AppText>
          </View>
          <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[styles.glow, { backgroundColor: colors.primary }, glowStyle]} />
            <UserAvatar avatarKey={caller.avatar} size={128} />
          </View>
          <AppText variant="display" style={{ color: '#fff' }}>
            {caller.name}
          </AppText>
          <AppText style={{ color: 'rgba(255,255,255,0.75)' }}>
            {t('incoming.prefers', { lang: languageName(t, caller.lang), s: left })}
          </AppText>
        </Animated.View>

        <View style={styles.actions}>
          <View style={styles.action}>
            <IconButton
              icon="close"
              label={t('incoming.decline')}
              size={72}
              background={colors.danger}
              color="#fff"
              onPress={() => {
                recordRing(false);
                haptic.tap();
                router.back();
              }}
            />
            <AppText variant="label" style={{ color: '#fff' }}>
              {t('incoming.decline')}
            </AppText>
          </View>
          <View style={styles.action}>
            <Animated.View style={iconStyle}>
              <IconButton
                icon={caller.type === 'video' ? 'videocam' : 'call'}
                label={t('incoming.accept')}
                size={72}
                background={colors.success}
                color="#fff"
                onPress={() => {
                  recordRing(true);
                  haptic.success();
                  router.replace({ pathname: '/host-mode/call', params: { name: caller.name, avatar: caller.avatar, type: caller.type } });
                }}
              />
            </Animated.View>
            <AppText variant="label" style={{ color: '#fff' }}>
              {t('incoming.accept')}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  glow: { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: spacing.sm },
});
