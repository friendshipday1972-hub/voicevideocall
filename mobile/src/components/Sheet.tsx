import { useEffect, useState, type ReactNode } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useT } from '@/i18n';
import { motion, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { MAX_WIDTH, useKeyboardVisible } from './Layout';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Bottom sheet: slides up with a spring, scrim fades, tap scrim or close button to dismiss. */
export function Sheet({ visible, onClose, title, children, footer }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardVisible();
  const t = useT();
  const [mounted, setMounted] = useState(visible);
  const offscreen = Dimensions.get('window').height;
  const y = useSharedValue(offscreen);
  const fade = useSharedValue(0);

  // Mount immediately when opened; unmount only after the exit animation finishes.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      fade.set(withTiming(1, { duration: motion.base }));
      y.set(withTiming(0, { duration: motion.slow, easing: motion.ease }));
    } else {
      fade.set(withTiming(0, { duration: motion.fast }));
      y.set(
        withTiming(offscreen, { duration: motion.base - 40, easing: motion.easeIn }, (done) => {
          if (done) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, fade, y, offscreen]);

  const scrim = useAnimatedStyle(() => ({ opacity: fade.value }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} accessibilityRole="button" />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={styles.anchor} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: (keyboardOpen ? 0 : insets.bottom) + spacing.lg }, sheet]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {title && (
            <View style={styles.head}>
              <AppText variant="h2" style={{ flex: 1 }} accessibilityRole="header">
                {title}
              </AppText>
              <IconButton icon="close" label={t('common.close')} onPress={onClose} size={40} />
            </View>
          )}
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            {children}
          </ScrollView>
          {footer && <View style={{ paddingTop: spacing.md }}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    maxHeight: '88%',
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
});
