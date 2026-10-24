import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { iconSize, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Rotate the glyph, e.g. '135deg' for a hang-up handset. */
  iconRotate?: string;
};

/** Icon-only button with a 44pt minimum target and an accessibility label. */
export function IconButton({ icon, label, onPress, size = 44, color, background, style, disabled, iconRotate }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={8}
      scaleTo={0.9}
      style={[styles.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: background ?? colors.surfaceAlt }, style]}>
      <Ionicons name={icon} size={size >= 56 ? iconSize.xl - 4 : iconSize.md + 2} color={color ?? colors.text} style={iconRotate ? { transform: [{ rotate: iconRotate }] } : undefined} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({ btn: { alignItems: 'center', justifyContent: 'center' } });
