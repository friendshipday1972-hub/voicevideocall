import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function HostModeLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="incoming" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="call" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
