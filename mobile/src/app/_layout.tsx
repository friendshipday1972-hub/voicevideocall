import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, useFonts } from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastHost } from '@/components/Toast';
import { useHost, useHostHydrated } from '@/stores/host';
import { usePresence } from '@/stores/presence';
import { useSession } from '@/stores/session';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const sessionHydrated = useSession((s) => s.hydrated);
  const hostHydrated = useHostHydrated();
  const signedIn = useSession((s) => !!s.phone);
  const role = useSession((s) => s.profile?.role ?? null);
  const hostApproved = useHost((s) => s.status === 'approved');
  // Wait for every persisted store, so the first screen shown is already the right one.
  const ready = fontsLoaded && sessionHydrated && hostHydrated;

  // Which app this person sees. Each flow is a guarded group; the others don't exist for them.
  const needsProfile = signedIn && !role;
  const isCaller = signedIn && role === 'user';
  const needsKyc = signedIn && role === 'host' && !hostApproved;
  const isHost = signedIn && role === 'host' && hostApproved;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // The native window behind every screen: themed, so transitions never reveal white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  useEffect(() => {
    if (isCaller) return usePresence.getState().start();
  }, [isCaller]);

  if (!ready) return null;

  const navTheme = isDark ? DarkTheme : DefaultTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: colors.background, primary: colors.primary, card: colors.surface, text: colors.text, border: colors.divider } }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          </Stack.Protected>

          <Stack.Protected guard={needsProfile}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>

          {/* Caller app */}
          <Stack.Protected guard={isCaller}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="host/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="call/[hostId]" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="quick-match" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          </Stack.Protected>

          {/* Host (women): mandatory KYC first, then the host app */}
          <Stack.Protected guard={needsKyc}>
            <Stack.Screen name="host-kyc" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={isHost}>
            <Stack.Screen name="(host)" options={{ animation: 'fade' }} />
            <Stack.Screen name="host-mode" options={{ animation: 'fade' }} />
          </Stack.Protected>

          <Stack.Protected guard={isCaller || isHost}>
            <Stack.Screen name="settings" />
          </Stack.Protected>
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
