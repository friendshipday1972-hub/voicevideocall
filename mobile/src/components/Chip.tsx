import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  size?: 'sm' | 'md';
};

export function Chip({ label, selected, onPress, icon, size = 'md' }: Props) {
  const { colors } = useTheme();
  const body = (
    <View
      style={[
        styles.chip,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: selected ? colors.primary : colors.surfaceAlt, borderColor: selected ? colors.primary : colors.border },
      ]}>
      {icon && <Ionicons name={icon} size={14} color={selected ? colors.onPrimary : colors.textSecondary} />}
      <AppText variant={size === 'sm' ? 'caption' : 'label'} style={{ color: selected ? colors.onPrimary : colors.textSecondary }}>
        {label}
      </AppText>
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale
      hapticOnPress={false}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, borderWidth: 1 },
  md: { minHeight: 40, paddingHorizontal: spacing.lg },
  sm: { minHeight: 26, paddingHorizontal: spacing.sm + 2 },
});
