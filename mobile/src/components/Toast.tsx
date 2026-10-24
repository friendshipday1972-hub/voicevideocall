import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { motion, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type ToastKind = 'success' | 'error' | 'info';
type ToastState = { id: number; message: string; kind: ToastKind } | null;

const useToastStore = create<{ toast: ToastState; show: (message: string, kind?: ToastKind) => void; hide: () => void }>((set) => ({
  toast: null,
  show: (message, kind = 'info') => set({ toast: { id: Date.now(), message, kind } }),
  hide: () => set({ toast: null }),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().show(m, 'success'),
  error: (m: string) => useToastStore.getState().show(m, 'error'),
  info: (m: string) => useToastStore.getState().show(m, 'info'),
};

/** Mounted once at the root. Auto-dismisses after 3.2s; does not steal focus. */
export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!t) return;
    const id = setTimeout(hide, 3200);
    return () => clearTimeout(id);
  }, [t, hide]);

  if (!t) return null;
  const icon = t.kind === 'success' ? 'checkmark-circle' : t.kind === 'error' ? 'alert-circle' : 'information-circle';
  const tint = t.kind === 'success' ? colors.success : t.kind === 'error' ? colors.danger : colors.accent;

  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      <Animated.View
        key={t.id}
        entering={FadeInUp.duration(motion.base).easing(motion.ease)}
        exiting={FadeOutUp.duration(160)}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <Ionicons name={icon} size={22} color={tint} />
        <AppText variant="bodyMedium" style={{ flex: 1 }}>
          {t.message}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
