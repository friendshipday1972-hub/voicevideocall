import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  scaleTo?: number;
  hapticOnPress?: boolean;
};

/**
 * Pressable with a subtle spring scale + opacity on press (transform only, no layout shift).
 * The style goes on the pressable itself, so layout props like `flex` behave as expected.
 * Don't pass `transform` in `style`; the press animation owns it.
 */
export function PressableScale({ style, children, scaleTo = 0.97, hapticOnPress = true, onPressIn, onPressOut, onPress, disabled, ...rest }: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const dimmed = disabled ? 0.45 : 1;
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value * dimmed }), [dimmed]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: 100, easing: motion.ease }));
        opacity.set(withTiming(0.92, { duration: motion.fast }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: motion.fast, easing: motion.ease }));
        opacity.set(withTiming(1, { duration: motion.fast }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic.tap();
        onPress?.(e);
      }}
      style={[style, animated]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
