import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { useT } from '@/i18n';
import { fonts } from '@/theme';

import { AppText } from './AppText';
import { UserAvatar } from './Avatar';

function Ring({ progress, size, color }: { progress: SharedValue<number>; size: number; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - progress.value), transform: [{ scale: 1 + progress.value * 0.9 }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: 2, borderColor: color }, style]} />;
}

/** Big portrait with expanding rings: ringing (fast) or speaking (slow) state. */
export function PulseAvatar({ name, colors, size = 148, active = true, fast = false }: { name: string; colors: readonly [string, string]; size?: number; active?: boolean; fast?: boolean }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    const duration = fast ? 1200 : 2200;
    if (active) {
      a.set(withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1, false));
      b.set(withDelay(duration / 2, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1, false)));
    } else {
      a.set(withTiming(0));
      b.set(withTiming(0));
    }
  }, [active, fast, a, b]);

  return (
    <View style={{ width: size, height: size }}>
      <Ring progress={a} size={size} color={colors[0]} />
      <Ring progress={b} size={size} color={colors[1]} />
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.portrait, { width: size, height: size, borderRadius: size / 2 }]}>
        <AppText style={{ fontFamily: fonts.heading, fontSize: size * 0.42, lineHeight: size * 0.5, color: '#fff' }}>{name[0]}</AppText>
      </LinearGradient>
    </View>
  );
}

/** Placeholder for the remote video stream (Agora is wired in the backend stage). */
export function RemoteVideo({ name, colors }: { name: string; colors: readonly [string, string] }) {
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.set(withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [breathe]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.04 }] }));
  return (
    <LinearGradient colors={colors} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.center, style]}>
        <AppText style={{ fontFamily: fonts.heading, fontSize: 180, lineHeight: 200, color: 'rgba(255,255,255,0.35)' }}>{name[0]}</AppText>
      </Animated.View>
      <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
    </LinearGradient>
  );
}

export function SelfView({ avatarKey, cameraOff }: { avatarKey: string | undefined; cameraOff: boolean }) {
  const t = useT();
  return (
    <View style={styles.self} accessibilityLabel={cameraOff ? t('call.cameraOffA11y') : t('call.cameraPreview')}>
      {cameraOff ? <Ionicons name="videocam-off" size={26} color="#fff" /> : <UserAvatar avatarKey={avatarKey} size={64} />}
    </View>
  );
}

const styles = StyleSheet.create({
  portrait: { alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  self: {
    width: 104,
    height: 148,
    borderRadius: 18,
    backgroundColor: '#1E1530',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
