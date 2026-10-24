import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT, type TKey } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { motion, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type TabDef = { name: string; title: TKey; icon: IconName; iconActive: IconName };

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

function TabItem({ tab, focused, onPress }: { tab: TabDef; focused: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const pill = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: motion.base, easing: motion.ease }),
    transform: [{ scaleX: withTiming(focused ? 1 : 0.6, { duration: motion.base, easing: motion.ease }) }],
  }));
  return (
    <PressableScale onPress={onPress} hapticOnPress={false} scaleTo={0.94} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t(tab.title)} style={styles.item}>
      <View style={styles.iconWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { backgroundColor: colors.primarySoft }, pill]} />
        <Ionicons name={focused ? tab.iconActive : tab.icon} size={22} color={focused ? colors.primary : colors.textMuted} />
      </View>
      <AppText variant="caption" style={{ color: focused ? colors.primary : colors.textMuted, fontSize: 11 }}>
        {t(tab.title)}
      </AppText>
    </PressableScale>
  );
}

function TabBar({ state, navigation, tabs }: BarProps & { tabs: TabDef[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: colors.tabBar, borderTopColor: colors.divider, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.inner}>
        {state.routes.map((route, i) => {
          const tab = tabs.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === i;
          return (
            <TabItem
              key={route.key}
              tab={tab}
              focused={focused}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) {
                  haptic.select();
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Bottom tabs with the app's custom bar. The scene background is themed so tab switches never flash white. */
export function AppTabs({ tabs }: { tabs: TabDef[] }) {
  const { colors } = useTheme();
  return (
    <Tabs
      initialRouteName={tabs[0].name}
      backBehavior="initialRoute"
      screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => <TabBar {...(props as unknown as BarProps)} tabs={tabs} />}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  inner: { flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center' },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48 },
  iconWrap: { width: 60, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: radius.pill },
});
