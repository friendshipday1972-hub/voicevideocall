import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

export function CoinIcon({ size = 18 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={colors.gradientCoin} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="star" size={size * 0.55} color="#7C2D12" />
    </LinearGradient>
  );
}

export function CoinBadge({ amount, onDark }: { amount: number; onDark?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.badge, { backgroundColor: onDark ? 'rgba(255,255,255,0.14)' : colors.surface, borderColor: onDark ? 'transparent' : colors.border }]}
      accessibilityLabel={`${amount} coins`}>
      <CoinIcon />
      <AppText variant="label" tabular style={{ color: onDark ? '#fff' : colors.text }}>
        {amount.toLocaleString('en-IN')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1 },
});
