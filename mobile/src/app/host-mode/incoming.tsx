import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { IconButton } from '@/components/IconButton';
import { MAX_WIDTH } from '@/components/Layout';
import { toast } from '@/components/Toast';
import { appConfig } from '@/config/appConfig';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { callErrorText, fetchCall, watchCall, type LiveCall } from '@/lib/calls';
import { haptic } from '@/lib/haptics';
import { errorCode, rpc } from '@/lib/supabase';
import { useTheme, spacing, radius } from '@/theme';

/**
 * Full-screen incoming call, opened when a ring arrives over Supabase Realtime while the app is
 * open. With Firebase push (next stage) it also rings when the app is closed.
 */
export default function Incoming() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [call, setCall] = useState<LiveCall | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const closed = useRef(false);
  const shake = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    shake.set(withRepeat(withSequence(withTiming(-12, { duration: 70 }), withTiming(12, { duration: 70 }), withTiming(-8, { duration: 70 }), withTiming(0, { duration: 70 }), withTiming(0, { duration: 900 })), -1, false));
    glow.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    haptic.warning();
  }, [shake, glow]);

  useEffect(() => {
    if (!sessionId) return;
    // A live update may land before the first fetch; keep its (newer) state.
    fetchCall(sessionId).then((c) => c && setCall((prev) => (prev ? { ...c, state: prev.state } : c)));
    return watchCall(sessionId, (update) => setCall((prev) => update(prev)));
  }, [sessionId]);

  const close = (message?: string) => {
    if (closed.current) return;
    closed.current = true;
    if (message) toast.info(message);
    router.back();
  };

  // The caller hung up, or it timed out on the server.
  useEffect(() => {
    if (call && call.state !== 'ringing' && call.state !== 'active') close(t('incoming.missed', { name: call.callerName }));
    // close is stable for this screen's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.state]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = call ? Math.max(0, appConfig.ringTimeoutSeconds - Math.floor((now - call.createdAt) / 1000)) : appConfig.ringTimeoutSeconds;
  useEffect(() => {
    if (call && left <= 0) close(t('incoming.missed', { name: call.callerName }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const decline = async () => {
    haptic.tap();
    if (sessionId) rpc('decline_call', { p_session: sessionId }).catch(() => {});
    close();
  };

  const accept = async () => {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      await rpc('accept_call', { p_session: sessionId });
      haptic.success();
      closed.current = true;
      router.replace({ pathname: '/host-mode/call', params: { sessionId } });
    } catch (e) {
      haptic.error();
      const code = errorCode(e);
      close(code === 'caller_no_coins' ? t('incoming.callerNoCoins') : callErrorText(t, code));
    } finally {
      setBusy(false);
    }
  };

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - glow.value), transform: [{ scale: 1 + glow.value * 0.8 }] }));
  const type = call?.type ?? 'audio';
  const lang = call?.language ?? call?.callerLanguages[0] ?? 'en';

  return (
    <View style={styles.flex}>
      <LinearGradient colors={colors.gradientCall} style={StyleSheet.absoluteFill} />
      <View style={[styles.flex, styles.column, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]}>
        <Animated.View entering={FadeIn} style={styles.center}>
          <View style={styles.chip}>
            <Ionicons name={type === 'video' ? 'videocam' : 'call'} size={14} color="#fff" />
            <AppText variant="caption" style={{ color: '#fff' }}>
              {t('incoming.title', { type: type === 'video' ? t('common.video') : t('common.voice') })}
            </AppText>
          </View>
          <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[styles.glow, { backgroundColor: colors.primary }, glowStyle]} />
            <UserAvatar avatarKey={call?.callerAvatar ?? undefined} size={128} />
          </View>
          <AppText variant="display" style={{ color: '#fff' }}>
            {call?.callerName ?? ''}
          </AppText>
          <AppText style={{ color: 'rgba(255,255,255,0.75)' }}>{t('incoming.prefers', { lang: languageName(t, lang), s: left })}</AppText>
        </Animated.View>

        <View style={styles.actions}>
          <View style={styles.action}>
            <IconButton icon="close" label={t('incoming.decline')} size={72} background={colors.danger} color="#fff" onPress={decline} />
            <AppText variant="label" style={{ color: '#fff' }}>
              {t('incoming.decline')}
            </AppText>
          </View>
          <View style={styles.action}>
            <Animated.View style={iconStyle}>
              <IconButton icon={type === 'video' ? 'videocam' : 'call'} label={t('incoming.accept')} size={72} background={colors.success} color="#fff" disabled={!call || busy} onPress={accept} />
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
