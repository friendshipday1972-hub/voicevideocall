import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from '@/i18n';

import { supabase } from './supabase';

/**
 * Push notifications (Firebase Cloud Messaging, Android).
 * The server sends them from database triggers (`supabase/functions/push`); this file only
 * registers the phone and sets up how they look. Expo Go can't receive them, so it's skipped there.
 */
const supported = Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// In the app, the call screen already rings; other notifications show as a normal banner.
if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const inApp = n.request.content.data?.kind === 'call';
      return { shouldShowBanner: !inApp, shouldShowList: !inApp, shouldPlaySound: !inApp, shouldSetBadge: false };
    },
  });
}

let registered: string | null = null;

/** Asks for permission (Android 13+) and saves this phone's token so the server can reach it. */
export async function registerPush(): Promise<void> {
  if (!supported) return;
  try {
    // Channel ids match the server's `channel_id`. Names show in Android's notification settings.
    await Notifications.setNotificationChannelAsync('calls', {
      name: t('push.channelCalls'),
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 800, 400, 800, 400, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync('updates', {
      name: t('push.channelUpdates'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return;
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (typeof token !== 'string') return;
    const { error } = await supabase.rpc('register_device', { p_token: token, p_platform: 'android' });
    if (!error) registered = token;
  } catch {
    // No Google Play services or no network: the app still rings while it's open.
  }
}

/** Before signing out, so the next person on this phone doesn't get this account's alerts. */
export async function unregisterPush(): Promise<void> {
  if (!registered) return;
  await supabase.rpc('unregister_device', { p_token: registered }).then(() => {});
  registered = null;
}

/** Removes a ring left in the notification shade once the call has been seen in the app. */
export async function clearCallAlerts(): Promise<void> {
  if (!supported) return;
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(shown.filter((n) => n.request.content.data?.kind === 'call').map((n) => Notifications.dismissNotificationAsync(n.request.identifier)));
  } catch {
    // Nothing to clear.
  }
}
