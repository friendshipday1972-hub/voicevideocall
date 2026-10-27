import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, useFonts } from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastHost, toast } from '@/components/Toast';
import { t } from '@/i18n';
import { findRinging, watchIncoming } from '@/lib/calls';
import { supabase } from '@/lib/supabase';
import { useHost } from '@/stores/host';
import { useHosts } from '@/stores/hosts';
import { useSession } from '@/stores/session';
import { useSocial } from '@/stores/social';
import { useWallet } from '@/stores/wallet';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

let ringingShown: string | null = null;
function showIncoming(sessionId: string) {
  if (ringingShown === sessionId) return;
  ringingShown = sessionId;
  router.push({ pathname: '/host-mode/incoming', params: { sessionId } });
}

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
  const userId = useSession((s) => s.userId);
  const role = useSession((s) => s.profile?.role ?? null);
  const blockedReason = useSession((s) => s.blockedReason);
  const hostStatus = useHost((s) => s.status);
  const hostLoaded = useHost((s) => s.loaded);
  const signedIn = !!userId;
  // Hosts: wait until we know whether she is approved, so she lands on the right screen.
  const ready = fontsLoaded && sessionHydrated && (role !== 'host' || hostLoaded);

  // Which app this person sees. Each flow is a guarded group; the others don't exist for them.
  const needsProfile = signedIn && !role;
  const isCaller = signedIn && role === 'user';
  const needsKyc = signedIn && role === 'host' && hostStatus !== 'approved';
  const isHost = signedIn && role === 'host' && hostStatus === 'approved';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // The native window behind every screen: themed, so transitions never reveal white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  useEffect(() => {
    if (!blockedReason) return;
    toast.error(t(`auth.blocked.${blockedReason}`));
    useSession.setState({ blockedReason: null });
  }, [blockedReason]);

  // Live data for whoever is signed in.
  useEffect(() => {
    if (!userId || !role) return;
    if (role === 'user') {
      const stopHosts = useHosts.getState().start();
      const stopWallet = useWallet.getState().start(userId);
      useSocial.getState().refresh();
      return () => {
        stopHosts();
        stopWallet();
        useWallet.getState().reset();
        useSocial.getState().reset();
      };
    }
    const stopHost = useHost.getState().start(userId);
    useSocial.getState().refresh();
    return () => {
      stopHost();
      useHost.getState().reset();
      useSocial.getState().reset();
    };
  }, [userId, role]);

  // Approved hosts: ring when a caller calls, and keep her marked online while the app is open.
  useEffect(() => {
    if (!isHost || !userId) return;
    const stop = watchIncoming(userId, showIncoming);
    const check = () => findRinging(userId).then((id) => id && showIncoming(id));
    check();
    const ping = setInterval(() => supabase.rpc('ping').then(() => {}), 60_000);
    // Safety net for a missed live event (flaky network): a cheap check for a ringing call.
    const poll = setInterval(() => AppState.currentState === 'active' && check(), 8000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.rpc('ping').then(() => {});
        check();
      }
    });
    return () => {
      stop();
      clearInterval(ping);
      clearInterval(poll);
      sub.remove();
    };
  }, [isHost, userId]);

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
