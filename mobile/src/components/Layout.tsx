import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useSession } from '@/stores/session';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';

export const MAX_WIDTH = 640;

/** True while the software keyboard is open. */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * Full-screen page with safe areas, optional scroll and a centered max-width column for tablets.
 * Keyboard-aware on both platforms: content and footer sit above the keyboard (Android draws
 * edge-to-edge, so the window no longer resizes by itself) and the focused field is scrolled into view.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  edges = ['top', 'bottom'],
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  edges?: ('top' | 'bottom')[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ScrollViewProps['refreshControl'];
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardVisible();
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const padTop = edges.includes('top') ? insets.top : 0;
  // The keyboard covers the system navigation bar, so drop that inset while it is open.
  const padBottom = edges.includes('bottom') && !keyboardOpen ? insets.bottom : 0;
  const inner = [styles.column, contentStyle];

  useEffect(() => {
    if (!scroll) return;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // Wait a frame so the keyboard padding is applied before measuring.
      requestAnimationFrame(() => {
        const input = TextInput.State.currentlyFocusedInput();
        const content = contentRef.current;
        if (!input || !content) return;
        input.measureLayout(
          content,
          (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.xxxl * 2), animated: true }),
          () => {},
        );
      });
    });
    return () => sub.remove();
  }, [scroll]);

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background, paddingTop: padTop }]}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingBottom: (footer ? spacing.lg : padBottom) + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}>
          <View ref={contentRef} style={inner} collapsable={false}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
      {footer && (
        <View style={[styles.footer, { paddingBottom: padBottom + spacing.md, borderTopColor: colors.divider, backgroundColor: colors.background }]}>
          <View style={styles.column}>{footer}</View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** Back if there is history, otherwise to this person's home tab (never to a guarded screen). */
function goBack() {
  if (router.canGoBack()) return router.back();
  router.replace(useSession.getState().profile?.role === 'host' ? '/dashboard' : '/');
}

export function Header({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  const t = useT();
  return (
    <View style={styles.header}>
      {back && <IconButton icon="chevron-back" label={t('common.goBack')} onPress={goBack} />}
      <View style={styles.flex}>
        <AppText variant="h2" accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        padded && { padding: spacing.lg },
        { backgroundColor: colors.surface, borderColor: colors.divider },
        !isDark && styles.shadow,
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="h3" accessibilityRole="header">
        {title}
      </AppText>
      {action && onAction && (
        <PressableScale onPress={onAction} accessibilityLabel={action} hitSlop={10}>
          <AppText variant="label" color="primary">
            {action}
          </AppText>
        </PressableScale>
      )}
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
  showChevron = true,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  showChevron?: boolean;
}) {
  const { colors } = useTheme();
  const body = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? 'rgba(220,38,38,0.12)' : colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyMedium" style={danger ? { color: colors.danger } : undefined}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" color="textSecondary">
            {subtitle}
          </AppText>
        )}
      </View>
      {right}
      {onPress && showChevron && !right && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityLabel={title}>
      {body}
    </PressableScale>
  ) : (
    body
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: spacing.xs }} />;
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      <AppText color="textSecondary" align="center" style={{ maxWidth: 300 }}>
        {body}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg },
  footer: { paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 64 },
  card: { borderRadius: radius.xl, borderWidth: 1 },
  shadow: { shadowColor: '#881337', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
});
