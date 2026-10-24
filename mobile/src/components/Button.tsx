import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { iconSize, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, size = 'lg', style, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const height = size === 'lg' ? 54 : 44;
  const fg =
    variant === 'primary' || variant === 'danger' || variant === 'success'
      ? colors.onPrimary
      : variant === 'secondary'
        ? colors.primary
        : colors.text;

  const content = (
    <View style={[styles.row, { height }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={iconSize.md} color={fg} />}
          <AppText variant="label" style={{ color: fg, fontSize: size === 'lg' ? 16 : 14 }}>
            {title}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[styles.base, style]}>
      {variant === 'primary' ? (
        <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.fill,
            variant === 'secondary' && { backgroundColor: colors.primarySoft },
            variant === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
            variant === 'danger' && { backgroundColor: colors.danger },
            variant === 'success' && { backgroundColor: colors.success },
          ]}>
          {content}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, overflow: 'hidden' },
  fill: { borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
});
