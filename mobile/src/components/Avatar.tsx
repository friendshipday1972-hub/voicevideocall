import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { avatarByKey, type Host, type Presence } from '@/data/catalog';
import { useT } from '@/i18n';
import { fonts, useTheme } from '@/theme';

import { AppText } from './AppText';

/** Preset avatar for users (privacy: no real photo required). */
export function UserAvatar({ avatarKey, size = 48 }: { avatarKey: string | null | undefined; size?: number }) {
  const a = avatarByKey(avatarKey);
  return (
    <LinearGradient colors={a.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name={a.icon} size={size * 0.48} color="#fff" accessibilityElementsHidden />
    </LinearGradient>
  );
}

/** Host portrait placeholder. Real hosts upload a verified photo; the prototype uses gradient initials. */
export function HostAvatar({ host, size = 56, presence, rounded }: { host: Pick<Host, 'name' | 'colors'>; size?: number; presence?: Presence; rounded?: number }) {
  const { colors } = useTheme();
  const r = rounded ?? size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient colors={host.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.circle, { width: size, height: size, borderRadius: r }]}>
        <AppText style={{ fontFamily: fonts.heading, fontSize: size * 0.42, lineHeight: size * 0.5, color: '#fff' }}>{host.name[0]}</AppText>
      </LinearGradient>
      {presence && (
        <View style={[styles.dotWrap, { borderColor: colors.surface, right: rounded ? -2 : 0, bottom: rounded ? -2 : 0 }]}>
          <PresenceDot presence={presence} size={Math.max(10, size * 0.2)} />
        </View>
      )}
    </View>
  );
}

export function PresenceDot({ presence, size = 10 }: { presence: Presence; size?: number }) {
  const { colors } = useTheme();
  const t = useT();
  const pulse = useSharedValue(0);
  const color = presence === 'online' ? colors.online : presence === 'busy' ? colors.busy : colors.offline;

  useEffect(() => {
    pulse.set(presence === 'online' ? withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false) : withTiming(0));
  }, [presence, pulse]);

  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 1.2 }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={t(`common.presence.${presence}`)}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  dotWrap: { position: 'absolute', borderWidth: 2.5, borderRadius: 99 },
});
